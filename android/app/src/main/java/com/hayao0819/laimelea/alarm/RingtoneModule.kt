package com.hayao0819.laimelea.alarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.UserManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RingtoneModule.NAME)
class RingtoneModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "RingtoneModule"
        const val EXTRA_TRIGGER_TIMESTAMP_MS = "triggerTimestampMs"
        private const val VOLUME_BUTTON_EVENT = "AlarmVolumeButtonPressed"
        const val ALARM_DELIVERY_EVENT = "NativeAlarmDelivery"
        private const val SCHEDULED_AUDIO_PREFS = "scheduledAlarmAudio"
        private const val SCHEDULED_AUDIO_PREFIX = "scheduled."
        private const val PRIVATE_SCHEDULED_AUDIO_PREFS = "privateScheduledAlarmAudio"
        private const val PRIVATE_SCHEDULED_AUDIO_PREFIX = "private."
        private const val PRIVATE_SCHEDULED_AUDIO_CLEANUP_PREFIX = "privateCleanup."
        private const val PENDING_DELIVERY_PREFS = "pendingAlarmDeliveries"
        private const val PENDING_DELIVERY_PREFIX = "delivery."
        private const val ALARM_NOTIFICATION_CHANNEL_PREFIX = "alarm-firing-"
        private const val ALARM_FIRING_NOTIFICATION_ID = 7001
        private val scheduledAudioLock = Any()

        private data class PendingAlarmDelivery(
            val deliveryId: String,
            val alarmId: String,
            val timestampMs: Long,
            val autoSilenceMs: Long,
            val stopped: Boolean,
        )

        @Volatile
        private var alarmVolumeButtonBehavior: String? = null

        fun handleAlarmVolumeButton(reactContext: ReactContext?): Boolean {
            val behavior = alarmVolumeButtonBehavior ?: return false
            val activeReactContext = reactContext ?: return false
            activeReactContext.emitDeviceEvent(VOLUME_BUTTON_EVENT, behavior)
            return true
        }

        fun emitPendingAlarmDelivery(reactContext: ReactContext?, intent: Intent) {
            if (intent.action?.endsWith(".ALARM_FIRING") == true) {
                emitAlarmDelivery(reactContext)
            }
        }

        fun emitAlarmDelivery(reactContext: ReactContext?) {
            reactContext?.emitDeviceEvent(ALARM_DELIVERY_EVENT, null)
        }

        fun markAlarmAudioDispatched(context: Context, alarmId: String, timestampMs: Long) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            synchronized(scheduledAudioLock) {
                cleanupForgottenPrivateScheduledAudio(context)
                val preferences = scheduledAudioPreferences(context)
                val key = scheduledAudioKey(alarmId, timestampMs)
                val scheduled = preferences.getString(key, null)?.let(::decodeScheduledAudio)
                val editor = preferences.edit().remove(key)
                val nextTimestampMs = scheduled?.let(::nextTimestampAfterDelivery)
                if (scheduled != null && nextTimestampMs != null) {
                    val next = scheduled.copy(timestampMs = nextTimestampMs)
                    val registered = registerAlarmClock(alarmManager, context, next)
                    val storedNext = next.withRegistrationResult(registered)
                    editor.putString(
                        scheduledAudioKey(storedNext.alarmId, storedNext.timestampMs),
                        encodeScheduledAudio(storedNext),
                    )
                } else {
                    scheduled?.let { forgetPrivateScheduledAudio(context, it.alarmId) }
                }
                editor.commit()
            }
        }

        internal fun attemptAlarmClockRegistration(register: () -> Unit): Boolean =
            runCatching(register).isSuccess

        fun showAlarmFiringNotification(
            context: Context,
            alarmId: String,
            timestampMs: Long,
            label: String?,
            vibrationEnabled: Boolean,
            autoSilenceMs: Long,
        ): Boolean {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channelId = "$ALARM_NOTIFICATION_CHANNEL_PREFIX${if (vibrationEnabled) "vibrate" else "still"}"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                manager.createNotificationChannel(
                    android.app.NotificationChannel(
                        channelId,
                        "Alarm",
                        NotificationManager.IMPORTANCE_HIGH,
                    ).apply {
                        setSound(null, null)
                        enableVibration(vibrationEnabled)
                        if (vibrationEnabled) {
                            vibrationPattern = longArrayOf(300, 500, 200, 500)
                        }
                    },
                )
            }
            if (!canShowAlarmNotification(context, manager, channelId)) {
                return false
            }
            rememberPendingDelivery(context, alarmId, timestampMs, autoSilenceMs)
            val launchIntent = alarmFiringPendingIntent(
                context,
                alarmId,
                timestampMs,
            )
            val notification = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(com.hayao0819.laimelea.R.mipmap.ic_launcher)
                .setContentTitle(label?.takeIf { it.isNotBlank() }
                    ?: context.getString(com.hayao0819.laimelea.R.string.alarm_audio_title))
                .setContentText(
                    context.getString(com.hayao0819.laimelea.R.string.alarm_audio_description),
                )
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(launchIntent)
                .addAction(
                    0,
                    context.getString(com.hayao0819.laimelea.R.string.alarm_audio_stop),
                    alarmStopPendingIntent(context, alarmId, timestampMs, autoSilenceMs),
                )
                .also {
                    if (autoSilenceMs > 0) it.setTimeoutAfter(autoSilenceMs)
                }
                .apply {
                    if (
                        Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE ||
                        manager.canUseFullScreenIntent()
                    ) {
                        setFullScreenIntent(launchIntent, true)
                    }
                }
                .build()
            manager.notify(alarmId, ALARM_FIRING_NOTIFICATION_ID, notification)
            return true
        }

        private fun canShowAlarmNotification(
            context: Context,
            manager: NotificationManager,
            channelId: String,
        ): Boolean {
            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
                    PackageManager.PERMISSION_GRANTED
            ) {
                return false
            }
            if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                manager.getNotificationChannel(channelId)?.importance != NotificationManager.IMPORTANCE_NONE
        }

        fun cancelAlarmFiringNotification(
            context: Context,
            alarmId: String,
            clearPendingDelivery: Boolean = true,
        ) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel(alarmId, ALARM_FIRING_NOTIFICATION_ID)
            if (!clearPendingDelivery) return
            pendingDeliveryPreferences(context).edit()
                .also { editor ->
                    pendingDeliveryPreferences(context).all.keys
                        .filter { it.startsWith("$PENDING_DELIVERY_PREFIX$alarmId.") }
                        .forEach(editor::remove)
                }
                .apply()
        }

        fun markPendingAlarmDeliveryStopped(context: Context, alarmId: String) {
            val preferences = pendingDeliveryPreferences(context)
            val editor = preferences.edit()
            preferences.all
                .filterKeys { it.startsWith("$PENDING_DELIVERY_PREFIX$alarmId.") }
                .forEach { (key, value) ->
                    val fields = (value as? String)?.split("|", limit = 3) ?: return@forEach
                    val timestampMs = fields[0].toLongOrNull() ?: return@forEach
                    val autoSilenceMs = fields.getOrNull(1)?.toLongOrNull() ?: 0L
                    editor.putString(key, "$timestampMs|$autoSilenceMs|true")
                }
            editor.commit()
        }

        fun recordStoppedAlarmDelivery(
            context: Context,
            alarmId: String,
            timestampMs: Long,
            autoSilenceMs: Long,
        ) {
            if (timestampMs > 0) {
                rememberPendingDelivery(context, alarmId, timestampMs, autoSilenceMs, true)
            } else {
                markPendingAlarmDeliveryStopped(context, alarmId)
            }
        }

        fun recordUndeliverableAlarmDelivery(
            context: Context,
            alarmId: String,
            timestampMs: Long,
            autoSilenceMs: Long,
            stopped: Boolean,
        ) {
            rememberPendingDelivery(context, alarmId, timestampMs, autoSilenceMs, stopped)
        }

        private fun rememberPendingDelivery(
            context: Context,
            alarmId: String,
            timestampMs: Long,
            autoSilenceMs: Long,
            stopped: Boolean = false,
        ) {
            pendingDeliveryPreferences(context).edit()
                .putString(
                    pendingDeliveryKey(alarmId, timestampMs),
                    "$timestampMs|$autoSilenceMs|$stopped",
                )
                .commit()
        }

        private fun pendingDeliveryPreferences(context: Context) = context
            .createDeviceProtectedStorageContext()
            .getSharedPreferences(PENDING_DELIVERY_PREFS, Context.MODE_PRIVATE)

        private fun pendingDeliveryKey(alarmId: String, timestampMs: Long) =
            "$PENDING_DELIVERY_PREFIX$alarmId.$timestampMs"

        private fun notificationId(alarmId: String) = alarmId.hashCode() and Int.MAX_VALUE

        private fun alarmFiringAction(packageName: String) = "$packageName.ALARM_FIRING"

        internal fun alarmFiringPendingIntent(
            context: Context,
            alarmId: String,
            timestampMs: Long,
        ): PendingIntent = PendingIntent.getActivity(
            context,
            notificationId(alarmId),
            Intent(context, com.hayao0819.laimelea.MainActivity::class.java).apply {
                action = alarmFiringAction(context.packageName)
                data = Uri.Builder()
                    .scheme(context.packageName)
                    .authority("alarm")
                    .appendPath(alarmId)
                    .appendPath(timestampMs.toString())
                    .build()
                putExtra(AlarmAudioService.EXTRA_ALARM_ID, alarmId)
                putExtra(EXTRA_TRIGGER_TIMESTAMP_MS, timestampMs)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        private fun alarmStopPendingIntent(
            context: Context,
            alarmId: String,
            timestampMs: Long,
            autoSilenceMs: Long,
        ): PendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId(alarmId),
            Intent(context, AlarmAudioReceiver::class.java).apply {
                action = "${context.packageName}.ALARM_STOP.$alarmId.$timestampMs"
                putExtra(AlarmAudioService.EXTRA_ALARM_ID, alarmId)
                putExtra(EXTRA_TRIGGER_TIMESTAMP_MS, timestampMs)
                putExtra(AlarmAudioService.EXTRA_AUTO_SILENCE_MS, autoSilenceMs)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        fun isAlarmStopIntent(intent: Intent): Boolean =
            intent.action?.contains(".ALARM_STOP.") == true

        internal fun shouldStartAlarmAudio(soundUri: String?): Boolean = soundUri != "__silent__"

        private fun registerAlarmClock(
            alarmManager: AlarmManager,
            context: Context,
            scheduled: ScheduledAudio,
        ): Boolean = attemptAlarmClockRegistration {
            alarmManager.setAlarmClock(
                AlarmManager.AlarmClockInfo(
                    scheduled.timestampMs,
                    alarmClockShowIntent(context),
                ),
                alarmAudioPendingIntent(context, scheduled),
            )
        }

        fun rescheduleAlarmAudio(context: Context, adjustWallClockAlarms: Boolean = false) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            synchronized(scheduledAudioLock) {
                cleanupForgottenPrivateScheduledAudio(context)
                val preferences = scheduledAudioPreferences(context)
                val entries = preferences.all
                    .filterKeys { it.startsWith(SCHEDULED_AUDIO_PREFIX) }
                    .mapNotNull { (key, value) ->
                        (value as? String)?.let(::decodeScheduledAudio)?.let { key to it }
                    }
                val editor = preferences.edit()
                entries.forEach { (key, stored) ->
                    runCatching {
                        val timestampMs = when {
                            adjustWallClockAlarms && stored.rescheduleAtLocalTime -> adjustedTimestamp(stored)
                            stored.timestampMs <= System.currentTimeMillis() -> nextTimestampAfterMissedAlarm(stored)
                            else -> stored.timestampMs
                        }
                        val scheduled = timestampMs?.let { timestamp -> stored.copy(timestampMs = timestamp) }
                        if (scheduled != stored) {
                            val oldPendingIntent = alarmAudioPendingIntent(context, stored)
                            alarmManager.cancel(oldPendingIntent)
                            oldPendingIntent.cancel()
                            editor.remove(key)
                        }
                        if (scheduled == null) {
                            forgetPrivateScheduledAudio(context, stored.alarmId)
                        }
                        scheduled?.takeIf { it.timestampMs > System.currentTimeMillis() }?.let { pending ->
                            val registered = registerAlarmClock(alarmManager, context, pending)
                            val persisted = pending.withRegistrationResult(registered)
                            editor.putString(
                                scheduledAudioKey(persisted.alarmId, persisted.timestampMs),
                                encodeScheduledAudio(persisted),
                            )
                        }
                    }.onFailure {
                        editor.putString(key, encodeScheduledAudio(stored.withRegistrationResult(false)))
                    }
                }
                editor.commit()
            }
        }

        internal fun migrateLegacyScheduledAudio(
            context: Context,
            alarmManager: AlarmManager,
            alarmId: String,
        ) {
            val preferences = context.getSharedPreferences(SCHEDULED_AUDIO_PREFS, Context.MODE_PRIVATE)
            val timestamps = preferences.getStringSet(alarmId, emptySet()).orEmpty()
                .mapNotNull(String::toLongOrNull)
            timestamps.forEach { timestampMs ->
                val pendingIntent = alarmAudioPendingIntent(context, alarmId, timestampMs)
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
            if (timestamps.isNotEmpty()) {
                preferences.edit().remove(alarmId).apply()
            }
        }

        internal fun alarmAudioPendingIntent(
            context: Context,
            alarmId: String,
            timestampMs: Long,
            soundUri: String? = null,
            gradualDurationMs: Long = 0L,
            autoSilenceMs: Long = 0L,
            rescheduleAtLocalTime: Boolean = false,
            repeatType: String? = null,
            repeatWeekdays: List<Int> = emptyList(),
            repeatIntervalMs: Long = 0L,
            label: String? = null,
            vibrationEnabled: Boolean = true,
        ): PendingIntent = alarmAudioPendingIntent(
            context,
            ScheduledAudio.fromTimestamp(
                alarmId,
                timestampMs,
                soundUri,
                gradualDurationMs,
                autoSilenceMs,
                rescheduleAtLocalTime,
                repeatType,
                repeatWeekdays,
                repeatIntervalMs,
                label,
                vibrationEnabled,
            ),
        )

        private fun alarmAudioPendingIntent(
            context: Context,
            scheduled: ScheduledAudio,
        ): PendingIntent {
            val restored = restorePrivateScheduledAudio(context, scheduled)
            val intent = Intent(context, AlarmAudioReceiver::class.java).apply {
                action = "${context.packageName}.ALARM_AUDIO.${restored.alarmId}.${restored.timestampMs}"
                putExtra(AlarmAudioService.EXTRA_ALARM_ID, restored.alarmId)
                putExtra(EXTRA_TRIGGER_TIMESTAMP_MS, restored.timestampMs)
                putExtra(AlarmAudioService.EXTRA_SOUND_URI, restored.soundUri)
                putExtra(AlarmAudioService.EXTRA_GRADUAL_DURATION_MS, restored.gradualDurationMs)
                putExtra(AlarmAudioService.EXTRA_AUTO_SILENCE_MS, restored.autoSilenceMs)
                putExtra(AlarmAudioService.EXTRA_LABEL, restored.label)
                putExtra(AlarmAudioService.EXTRA_VIBRATION_ENABLED, restored.vibrationEnabled)
            }
            return PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        private fun alarmClockShowIntent(context: Context): PendingIntent = PendingIntent.getActivity(
            context,
            0,
            Intent(context, com.hayao0819.laimelea.MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        private fun scheduledAudioPreferences(context: Context) = context
            .createDeviceProtectedStorageContext()
            .getSharedPreferences(SCHEDULED_AUDIO_PREFS, Context.MODE_PRIVATE)

        private fun privateScheduledAudioPreferences(context: Context) = context
            .getSharedPreferences(PRIVATE_SCHEDULED_AUDIO_PREFS, Context.MODE_PRIVATE)

        private fun privateScheduledAudioKey(alarmId: String): String =
            "$PRIVATE_SCHEDULED_AUDIO_PREFIX$alarmId"

        private fun privateScheduledAudioCleanupKey(alarmId: String): String =
            "$PRIVATE_SCHEDULED_AUDIO_CLEANUP_PREFIX$alarmId"

        private fun isUserUnlocked(context: Context): Boolean =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.N ||
                context.getSystemService(UserManager::class.java)?.isUserUnlocked != false

        private fun encodePrivateScheduledAudio(scheduled: ScheduledAudio): String = listOf(
            android.util.Base64.encodeToString(
                scheduled.soundUri.orEmpty().toByteArray(Charsets.UTF_8),
                android.util.Base64.NO_WRAP,
            ),
            android.util.Base64.encodeToString(
                scheduled.label.orEmpty().toByteArray(Charsets.UTF_8),
                android.util.Base64.NO_WRAP,
            ),
        ).joinToString("|")

        private fun decodePrivateScheduledAudio(value: String): Pair<String?, String?>? {
            val fields = value.split("|", limit = 2)
            if (fields.size != 2) return null
            return runCatching {
                val soundUri = String(
                    android.util.Base64.decode(fields[0], android.util.Base64.NO_WRAP),
                    Charsets.UTF_8,
                ).takeIf { it.isNotEmpty() }
                val label = String(
                    android.util.Base64.decode(fields[1], android.util.Base64.NO_WRAP),
                    Charsets.UTF_8,
                ).takeIf { it.isNotEmpty() }
                soundUri to label
            }.getOrNull()
        }

        internal fun rememberPrivateScheduledAudio(context: Context, scheduled: ScheduledAudio) {
            if (!isUserUnlocked(context)) return
            privateScheduledAudioPreferences(context).edit()
                .putString(privateScheduledAudioKey(scheduled.alarmId), encodePrivateScheduledAudio(scheduled))
                .apply()
        }

        internal fun forgetPrivateScheduledAudio(
            context: Context,
            alarmId: String,
            userUnlocked: Boolean = isUserUnlocked(context),
        ) {
            if (!userUnlocked) {
                scheduledAudioPreferences(context).edit()
                    .putBoolean(privateScheduledAudioCleanupKey(alarmId), true)
                    .apply()
                return
            }
            privateScheduledAudioPreferences(context).edit()
                .remove(privateScheduledAudioKey(alarmId))
                .apply()
            scheduledAudioPreferences(context).edit()
                .remove(privateScheduledAudioCleanupKey(alarmId))
                .apply()
        }

        private fun cleanupForgottenPrivateScheduledAudio(context: Context) {
            if (!isUserUnlocked(context)) return
            scheduledAudioPreferences(context).all.keys
                .filter { it.startsWith(PRIVATE_SCHEDULED_AUDIO_CLEANUP_PREFIX) }
                .map { it.removePrefix(PRIVATE_SCHEDULED_AUDIO_CLEANUP_PREFIX) }
                .forEach {
                    forgetPrivateScheduledAudio(context, it, userUnlocked = true)
                }
        }

        internal fun restorePrivateScheduledAudio(
            context: Context,
            scheduled: ScheduledAudio,
            userUnlocked: Boolean = isUserUnlocked(context),
        ): ScheduledAudio {
            val fallbackSoundUri = scheduled.soundUriForMode()
            if (!userUnlocked) return scheduled.copy(soundUri = fallbackSoundUri, label = null)
            val privateAudio = privateScheduledAudioPreferences(context)
                .getString(privateScheduledAudioKey(scheduled.alarmId), null)
                ?.let(::decodePrivateScheduledAudio)
            return scheduled.copy(
                soundUri = privateAudio?.first ?: fallbackSoundUri,
                label = privateAudio?.second,
            )
        }

        private fun scheduledAudioKey(alarmId: String, timestampMs: Long): String =
            "$SCHEDULED_AUDIO_PREFIX$alarmId.$timestampMs"

        internal fun encodeScheduledAudio(scheduled: ScheduledAudio): String = listOf(
            scheduled.alarmId,
            scheduled.timestampMs.toString(),
            scheduled.gradualDurationMs.toString(),
            scheduled.autoSilenceMs.toString(),
            scheduled.localYear.toString(),
            scheduled.localMonth.toString(),
            scheduled.localDay.toString(),
            scheduled.localHour.toString(),
            scheduled.localMinute.toString(),
            scheduled.rescheduleAtLocalTime.toString(),
            scheduled.repeatType.orEmpty(),
            scheduled.repeatWeekdays.joinToString(","),
            scheduled.repeatIntervalMs.toString(),
            "",
            "",
            scheduled.vibrationEnabled.toString(),
            scheduled.soundMode,
            scheduled.registrationPending.toString(),
        ).joinToString("|")

        internal fun decodeScheduledAudio(value: String): ScheduledAudio? {
            val fields = value.split("|", limit = 18)
            if (fields.size !in 14..18) return null
            val timestampMs = fields[1].toLongOrNull() ?: return null
            val gradualDurationMs = fields[2].toLongOrNull() ?: return null
            val autoSilenceMs = fields[3].toLongOrNull() ?: return null
            val localYear = fields[4].toIntOrNull() ?: return null
            val localMonth = fields[5].toIntOrNull() ?: return null
            val localDay = fields[6].toIntOrNull() ?: return null
            val localHour = fields[7].toIntOrNull() ?: return null
            val localMinute = fields[8].toIntOrNull() ?: return null
            val rescheduleAtLocalTime = fields[9].toBooleanStrictOrNull() ?: return null
            val repeatWeekdays = fields[11].takeIf { it.isNotEmpty() }
                ?.split(",")
                ?.mapNotNull(String::toIntOrNull)
                .orEmpty()
            val repeatIntervalMs = fields[12].toLongOrNull() ?: return null
            val vibrationEnabled = fields.getOrNull(15)?.toBooleanStrictOrNull() ?: true
            val soundMode = fields.getOrNull(16)?.takeIf { it in setOf("silent", "default", "custom") }
                ?: "default"
            val registrationPending = fields.getOrNull(17)?.toBooleanStrictOrNull() ?: false
            return ScheduledAudio(
                fields[0],
                timestampMs,
                null,
                gradualDurationMs,
                autoSilenceMs,
                localYear,
                localMonth,
                localDay,
                localHour,
                localMinute,
                rescheduleAtLocalTime,
                fields[10].takeIf { it.isNotEmpty() },
                repeatWeekdays,
                repeatIntervalMs,
                null,
                vibrationEnabled,
                soundMode,
                registrationPending,
            )
        }

        private fun adjustedTimestamp(scheduled: ScheduledAudio): Long? {
            val calendar = java.util.Calendar.getInstance().apply {
                set(java.util.Calendar.HOUR_OF_DAY, scheduled.localHour)
                set(java.util.Calendar.MINUTE, scheduled.localMinute)
                set(java.util.Calendar.SECOND, 0)
                set(java.util.Calendar.MILLISECOND, 0)
            }
            if (scheduled.repeatType == "weekdays" && scheduled.repeatWeekdays.isNotEmpty()) {
                return nextWeekdayTimestamp(
                    scheduled.localHour,
                    scheduled.localMinute,
                    scheduled.repeatWeekdays,
                )
            }
            if (scheduled.repeatType != null) return scheduled.timestampMs
            calendar.set(java.util.Calendar.YEAR, scheduled.localYear)
            calendar.set(java.util.Calendar.MONTH, scheduled.localMonth)
            calendar.set(java.util.Calendar.DAY_OF_MONTH, scheduled.localDay)
            return calendar.timeInMillis.takeIf { it > System.currentTimeMillis() }
        }

        private fun nextTimestampAfterMissedAlarm(scheduled: ScheduledAudio): Long? = when (
            scheduled.repeatType
        ) {
            "weekdays" -> nextWeekdayTimestamp(
                scheduled.localHour,
                scheduled.localMinute,
                scheduled.repeatWeekdays,
            )
            "interval", "customCycleInterval" -> nextIntervalTimestamp(
                scheduled.timestampMs,
                scheduled.repeatIntervalMs,
            )
            else -> null
        }

        private fun nextTimestampAfterDelivery(scheduled: ScheduledAudio): Long? = when (
            scheduled.repeatType
        ) {
            "weekdays" -> nextWeekdayTimestamp(
                scheduled.localHour,
                scheduled.localMinute,
                scheduled.repeatWeekdays,
            )
            "interval", "customCycleInterval" -> nextIntervalTimestamp(
                scheduled.timestampMs,
                scheduled.repeatIntervalMs,
            )
            else -> null
        }

        internal fun nextIntervalTimestamp(
            timestampMs: Long,
            intervalMs: Long,
            now: Long = System.currentTimeMillis(),
        ): Long? {
            if (intervalMs <= 0) return null
            val missedIntervals = ((now - timestampMs) / intervalMs) + 1
            return timestampMs + missedIntervals * intervalMs
        }

        internal fun nextWeekdayTimestamp(
            hour: Int,
            minute: Int,
            weekdays: List<Int>,
        ): Long? {
            val calendar = java.util.Calendar.getInstance().apply {
                set(java.util.Calendar.HOUR_OF_DAY, hour)
                set(java.util.Calendar.MINUTE, minute)
                set(java.util.Calendar.SECOND, 0)
                set(java.util.Calendar.MILLISECOND, 0)
            }
            repeat(8) {
                val weekday = (calendar.get(java.util.Calendar.DAY_OF_WEEK) + 6) % 7
                if (weekday in weekdays && calendar.timeInMillis > System.currentTimeMillis()) {
                    return calendar.timeInMillis
                }
                calendar.add(java.util.Calendar.DAY_OF_YEAR, 1)
            }
            return null
        }

        internal data class ScheduledAudio(
            val alarmId: String,
            val timestampMs: Long,
            val soundUri: String?,
            val gradualDurationMs: Long,
            val autoSilenceMs: Long,
            val localYear: Int,
            val localMonth: Int,
            val localDay: Int,
            val localHour: Int,
            val localMinute: Int,
            val rescheduleAtLocalTime: Boolean,
            val repeatType: String?,
            val repeatWeekdays: List<Int>,
            val repeatIntervalMs: Long,
            val label: String?,
            val vibrationEnabled: Boolean,
            val soundMode: String = when (soundUri) {
                "__silent__" -> "silent"
                null, "default" -> "default"
                else -> "custom"
            },
            val registrationPending: Boolean = false,
        ) {
            fun soundUriForMode(): String? = when (soundMode) {
                "silent" -> "__silent__"
                else -> null
            }

            fun withRegistrationResult(registered: Boolean): ScheduledAudio =
                copy(registrationPending = !registered)

            companion object {
                fun fromTimestamp(
                    alarmId: String,
                    timestampMs: Long,
                    soundUri: String?,
                    gradualDurationMs: Long,
                    autoSilenceMs: Long,
                    rescheduleAtLocalTime: Boolean,
                    repeatType: String?,
                    repeatWeekdays: List<Int>,
                    repeatIntervalMs: Long,
                    label: String?,
                    vibrationEnabled: Boolean,
                ): ScheduledAudio {
                    val calendar = java.util.Calendar.getInstance().apply { timeInMillis = timestampMs }
                    return ScheduledAudio(
                        alarmId,
                        timestampMs,
                        soundUri,
                        gradualDurationMs,
                        autoSilenceMs,
                        calendar.get(java.util.Calendar.YEAR),
                        calendar.get(java.util.Calendar.MONTH),
                        calendar.get(java.util.Calendar.DAY_OF_MONTH),
                        calendar.get(java.util.Calendar.HOUR_OF_DAY),
                        calendar.get(java.util.Calendar.MINUTE),
                        rescheduleAtLocalTime,
                        repeatType,
                        repeatWeekdays,
                        repeatIntervalMs,
                        label,
                        vibrationEnabled,
                    )
                }
            }
        }
    }

    private var currentPlayer: MediaPlayer? = null

    override fun getName(): String = NAME

    @ReactMethod
    fun getAlarmRingtones(promise: Promise) {
        try {
            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                reactApplicationContext.checkSelfPermission(android.Manifest.permission.READ_MEDIA_AUDIO) !=
                    PackageManager.PERMISSION_GRANTED
            ) {
                promise.resolve(Arguments.createArray())
                return
            }
            val rm = RingtoneManager(reactApplicationContext)
            rm.setType(RingtoneManager.TYPE_ALARM)

            val cursor = rm.cursor
            val result = Arguments.createArray()

            while (cursor.moveToNext()) {
                val title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX)
                val uri = rm.getRingtoneUri(cursor.position).toString()

                val map = Arguments.createMap()
                map.putString("title", title)
                map.putString("uri", uri)
                result.pushMap(map)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to get alarm ringtones", e)
        }
    }

    @ReactMethod
    fun playRingtone(uri: String, promise: Promise) {
        try {
            startPlaybackOrDefault(uri, false, 1f)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to play ringtone", e)
        }
    }

    @ReactMethod
    fun playAlarmSound(uri: String?, volume: Double, promise: Promise) {
        try {
            startPlaybackOrDefault(uri, true, volume.toFloat().coerceIn(0f, 1f))
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to play alarm sound", e)
        }
    }

    @ReactMethod
    fun setAlarmVolume(volume: Double, promise: Promise) {
        try {
            val clampedVolume = volume.toFloat().coerceIn(0f, 1f)
            if (!AlarmAudioService.setActiveVolume(clampedVolume)) {
                currentPlayer?.setVolume(clampedVolume, clampedVolume)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to set alarm volume", e)
        }
    }

    @ReactMethod
    fun stopRingtone(promise: Promise) {
        try {
            stopCurrentPlayback()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to stop ringtone", e)
        }
    }

    @ReactMethod
    fun stopAlarmSound(alarmId: String, promise: Promise) {
        try {
            AlarmAudioService.stopActivePlayback(alarmId)
            cancelAlarmFiringNotification(reactApplicationContext, alarmId, false)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to stop alarm sound", e)
        }
    }

    @ReactMethod
    fun setAlarmVolumeButtonBehavior(behavior: String?, promise: Promise) {
        if (behavior != null && behavior != "snooze" && behavior != "dismiss") {
            promise.reject("RINGTONE_ERROR", "Unsupported volume button behavior")
            return
        }
        alarmVolumeButtonBehavior = behavior
        promise.resolve(null)
    }

    @ReactMethod
    fun getDefaultAlarmUri(promise: Promise) {
        try {
            val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            promise.resolve(defaultUri?.toString())
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to get default alarm URI", e)
        }
    }

    @ReactMethod
    fun scheduleAlarmAudio(
        alarmId: String,
        timestampMs: Double,
        soundUri: String?,
        gradualDurationMs: Double,
        autoSilenceMs: Double,
        rescheduleAtLocalTime: Boolean,
        repeatType: String?,
        repeatWeekdays: ReadableArray?,
        repeatIntervalMs: Double,
        label: String?,
        vibrationEnabled: Boolean,
        promise: Promise,
    ) {
        try {
            val alarmManager =
                reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            migrateLegacyScheduledAudio(reactApplicationContext, alarmManager, alarmId)
            val timestamp = timestampMs.toLong()
            cancelScheduledAlarmAudio(alarmManager, alarmId)
            val scheduled = ScheduledAudio.fromTimestamp(
                alarmId,
                timestamp,
                soundUri,
                gradualDurationMs.toLong(),
                autoSilenceMs.toLong(),
                rescheduleAtLocalTime,
                repeatType,
                repeatWeekdays?.toArrayList()?.mapNotNull { (it as? Double)?.toInt() }.orEmpty(),
                repeatIntervalMs.toLong(),
                label,
                vibrationEnabled,
            )
            try {
                rememberScheduledAudio(scheduled)
                val pendingIntent = alarmAudioPendingIntent(reactApplicationContext, scheduled)
                alarmManager.setAlarmClock(
                    AlarmManager.AlarmClockInfo(timestamp, alarmClockShowIntent(reactApplicationContext)),
                    pendingIntent,
                )
            } catch (e: Exception) {
                forgetScheduledAudio(alarmId, timestamp)
                throw e
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to schedule alarm audio", e)
        }
    }

    @ReactMethod
    fun cancelAlarmAudio(alarmId: String, promise: Promise) {
        try {
            val alarmManager =
                reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            cancelScheduledAlarmAudio(alarmManager, alarmId)
            migrateLegacyScheduledAudio(reactApplicationContext, alarmManager, alarmId)
            val legacyPendingIntent = legacyAlarmAudioPendingIntent(alarmId)
            alarmManager.cancel(legacyPendingIntent)
            legacyPendingIntent.cancel()
            AlarmAudioService.stopActivePlayback(alarmId)
            cancelAlarmFiringNotification(reactApplicationContext, alarmId)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to cancel alarm audio", e)
        }
    }

    @ReactMethod
    fun getAlarmCapabilities(promise: Promise) {
        try {
            val alarmManager =
                reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val notificationManager =
                reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val result = Arguments.createMap()
            result.putBoolean(
                "canScheduleExactAlarms",
                Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms(),
            )
            result.putBoolean(
                "canUseFullScreenIntent",
                Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE ||
                    notificationManager.canUseFullScreenIntent(),
            )
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to get alarm capabilities", e)
        }
    }

    @ReactMethod
    fun consumeAlarmDeliveries(promise: Promise) {
        try {
            val userManager = reactApplicationContext.getSystemService(UserManager::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && userManager?.isUserUnlocked == false) {
                promise.resolve(Arguments.createArray())
                return
            }
            val preferences = pendingDeliveryPreferences(reactApplicationContext)
            val deliveries = preferences.all
                .filterKeys { it.startsWith(PENDING_DELIVERY_PREFIX) }
                .mapNotNull { (key, value) ->
                    val fields = (value as? String)?.split("|", limit = 3)
                        ?: return@mapNotNull null
                    val timestampMs = fields[0].toLongOrNull() ?: return@mapNotNull null
                    val autoSilenceMs = fields.getOrNull(1)?.toLongOrNull() ?: 0L
                    val stopped = fields.getOrNull(2)?.toBooleanStrictOrNull() ?: false
                    val alarmId = key.removePrefix(PENDING_DELIVERY_PREFIX)
                        .substringBeforeLast('.', missingDelimiterValue = "")
                        .takeIf { it.isNotEmpty() }
                        ?: return@mapNotNull null
                    PendingAlarmDelivery(key, alarmId, timestampMs, autoSilenceMs, stopped)
                }
                .sortedWith(compareBy<PendingAlarmDelivery> { it.timestampMs }.thenBy { it.deliveryId })
            val result = Arguments.createArray()
            deliveries.forEach { delivery ->
                result.pushMap(Arguments.createMap().apply {
                    putString("deliveryId", delivery.deliveryId)
                    putString("alarmId", delivery.alarmId)
                    putDouble("occurrenceTimestampMs", delivery.timestampMs.toDouble())
                    putDouble("autoSilenceMs", delivery.autoSilenceMs.toDouble())
                    putBoolean("stopped", delivery.stopped)
                })
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to read pending alarm deliveries", e)
        }
    }

    @ReactMethod
    fun acknowledgeAlarmDeliveries(deliveryIds: ReadableArray, promise: Promise) {
        try {
            val editor = pendingDeliveryPreferences(reactApplicationContext).edit()
            deliveryIds.toArrayList()
                .mapNotNull { it as? String }
                .filter { it.startsWith(PENDING_DELIVERY_PREFIX) }
                .forEach(editor::remove)
            editor.apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to acknowledge alarm deliveries", e)
        }
    }

    @ReactMethod
    fun openFullScreenIntentSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                    data = Uri.parse("package:${reactApplicationContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to open full-screen intent settings", e)
        }
    }

    override fun invalidate() {
        alarmVolumeButtonBehavior = null
        stopCurrentPlayback()
        super.invalidate()
    }

    private fun startPlayback(uri: String?, loop: Boolean, volume: Float) {
        stopCurrentPlayback()
        val ringtoneUri = when (uri) {
            null, "default" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            else -> Uri.parse(uri)
        } ?: throw IllegalStateException("No default alarm ringtone is configured")
        val nextPlayer = MediaPlayer()
        try {
            nextPlayer.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            nextPlayer.setDataSource(reactApplicationContext, ringtoneUri)
            nextPlayer.isLooping = loop
            nextPlayer.setVolume(volume, volume)
            nextPlayer.prepare()
            nextPlayer.start()
            currentPlayer = nextPlayer
        } catch (e: Exception) {
            nextPlayer.release()
            throw e
        }
    }

    private fun startPlaybackOrDefault(uri: String?, loop: Boolean, volume: Float) {
        try {
            startPlayback(uri, loop, volume)
        } catch (error: Exception) {
            if (uri == null || uri == "default") throw error
            startPlayback(null, loop, volume)
        }
    }

    private fun stopCurrentPlayback() {
        currentPlayer?.let { player ->
            runCatching { if (player.isPlaying) player.stop() }
            runCatching { player.release() }
        }
        currentPlayer = null
    }

    private fun legacyAlarmAudioPendingIntent(alarmId: String): PendingIntent {
        val intent = Intent(reactApplicationContext, AlarmAudioReceiver::class.java).apply {
            action = "${reactApplicationContext.packageName}.ALARM_AUDIO.$alarmId"
        }
        return PendingIntent.getBroadcast(
            reactApplicationContext,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun cancelScheduledAlarmAudio(alarmManager: AlarmManager, alarmId: String) {
        synchronized(scheduledAudioLock) {
            val preferences = scheduledAudioPreferences(reactApplicationContext)
            val scheduled = preferences.all
                .filterKeys { it.startsWith(SCHEDULED_AUDIO_PREFIX) }
                .mapNotNull { (key, value) ->
                    (value as? String)?.let(::decodeScheduledAudio)?.takeIf { it.alarmId == alarmId }?.let {
                        key to it
                    }
                }
            val editor = preferences.edit()
            scheduled.forEach { (key, entry) ->
                val pendingIntent = alarmAudioPendingIntent(reactApplicationContext, entry)
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
                editor.remove(key)
            }
            editor.apply()
            forgetPrivateScheduledAudio(reactApplicationContext, alarmId)
        }
    }

    private fun rememberScheduledAudio(scheduled: ScheduledAudio) {
        synchronized(scheduledAudioLock) {
            rememberPrivateScheduledAudio(reactApplicationContext, scheduled)
            check(scheduledAudioPreferences(reactApplicationContext).edit()
                .putString(scheduledAudioKey(scheduled.alarmId, scheduled.timestampMs), encodeScheduledAudio(scheduled))
                .commit())
        }
    }

    private fun forgetScheduledAudio(alarmId: String, timestampMs: Long) {
        synchronized(scheduledAudioLock) {
            scheduledAudioPreferences(reactApplicationContext)
                .edit()
                .remove(scheduledAudioKey(alarmId, timestampMs))
                .apply()
            forgetPrivateScheduledAudio(reactApplicationContext, alarmId)
        }
    }

}
