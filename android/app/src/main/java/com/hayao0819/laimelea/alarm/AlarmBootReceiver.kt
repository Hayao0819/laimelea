package com.hayao0819.laimelea.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class AlarmBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val serviceIntent = Intent(context, AlarmBootService::class.java)
        try {
            context.startService(serviceIntent)
        } catch (_: IllegalStateException) {
            // On Android 8+ background service restrictions may prevent startService.
            // The alarms will be rescheduled when the user opens the app next.
        }
    }
}

class AlarmBootService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig {
        return HeadlessJsTaskConfig(
            TASK_NAME,
            Arguments.createMap().apply {
                putString("reason", "boot_completed")
            },
            TASK_TIMEOUT_MS,
            true,
        )
    }

    companion object {
        const val TASK_NAME = "RescheduleAlarmsTask"
        const val TASK_TIMEOUT_MS = 30000L
    }
}
