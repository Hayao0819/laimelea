package com.hayao0819.laimelea.alarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RingtoneModule.NAME)
class RingtoneModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "RingtoneModule"
        const val EXTRA_TRIGGER_TIMESTAMP_MS = "triggerTimestampMs"
        private const val VOLUME_BUTTON_EVENT = "AlarmVolumeButtonPressed"
        private const val SCHEDULED_AUDIO_PREFS = "scheduledAlarmAudio"
        private val scheduledAudioLock = Any()

        @Volatile
        private var alarmVolumeButtonBehavior: String? = null

        fun handleAlarmVolumeButton(reactContext: ReactContext?): Boolean {
            val behavior = alarmVolumeButtonBehavior ?: return false
            val activeReactContext = reactContext ?: return false
            activeReactContext.emitDeviceEvent(VOLUME_BUTTON_EVENT, behavior)
            return true
        }

        fun markAlarmAudioDispatched(context: Context, alarmId: String, timestampMs: Long) {
            synchronized(scheduledAudioLock) {
                val preferences = context.getSharedPreferences(SCHEDULED_AUDIO_PREFS, Context.MODE_PRIVATE)
                val scheduled = preferences.getStringSet(alarmId, emptySet()).orEmpty().toMutableSet()
                scheduled.remove(timestampMs.toString())
                preferences.edit().putStringSet(alarmId, scheduled).apply()
            }
        }
    }

    private var currentPlayer: MediaPlayer? = null

    override fun getName(): String = NAME

    @ReactMethod
    fun getAlarmRingtones(promise: Promise) {
        try {
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
            startPlayback(uri, false, 1f)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to play ringtone", e)
        }
    }

    @ReactMethod
    fun playAlarmSound(uri: String?, volume: Double, promise: Promise) {
        try {
            startPlayback(uri, true, volume.toFloat().coerceIn(0f, 1f))
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
        promise: Promise,
    ) {
        try {
            if (soundUri == "__silent__") {
                cancelAlarmAudio(alarmId, promise)
                return
            }
            val alarmManager =
                reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val timestamp = timestampMs.toLong()
            val pendingIntent = alarmAudioPendingIntent(
                alarmId,
                timestamp,
                soundUri,
                gradualDurationMs,
                autoSilenceMs,
            )
            rememberScheduledAudio(alarmId, timestamp)
            try {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    timestamp,
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
            for (timestamp in getScheduledAudioTimestamps(alarmId)) {
                val pendingIntent = alarmAudioPendingIntent(
                    alarmId,
                    timestamp,
                    null,
                    0.0,
                    0.0,
                )
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
            val legacyPendingIntent = legacyAlarmAudioPendingIntent(alarmId)
            alarmManager.cancel(legacyPendingIntent)
            legacyPendingIntent.cancel()
            clearScheduledAudio(alarmId)
            AlarmAudioService.stopActivePlayback(alarmId)
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

    private fun stopCurrentPlayback() {
        currentPlayer?.let { player ->
            runCatching { if (player.isPlaying) player.stop() }
            runCatching { player.release() }
        }
        currentPlayer = null
    }

    private fun alarmAudioPendingIntent(
        alarmId: String,
        timestampMs: Long,
        soundUri: String?,
        gradualDurationMs: Double,
        autoSilenceMs: Double,
    ): PendingIntent {
        val intent = Intent(reactApplicationContext, AlarmAudioReceiver::class.java).apply {
            action = "${reactApplicationContext.packageName}.ALARM_AUDIO.$alarmId.$timestampMs"
            putExtra(AlarmAudioService.EXTRA_ALARM_ID, alarmId)
            putExtra(EXTRA_TRIGGER_TIMESTAMP_MS, timestampMs)
            putExtra(AlarmAudioService.EXTRA_SOUND_URI, soundUri)
            putExtra(AlarmAudioService.EXTRA_GRADUAL_DURATION_MS, gradualDurationMs.toLong())
            putExtra(AlarmAudioService.EXTRA_AUTO_SILENCE_MS, autoSilenceMs.toLong())
        }
        return PendingIntent.getBroadcast(
            reactApplicationContext,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
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

    private fun getScheduledAudioTimestamps(alarmId: String): Set<Long> {
        return synchronized(scheduledAudioLock) {
            reactApplicationContext
                .getSharedPreferences(SCHEDULED_AUDIO_PREFS, Context.MODE_PRIVATE)
                .getStringSet(alarmId, emptySet())
                .orEmpty()
                .mapNotNull(String::toLongOrNull)
                .toSet()
        }
    }

    private fun rememberScheduledAudio(alarmId: String, timestampMs: Long) {
        synchronized(scheduledAudioLock) {
            val preferences = reactApplicationContext.getSharedPreferences(
                SCHEDULED_AUDIO_PREFS,
                Context.MODE_PRIVATE,
            )
            val scheduled = preferences.getStringSet(alarmId, emptySet()).orEmpty().toMutableSet()
            scheduled.add(timestampMs.toString())
            check(preferences.edit().putStringSet(alarmId, scheduled).commit())
        }
    }

    private fun forgetScheduledAudio(alarmId: String, timestampMs: Long) {
        synchronized(scheduledAudioLock) {
            val preferences = reactApplicationContext.getSharedPreferences(
                SCHEDULED_AUDIO_PREFS,
                Context.MODE_PRIVATE,
            )
            val scheduled = preferences.getStringSet(alarmId, emptySet()).orEmpty().toMutableSet()
            scheduled.remove(timestampMs.toString())
            preferences.edit().putStringSet(alarmId, scheduled).apply()
        }
    }

    private fun clearScheduledAudio(alarmId: String) {
        synchronized(scheduledAudioLock) {
            reactApplicationContext
                .getSharedPreferences(SCHEDULED_AUDIO_PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(alarmId)
                .apply()
        }
    }
}
