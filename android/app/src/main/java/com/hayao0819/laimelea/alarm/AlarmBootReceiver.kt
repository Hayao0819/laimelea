package com.hayao0819.laimelea.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.hayao0819.laimelea.widget.ClockWidgetUpdateScheduler

internal object AlarmBootActions {
    fun supports(action: String?): Boolean = action in setOf(
        Intent.ACTION_BOOT_COMPLETED,
        Intent.ACTION_LOCKED_BOOT_COMPLETED,
        Intent.ACTION_USER_UNLOCKED,
        Intent.ACTION_TIME_CHANGED,
        Intent.ACTION_TIMEZONE_CHANGED,
    )
}

class AlarmBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (!AlarmBootActions.supports(action)) return

        // goAsync() moves the (SharedPreferences-heavy) rescheduling work off the
        // main thread so it can't blow the broadcast's execution time budget.
        val pendingResult = goAsync()
        Thread {
            try {
                RingtoneModule.rescheduleAlarmAudio(
                    context,
                    action == Intent.ACTION_TIME_CHANGED || action == Intent.ACTION_TIMEZONE_CHANGED,
                )
                ClockWidgetUpdateScheduler.refresh(context)
                ClockWidgetUpdateScheduler.schedule(context)
                if (action == Intent.ACTION_TIME_CHANGED) {
                    TimerAlarmScheduler.rebaseWallDeadlines(context)
                }
                if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_USER_UNLOCKED) {
                    TimerAlarmScheduler.rescheduleAfterBoot(context)
                }
            } catch (_: Throwable) {
                // An uncaught exception on this raw Thread would kill the process and could
                // loop on every subsequent boot; the boot path must degrade, not crash.
            } finally {
                pendingResult.finish()
            }
        }.start()
    }
}
