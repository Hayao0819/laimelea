package com.hayao0819.laimelea.alarm

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.util.UUID

internal object TimerAlarmScheduler {
    private const val PREFERENCES = "scheduledTimers"
    private const val TIMER_PREFIX = "timer."
    private const val COMPLETION_PREFIX = "completed."
    private const val ACTION_FIRE = "com.hayao0819.laimelea.TIMER_FIRING"
    private const val CHANNEL_ID = "timer"
    private const val NOTIFICATION_PREFIX = "native-timer-"
    internal const val EXTRA_GENERATION = "generation"

    // Keeps `elapsedRealtime() + remainingMs` well clear of Long overflow regardless of uptime.
    internal const val MAX_REMAINING_MS = 10L * 365 * 24 * 60 * 60 * 1000

    internal data class StoredTimer(
        val label: String,
        val wallDeadlineMs: Long,
        val deadlineElapsedMs: Long? = null,
        val generation: String? = null,
    )

    @Synchronized
    fun schedule(context: Context, timerId: String, label: String, remainingMs: Long) {
        require(remainingMs in 1..MAX_REMAINING_MS)
        val deadlineElapsedMs = SystemClock.elapsedRealtime() + remainingMs
        val previous = storedTimer(context, timerId)
        val next = StoredTimer(
            label = label,
            wallDeadlineMs = System.currentTimeMillis() + remainingMs,
            deadlineElapsedMs = deadlineElapsedMs,
            generation = UUID.randomUUID().toString(),
        )
        if (!preferences(context).edit()
                .putString(timerKey(timerId), encodeStoredTimer(next))
                .commit()
        ) {
            error("Unable to persist scheduled timer")
        }
        try {
            register(context, timerId, deadlineElapsedMs, next.generation!!)
        } catch (error: Exception) {
            cancelPendingIntent(context, timerId, next.generation)
            preferences(context).edit().also { editor ->
                if (previous == null) editor.remove(timerKey(timerId))
                else editor.putString(timerKey(timerId), encodeStoredTimer(previous))
            }.commit()
            throw error
        }
        previous?.let { cancelPendingIntent(context, timerId, it.generation) }
        if (previous?.generation != null) cancelPendingIntent(context, timerId, null)
    }

    @Synchronized
    fun cancel(context: Context, timerId: String) {
        val previous = storedTimer(context, timerId)
        if (!preferences(context).edit().remove(timerKey(timerId)).commit()) {
            error("Unable to remove scheduled timer")
        }
        cancelPendingIntent(context, timerId, previous?.generation)
        if (previous?.generation != null) cancelPendingIntent(context, timerId, null)
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel("$NOTIFICATION_PREFIX$timerId", 0)
    }

    @Synchronized
    fun rescheduleAfterBoot(context: Context) {
        val preferences = preferences(context)
        preferences.all
            .filterKeys { it.startsWith(TIMER_PREFIX) }
            .forEach { (key, value) ->
                val timerId = key.removePrefix(TIMER_PREFIX)
                val storedTimer = (value as? String)?.let(::decodeStoredTimer)
                if (storedTimer == null) {
                    preferences.edit().remove(key).commit()
                    return@forEach
                }
                val remainingMs = storedTimer.wallDeadlineMs - System.currentTimeMillis()
                if (remainingMs <= 0) {
                    fire(context, timerId, storedTimer.generation)
                    return@forEach
                }
                val next = storedTimer.copy(
                    deadlineElapsedMs = SystemClock.elapsedRealtime() + remainingMs,
                    generation = UUID.randomUUID().toString(),
                )
                // Commit the new generation before registering with AlarmManager, mirroring
                // schedule(): a crash between the two steps leaves disk ahead of AlarmManager,
                // which fire()'s generation check tolerates (the timer just never fires, instead
                // of firing and silently failing the check).
                if (!preferences.edit().putString(key, encodeStoredTimer(next)).commit()) return@forEach
                runCatching {
                    register(context, timerId, next.deadlineElapsedMs!!, next.generation!!)
                }.onSuccess {
                    cancelPendingIntent(context, timerId, storedTimer.generation)
                    if (storedTimer.generation != null) cancelPendingIntent(context, timerId, null)
                }.onFailure {
                    cancelPendingIntent(context, timerId, next.generation)
                    preferences.edit().putString(key, encodeStoredTimer(storedTimer)).commit()
                }
            }
    }

    @Synchronized
    fun fire(context: Context, timerId: String, generation: String? = null): Boolean {
        val storedTimer = storedTimer(context, timerId) ?: return false
        if (storedTimer.generation != generation) return false
        val label = storedTimer.label.takeIf { it.isNotBlank() }
            ?: context.getString(com.hayao0819.laimelea.R.string.timer_notification_title)
        if (!recordCompletion(preferences(context), timerId)) return false
        showNotification(context, timerId, label)
        return true
    }

    fun remainingMs(context: Context, timerId: String): Long? {
        val deadlineElapsedMs = storedTimer(context, timerId)?.deadlineElapsedMs ?: return null
        return (deadlineElapsedMs - SystemClock.elapsedRealtime()).takeIf { it > 0 }
    }

    fun scheduledTimerIds(context: Context): List<String> = preferences(context).all.keys
        .filter { it.startsWith(TIMER_PREFIX) }
        .map { it.removePrefix(TIMER_PREFIX) }

    @Synchronized
    fun rebaseWallDeadlines(context: Context) {
        val elapsedNow = SystemClock.elapsedRealtime()
        val wallNow = System.currentTimeMillis()
        val preferences = preferences(context)
        val editor = preferences.edit()
        var changed = false
        preferences.all
            .filterKeys { it.startsWith(TIMER_PREFIX) }
            .forEach { (key, value) ->
                val timer = (value as? String)?.let(::decodeStoredTimer) ?: return@forEach
                val deadlineElapsedMs = timer.deadlineElapsedMs ?: return@forEach
                val remainingMs = (deadlineElapsedMs - elapsedNow).coerceAtLeast(0)
                editor.putString(
                    key,
                    encodeStoredTimer(timer.copy(wallDeadlineMs = wallNow + remainingMs)),
                )
                changed = true
            }
        // A failed commit here just delays the wall-clock display catching up; the
        // AlarmManager deadline (elapsed-realtime based) is unaffected, so this must not throw.
        if (changed) editor.commit()
    }

    internal fun storedTimerFor(context: Context, timerId: String): StoredTimer? =
        storedTimer(context, timerId)

    fun consumeCompleted(context: Context): List<String> {
        return consumeCompletedIds(preferences(context))
    }

    internal fun recordCompletion(
        preferences: SharedPreferences,
        timerId: String,
    ): Boolean = preferences.edit()
        .remove(timerKey(timerId))
        .putBoolean("$COMPLETION_PREFIX$timerId", true)
        .commit()

    internal fun consumeCompletedIds(preferences: SharedPreferences): List<String> {
        val completedIds = preferences.all.keys
            .filter { it.startsWith(COMPLETION_PREFIX) }
            .map { it.removePrefix(COMPLETION_PREFIX) }
        if (completedIds.isEmpty()) return emptyList()
        val persisted = preferences.edit().also { editor ->
            completedIds.forEach { editor.remove("$COMPLETION_PREFIX$it") }
        }.commit()
        return completedIds.takeIf { persisted }.orEmpty()
    }

    private fun register(
        context: Context,
        timerId: String,
        deadlineElapsedMs: Long,
        generation: String,
    ) {
        val manager = alarmManager(context)
        val pendingIntent = pendingIntent(context, timerId, generation)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()) {
            manager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, deadlineElapsedMs, pendingIntent)
        } else {
            manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, deadlineElapsedMs, pendingIntent)
        }
    }

    private fun showNotification(context: Context, timerId: String, label: String) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    context.getString(com.hayao0819.laimelea.R.string.timer_notification_channel),
                    NotificationManager.IMPORTANCE_DEFAULT,
                ).apply {
                    enableVibration(true)
                },
            )
        }
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val contentIntent = launchIntent?.let {
            PendingIntent.getActivity(
                context,
                timerId.hashCode(),
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.hayao0819.laimelea.R.mipmap.ic_launcher)
            .setContentTitle(label)
            .setContentText(
                context.getString(com.hayao0819.laimelea.R.string.timer_notification_complete),
            )
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .also { builder -> if (contentIntent != null) builder.setContentIntent(contentIntent) }
            .build()
        manager.notify("$NOTIFICATION_PREFIX$timerId", 0, notification)
    }

    private fun cancelPendingIntent(context: Context, timerId: String, generation: String?) {
        val pendingIntent = pendingIntent(context, timerId, generation)
        alarmManager(context).cancel(pendingIntent)
        pendingIntent.cancel()
    }

    private fun pendingIntent(
        context: Context,
        timerId: String,
        generation: String?,
    ): PendingIntent {
        val intent = Intent(context, TimerAlarmReceiver::class.java)
            .setAction(ACTION_FIRE)
            .setData(
                Uri.Builder()
                    .scheme("laimelea")
                    .authority("timer")
                    .appendPath(timerId)
                    .apply {
                        generation?.let { appendQueryParameter(EXTRA_GENERATION, it) }
                    }
                    .build(),
            )
            .putExtra(EXTRA_GENERATION, generation)
        return PendingIntent.getBroadcast(
            context,
            timerId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    internal fun encodeStoredTimer(timer: StoredTimer): String = JSONObject()
        .put("label", timer.label)
        .put("wallDeadlineMs", timer.wallDeadlineMs)
        .also { timer.deadlineElapsedMs?.let { deadline -> it.put("deadlineElapsedMs", deadline) } }
        .also { timer.generation?.let { generation -> it.put(EXTRA_GENERATION, generation) } }
        .toString()

    internal fun decodeStoredTimer(value: String): StoredTimer? = runCatching {
        val json = JSONObject(value)
        StoredTimer(
            label = json.getString("label"),
            wallDeadlineMs = json.getLong("wallDeadlineMs"),
            deadlineElapsedMs = json.optLong("deadlineElapsedMs").takeIf {
                json.has("deadlineElapsedMs")
            },
            generation = json.optString(EXTRA_GENERATION).takeIf { json.has(EXTRA_GENERATION) },
        )
    }.getOrElse {
        val fields = value.split("|", limit = 2)
        fields.getOrNull(1)?.toLongOrNull()?.let { StoredTimer(fields[0], it) }
    }

    private fun timerKey(timerId: String) = "$TIMER_PREFIX$timerId"

    private fun storedTimer(context: Context, timerId: String): StoredTimer? =
        preferences(context).getString(timerKey(timerId), null)?.let(::decodeStoredTimer)

    private fun alarmManager(context: Context) =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
}

class TimerAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "com.hayao0819.laimelea.TIMER_FIRING") return
        val timerId = intent.data?.lastPathSegment ?: return
        val generation = intent.getStringExtra(TimerAlarmScheduler.EXTRA_GENERATION)
            ?: intent.data?.getQueryParameter(TimerAlarmScheduler.EXTRA_GENERATION)
        TimerAlarmScheduler.fire(context, timerId, generation)
    }
}
