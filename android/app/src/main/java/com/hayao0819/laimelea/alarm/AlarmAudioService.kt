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
import com.hayao0819.laimelea.MainActivity

class AlarmAudioService : Service() {

    companion object {
        const val EXTRA_ALARM_ID = "alarmId"
        const val EXTRA_SOUND_URI = "soundUri"
        const val EXTRA_GRADUAL_DURATION_MS = "gradualDurationMs"
        const val EXTRA_AUTO_SILENCE_MS = "autoSilenceMs"
        const val EXTRA_LABEL = "label"
        const val EXTRA_VIBRATION_ENABLED = "vibrationEnabled"
        private const val CHANNEL_ID = "alarm-audio-playback"
        private const val FOREGROUND_NOTIFICATION_ID = 9001
        private const val STEP_INTERVAL_MS = 500L
        private var activeService: AlarmAudioService? = null

        fun setActiveVolume(volume: Float): Boolean {
            val service = activeService ?: return false
            service.setVolume(volume)
            return true
        }

        fun stopActivePlayback(alarmId: String? = null) {
            val service = activeService ?: return
            if (alarmId == null || service.activeAlarmId == alarmId) {
                service.stopCurrentStart()
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null
    private var gradualRunnable: Runnable? = null
    private var activeAlarmId: String? = null
    private var activeOccurrenceTimestampMs = 0L
    private var activeAutoSilenceMs = 0L
    private var activeStartId = 0

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val alarmId = intent?.getStringExtra(EXTRA_ALARM_ID) ?: run {
            stopSelf()
            return START_NOT_STICKY
        }
        val soundUri = intent.getStringExtra(EXTRA_SOUND_URI)
        val gradualDurationMs = intent.getLongExtra(EXTRA_GRADUAL_DURATION_MS, 0L)
        val autoSilenceMs = intent.getLongExtra(EXTRA_AUTO_SILENCE_MS, 0L)
        val occurrenceTimestampMs = intent.getLongExtra(RingtoneModule.EXTRA_TRIGGER_TIMESTAMP_MS, 0L)

        handler.removeCallbacksAndMessages(null)
        if (
            activeAlarmId != null &&
            (activeAlarmId != alarmId || activeOccurrenceTimestampMs != occurrenceTimestampMs)
        ) {
            recordActiveAlarmStopped()
        }
        stopPlayback()
        createChannel()
        startForeground(alarmId)
        activeAlarmId = alarmId
        activeOccurrenceTimestampMs = occurrenceTimestampMs
        activeAutoSilenceMs = autoSilenceMs
        activeStartId = startId
        activeService = this
        startPlayback(soundUri, gradualDurationMs, startId)
        if (autoSilenceMs > 0) {
            handler.postDelayed({
                if (activeStartId != startId) return@postDelayed
                recordActiveAlarmStopped()
                stopSelfResult(startId)
            }, autoSilenceMs)
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        val alarmId = activeAlarmId
        if (activeService === this) {
            activeService = null
        }
        activeAlarmId = null
        activeOccurrenceTimestampMs = 0L
        activeAutoSilenceMs = 0L
        activeStartId = 0
        handler.removeCallbacksAndMessages(null)
        stopPlayback()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        alarmId?.let { RingtoneModule.cancelAlarmFiringNotification(this, it, false) }
        super.onDestroy()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Alarm audio",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                setSound(null, null)
                enableVibration(false)
            },
        )
    }

    private fun startForeground(alarmId: String) {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
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
        ServiceCompat.startForeground(
            this,
            FOREGROUND_NOTIFICATION_ID,
            notification,
            android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
        )
    }

    private fun startPlayback(uri: String?, gradualDurationMs: Long, startId: Int) {
        val preferredUri = when (uri) {
            null, "default" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            else -> Uri.parse(uri)
        }
        if (preferredUri != null && startPlayer(preferredUri, gradualDurationMs)) return

        val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        if (defaultUri != null && defaultUri != preferredUri && startPlayer(defaultUri, gradualDurationMs)) {
            return
        }
        recordActiveAlarmStopped()
        stopSelfResult(startId)
    }

    private fun startPlayer(uri: Uri, gradualDurationMs: Long): Boolean {
        val nextPlayer = MediaPlayer()
        try {
            nextPlayer.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            nextPlayer.setDataSource(this@AlarmAudioService, uri)
            nextPlayer.isLooping = true
            val initialVolume = if (gradualDurationMs > 0) 0f else 1f
            nextPlayer.setVolume(initialVolume, initialVolume)
            nextPlayer.prepare()
            nextPlayer.start()
            player = nextPlayer
            if (gradualDurationMs > 0) {
                startGradualVolume(gradualDurationMs)
            }
            return true
        } catch (_: Exception) {
            runCatching { nextPlayer.release() }
            return false
        }
    }

    private fun startGradualVolume(durationMs: Long) {
        val startedAt = System.currentTimeMillis()
        gradualRunnable = object : Runnable {
            override fun run() {
                val volume = ((System.currentTimeMillis() - startedAt).toFloat() / durationMs)
                    .coerceIn(0f, 1f)
                setVolume(volume)
                if (volume < 1f) {
                    handler.postDelayed(this, STEP_INTERVAL_MS)
                }
            }
        }
        handler.post(gradualRunnable!!)
    }

    private fun setVolume(volume: Float) {
        val clamped = volume.coerceIn(0f, 1f)
        player?.setVolume(clamped, clamped)
    }

    private fun stopPlayback() {
        gradualRunnable?.let(handler::removeCallbacks)
        gradualRunnable = null
        player?.let { activePlayer ->
            runCatching { if (activePlayer.isPlaying) activePlayer.stop() }
            runCatching { activePlayer.release() }
        }
        player = null
    }

    private fun recordActiveAlarmStopped() {
        val alarmId = activeAlarmId ?: return
        RingtoneModule.recordStoppedAlarmDelivery(
            this,
            alarmId,
            activeOccurrenceTimestampMs,
            activeAutoSilenceMs,
        )
        RingtoneModule.cancelAlarmFiringNotification(this, alarmId, false)
        val reactContext = (applicationContext as? ReactApplication)
            ?.reactHost
            ?.currentReactContext
        RingtoneModule.emitAlarmDelivery(reactContext)
    }

    private fun stopCurrentStart() {
        stopSelfResult(activeStartId)
    }
}
