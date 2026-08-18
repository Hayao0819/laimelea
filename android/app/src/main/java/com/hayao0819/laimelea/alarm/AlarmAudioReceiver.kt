package com.hayao0819.laimelea.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.ReactApplication

class AlarmAudioReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getStringExtra(AlarmAudioService.EXTRA_ALARM_ID) ?: return
        if (RingtoneModule.isAlarmStopIntent(intent)) {
            val timestampMs = intent.getLongExtra(RingtoneModule.EXTRA_TRIGGER_TIMESTAMP_MS, 0L)
            val autoSilenceMs = intent.getLongExtra(AlarmAudioService.EXTRA_AUTO_SILENCE_MS, 0L)
            AlarmAudioService.stopActivePlayback(alarmId)
            RingtoneModule.recordStoppedAlarmDelivery(
                context,
                alarmId,
                timestampMs,
                autoSilenceMs,
            )
            RingtoneModule.cancelAlarmFiringNotification(context, alarmId, false)
            val reactContext = (context.applicationContext as? ReactApplication)
                ?.reactHost
                ?.currentReactContext
            RingtoneModule.emitAlarmDelivery(reactContext)
            return
        }
        val timestampMs = intent.getLongExtra(RingtoneModule.EXTRA_TRIGGER_TIMESTAMP_MS, 0L)
        val autoSilenceMs = intent.getLongExtra(AlarmAudioService.EXTRA_AUTO_SILENCE_MS, 0L)
        val soundUri = intent.getStringExtra(AlarmAudioService.EXTRA_SOUND_URI)
        val notificationShown = runCatching {
            RingtoneModule.showAlarmFiringNotification(
                context,
                alarmId,
                timestampMs,
                intent.getStringExtra(AlarmAudioService.EXTRA_LABEL),
                intent.getBooleanExtra(AlarmAudioService.EXTRA_VIBRATION_ENABLED, true),
                autoSilenceMs,
            )
        }.getOrDefault(false)
        if (!notificationShown) {
            RingtoneModule.recordUndeliverableAlarmDelivery(
                context,
                alarmId,
                timestampMs,
                autoSilenceMs,
                soundUri == "__silent__",
            )
        }
        if (timestampMs > 0) {
            RingtoneModule.markAlarmAudioDispatched(context, alarmId, timestampMs)
        }
        val reactContext = (context.applicationContext as? ReactApplication)
            ?.reactHost
            ?.currentReactContext
        RingtoneModule.emitAlarmDelivery(reactContext)
        if (!RingtoneModule.shouldStartAlarmAudio(
                soundUri,
            )
        ) {
            return
        }
        val serviceIntent = Intent(context, AlarmAudioService::class.java).apply {
            putExtras(intent)
        }
        ContextCompat.startForegroundService(context, serviceIntent)
    }
}
