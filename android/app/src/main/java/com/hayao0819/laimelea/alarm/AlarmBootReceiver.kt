package com.hayao0819.laimelea.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

internal object AlarmBootActions {
    fun supports(action: String?): Boolean = action in setOf(
        Intent.ACTION_BOOT_COMPLETED,
        Intent.ACTION_LOCKED_BOOT_COMPLETED,
        Intent.ACTION_TIME_CHANGED,
        Intent.ACTION_TIMEZONE_CHANGED,
    )
}

class AlarmBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (!AlarmBootActions.supports(action)) return

        RingtoneModule.rescheduleAlarmAudio(
            context,
            action == Intent.ACTION_TIME_CHANGED || action == Intent.ACTION_TIMEZONE_CHANGED,
        )
    }
}
