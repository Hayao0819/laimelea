package com.hayao0819.laimelea.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent

private const val MINUTE_MS = 60_000L
private const val TICK_OFFSET_MS = 250L

internal fun nextWidgetTickTimestamp(nowMs: Long): Long =
    nowMs - (nowMs % MINUTE_MS) + MINUTE_MS + TICK_OFFSET_MS

object ClockWidgetUpdateScheduler {
    const val ACTION = "com.hayao0819.laimelea.widget.CLOCK_TICK"

    private val providerClasses = listOf(
        ClockWidgetSmallProvider::class.java,
        ClockWidgetProvider::class.java,
        ClockWidgetLargeProvider::class.java,
    )

    fun schedule(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val hasWidgets = providerClasses.any { providerClass ->
            appWidgetManager.getAppWidgetIds(ComponentName(context, providerClass)).isNotEmpty()
        }
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val operation = tickPendingIntent(context)
        if (!hasWidgets) {
            alarmManager.cancel(operation)
            return
        }

        val triggerAt = nextWidgetTickTimestamp(System.currentTimeMillis())
        try {
            alarmManager.setExact(AlarmManager.RTC, triggerAt, operation)
        } catch (_: SecurityException) {
            alarmManager.set(AlarmManager.RTC, triggerAt, operation)
        }
    }

    fun refresh(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context)
        providerClasses.forEach { providerClass ->
            val component = ComponentName(context, providerClass)
            val widgetIds = appWidgetManager.getAppWidgetIds(component)
            if (widgetIds.isEmpty()) return@forEach
            context.sendBroadcast(
                Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                    .setComponent(component)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds),
            )
        }
    }

    private fun tickPendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, ClockWidgetTickReceiver::class.java).setAction(ACTION),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}

class ClockWidgetTickReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ClockWidgetUpdateScheduler.ACTION) return
        ClockWidgetUpdateScheduler.refresh(context)
        ClockWidgetUpdateScheduler.schedule(context)
    }
}
