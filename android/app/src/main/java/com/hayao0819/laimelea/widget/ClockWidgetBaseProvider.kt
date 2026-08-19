package com.hayao0819.laimelea.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import com.reactnativeandroidwidget.RNWidgetProvider

abstract class ClockWidgetBaseProvider : RNWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        ClockWidgetUpdateScheduler.schedule(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        ClockWidgetUpdateScheduler.schedule(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        ClockWidgetUpdateScheduler.schedule(context)
    }
}
