package com.hayao0819.laimelea.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class AlarmAudioReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getStringExtra(AlarmAudioService.EXTRA_ALARM_ID) ?: return
        val timestampMs = intent.getLongExtra(RingtoneModule.EXTRA_TRIGGER_TIMESTAMP_MS, 0L)
        if (timestampMs > 0) {
            RingtoneModule.markAlarmAudioDispatched(context, alarmId, timestampMs)
        }
        val serviceIntent = Intent(context, AlarmAudioService::class.java).apply {
            putExtras(intent)
        }
        ContextCompat.startForegroundService(context, serviceIntent)
    }
}
