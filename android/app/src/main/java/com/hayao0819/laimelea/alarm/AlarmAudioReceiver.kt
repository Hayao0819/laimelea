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
            AlarmAudioService.stopActivePlayback(alarmId, timestampMs)
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
        if (
            timestampMs <= 0 ||
            !RingtoneModule.markAlarmAudioDispatched(context, alarmId, timestampMs)
        ) {
            return
        }
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
        val reactContext = (context.applicationContext as? ReactApplication)
            ?.reactHost
            ?.currentReactContext
        RingtoneModule.emitAlarmDelivery(reactContext)
        if (!RingtoneModule.shouldStartAlarmAudio(soundUri)) {
            return
        }
        if (!notificationShown) {
            // No notification means no full-screen intent either, so open the stop UI
            // directly - audio is about to start and must stay stoppable.
            RingtoneModule.launchAlarmFiringActivity(context, alarmId, timestampMs, autoSilenceMs)
        }
        val serviceIntent = Intent(context, AlarmAudioService::class.java).apply {
            putExtras(intent)
            putExtra(AlarmAudioService.EXTRA_UI_REACHABLE, notificationShown)
        }
        ContextCompat.startForegroundService(context, serviceIntent)
    }
}
