package com.hayao0819.laimelea.alarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.facebook.react.ReactApplication

class AlarmAudioService : Service() {

    companion object {
        const val EXTRA_ALARM_ID = "alarmId"
        const val EXTRA_SOUND_URI = "soundUri"
        const val EXTRA_GRADUAL_DURATION_MS = "gradualDurationMs"
        const val EXTRA_AUTO_SILENCE_MS = "autoSilenceMs"
        const val EXTRA_LABEL = "label"
        const val EXTRA_VIBRATION_ENABLED = "vibrationEnabled"
        const val EXTRA_UI_REACHABLE = "uiReachable"
        private const val CHANNEL_ID = "alarm-audio-playback"
        private const val FOREGROUND_NOTIFICATION_ID = 9001
        private const val STEP_INTERVAL_MS = 500L

        // AOSP DeskClock's default auto-silence duration; used as a ceiling so audio started
        // without a reachable stop UI (background-activity-launch restrictions can silently
        // drop the fallback startActivity on API 29+) can't ring forever.
        internal const val FALLBACK_MAX_RING_DURATION_MS = 15 * 60 * 1000L

        private var activeService: AlarmAudioService? = null

        fun setActiveVolume(volume: Float): Boolean {
            val service = activeService ?: return false
            service.setVolume(volume)
            return true
        }

        fun stopActivePlayback(alarmId: String? = null, timestampMs: Long? = null) {
            activeService?.stopPlayback(alarmId, timestampMs)
        }

        internal data class ActivePlaybackDescriptor(
            val alarmId: String,
            val timestampMs: Long,
            val autoSilenceMs: Long,
        )

        internal fun activePlaybackDescriptors(): List<ActivePlaybackDescriptor> =
            activeService?.activePlaybacks?.values?.map {
                ActivePlaybackDescriptor(it.alarmId, it.timestampMs, it.autoSilenceMs)
            }.orEmpty()

        internal fun matchesPlayback(
            activeAlarmId: String,
            activeTimestampMs: Long,
            alarmId: String?,
            timestampMs: Long?,
        ): Boolean =
            (alarmId == null || activeAlarmId == alarmId) &&
                (timestampMs == null || activeTimestampMs == timestampMs)

        internal fun shouldReplacePlayback(activeAlarmId: String, nextAlarmId: String): Boolean =
            activeAlarmId == nextAlarmId

        internal fun effectiveAutoSilenceMs(requestedAutoSilenceMs: Long, uiReachable: Boolean): Long =
            if (uiReachable || requestedAutoSilenceMs in 1..FALLBACK_MAX_RING_DURATION_MS) {
                requestedAutoSilenceMs
            } else {
                FALLBACK_MAX_RING_DURATION_MS
            }
    }

    private data class ActivePlayback(
        val alarmId: String,
        val timestampMs: Long,
        val autoSilenceMs: Long,
        val startId: Int,
        var player: MediaPlayer? = null,
        var gradualRunnable: Runnable? = null,
        var autoSilenceRunnable: Runnable? = null,
    )

    private val handler = Handler(Looper.getMainLooper())
    private val activePlaybacks = mutableMapOf<String, ActivePlayback>()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val alarmId = intent?.getStringExtra(EXTRA_ALARM_ID) ?: run {
            stopSelf()
            return START_NOT_STICKY
        }
        val occurrenceTimestampMs = intent.getLongExtra(RingtoneModule.EXTRA_TRIGGER_TIMESTAMP_MS, 0L)
        val playback = ActivePlayback(
            alarmId = alarmId,
            timestampMs = occurrenceTimestampMs,
            autoSilenceMs = effectiveAutoSilenceMs(
                intent.getLongExtra(EXTRA_AUTO_SILENCE_MS, 0L),
                intent.getBooleanExtra(EXTRA_UI_REACHABLE, true),
            ),
            startId = startId,
        )
        val key = playbackKey(alarmId, occurrenceTimestampMs)

        activePlaybacks.remove(key)?.let(::releasePlayback)
        activePlaybacks[key] = playback
        activePlaybacks
            .filterKeys { it != key }
            .filterValues { shouldReplacePlayback(it.alarmId, alarmId) }
            .keys
            .toList()
            .forEach { finishPlayback(it, recordStopped = true, cancelFiringNotification = false) }
        activeService = this
        createChannel()
        startForeground(playback)

        if (!startPlayback(
                playback,
                intent.getStringExtra(EXTRA_SOUND_URI),
                intent.getLongExtra(EXTRA_GRADUAL_DURATION_MS, 0L),
            )
        ) {
            finishPlayback(key, recordStopped = true)
            return START_NOT_STICKY
        }
        if (playback.autoSilenceMs > 0) {
            playback.autoSilenceRunnable = Runnable {
                finishPlayback(key, recordStopped = true)
            }.also { handler.postDelayed(it, playback.autoSilenceMs) }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        activePlaybacks.values.toList().forEach(::releasePlayback)
        activePlaybacks.clear()
        if (activeService === this) {
            activeService = null
        }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(com.hayao0819.laimelea.R.string.alarm_audio_channel),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                setSound(null, null)
                enableVibration(false)
            },
        )
    }

    private fun startForeground(playback: ActivePlayback) {
        val contentIntent = PendingIntent.getActivity(
            this,
            RingtoneModule.notificationId(playback.alarmId),
            Intent(this, RingtoneModule.alarmFiringActivity(RingtoneModule.isUserUnlocked(this))).apply {
                action = "$packageName.ALARM_AUDIO_FOREGROUND.${playback.alarmId}.${playback.timestampMs}"
                putExtra(EXTRA_ALARM_ID, playback.alarmId)
                putExtra(RingtoneModule.EXTRA_TRIGGER_TIMESTAMP_MS, playback.timestampMs)
                putExtra(EXTRA_AUTO_SILENCE_MS, playback.autoSilenceMs)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.hayao0819.laimelea.R.mipmap.ic_launcher)
            .setContentTitle(getString(com.hayao0819.laimelea.R.string.alarm_audio_title))
            .setContentText(getString(com.hayao0819.laimelea.R.string.alarm_audio_description))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .build()
        val foregroundServiceType =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            } else {
                0
            }
        ServiceCompat.startForeground(
            this,
            FOREGROUND_NOTIFICATION_ID,
            notification,
            foregroundServiceType,
        )
    }

    private fun startPlayback(
        playback: ActivePlayback,
        uri: String?,
        gradualDurationMs: Long,
    ): Boolean {
        val preferredUri = when (uri) {
            null, "default" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            else -> Uri.parse(uri)
        }
        if (preferredUri != null && startPlayer(playback, preferredUri, gradualDurationMs)) return true

        val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        return defaultUri != null && defaultUri != preferredUri &&
            startPlayer(playback, defaultUri, gradualDurationMs)
    }

    private fun startPlayer(
        playback: ActivePlayback,
        uri: Uri,
        gradualDurationMs: Long,
    ): Boolean {
        val nextPlayer = MediaPlayer()
        try {
            nextPlayer.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            nextPlayer.setDataSource(this, uri)
            nextPlayer.isLooping = true
            val initialVolume = if (gradualDurationMs > 0) 0f else 1f
            nextPlayer.setVolume(initialVolume, initialVolume)
            nextPlayer.prepare()
            nextPlayer.start()
            playback.player = nextPlayer
            if (gradualDurationMs > 0) {
                startGradualVolume(playback, gradualDurationMs)
            }
            return true
        } catch (_: Exception) {
            runCatching { nextPlayer.release() }
            return false
        }
    }

    private fun startGradualVolume(playback: ActivePlayback, durationMs: Long) {
        val startedAt = System.currentTimeMillis()
        playback.gradualRunnable = object : Runnable {
            override fun run() {
                val volume = ((System.currentTimeMillis() - startedAt).toFloat() / durationMs)
                    .coerceIn(0f, 1f)
                playback.player?.setVolume(volume, volume)
                if (volume < 1f && activePlaybacks.containsValue(playback)) {
                    handler.postDelayed(this, STEP_INTERVAL_MS)
                }
            }
        }
        handler.post(playback.gradualRunnable!!)
    }

    private fun setVolume(volume: Float) {
        val clamped = volume.coerceIn(0f, 1f)
        activePlaybacks.values.forEach { it.player?.setVolume(clamped, clamped) }
    }

    private fun stopPlayback(alarmId: String?, timestampMs: Long?) {
        activePlaybacks
            .filterValues { playback ->
                matchesPlayback(
                    playback.alarmId,
                    playback.timestampMs,
                    alarmId,
                    timestampMs,
                )
            }
            .keys
            .toList()
            .forEach { finishPlayback(it, recordStopped = false) }
    }

    private fun finishPlayback(
        key: String,
        recordStopped: Boolean,
        cancelFiringNotification: Boolean = true,
    ) {
        val playback = activePlaybacks.remove(key) ?: return
        releasePlayback(playback)
        if (recordStopped) {
            RingtoneModule.recordStoppedAlarmDelivery(
                this,
                playback.alarmId,
                playback.timestampMs,
                playback.autoSilenceMs,
            )
            if (cancelFiringNotification) {
                RingtoneModule.cancelAlarmFiringNotification(this, playback.alarmId, false)
            }
            val reactContext = (applicationContext as? ReactApplication)
                ?.reactHost
                ?.currentReactContext
            RingtoneModule.emitAlarmDelivery(reactContext)
        }
        if (activePlaybacks.isEmpty()) {
            stopSelf()
        }
    }

    private fun releasePlayback(playback: ActivePlayback) {
        playback.gradualRunnable?.let(handler::removeCallbacks)
        playback.autoSilenceRunnable?.let(handler::removeCallbacks)
        playback.player?.let { activePlayer ->
            runCatching { if (activePlayer.isPlaying) activePlayer.stop() }
            runCatching { activePlayer.release() }
        }
        playback.player = null
    }

    private fun playbackKey(alarmId: String, timestampMs: Long) = "$alarmId.$timestampMs"
}
