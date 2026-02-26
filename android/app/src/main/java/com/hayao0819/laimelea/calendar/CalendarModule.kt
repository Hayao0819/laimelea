package com.hayao0819.laimelea.calendar

import android.Manifest
import android.content.ContentUris
import android.content.pm.PackageManager
import android.database.Cursor
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = CalendarModule.NAME)
class CalendarModule(reactContext: ReactApplicationContext) :
    NativeCalendarModuleSpec(reactContext) {

    companion object {
        const val NAME = "CalendarModule"
    }

    override fun getName(): String = NAME

    override fun getCalendars(promise: Promise) {
        val context = reactApplicationContext
        if (!hasCalendarPermission(context)) {
            promise.resolve(Arguments.createArray())
            return
        }

        try {
            val projection = arrayOf(
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                CalendarContract.Calendars.CALENDAR_COLOR,
                CalendarContract.Calendars.IS_PRIMARY,
            )
            val selection = "${CalendarContract.Calendars.VISIBLE} = 1"

            val cursor: Cursor? = context.contentResolver.query(
                CalendarContract.Calendars.CONTENT_URI,
                projection,
                selection,
                null,
                null,
            )

            val result: WritableArray = Arguments.createArray()
            cursor?.use {
                val idIdx = it.getColumnIndex(CalendarContract.Calendars._ID)
                val nameIdx = it.getColumnIndex(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME)
                val colorIdx = it.getColumnIndex(CalendarContract.Calendars.CALENDAR_COLOR)
                val primaryIdx = it.getColumnIndex(CalendarContract.Calendars.IS_PRIMARY)

                while (it.moveToNext()) {
                    val map: WritableMap = Arguments.createMap()
                    map.putString("id", it.getLong(idIdx).toString())
                    map.putString("name", it.getString(nameIdx) ?: "")
                    map.putString("color", formatColor(it, colorIdx))
                    map.putBoolean("isPrimary", primaryIdx >= 0 && it.getInt(primaryIdx) == 1)
                    result.pushMap(map)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CALENDAR_ERROR", "Failed to read calendars: ${e.message}", e)
        }
    }

    override fun getEventInstances(startMs: Double, endMs: Double, promise: Promise) {
        val context = reactApplicationContext
        if (!hasCalendarPermission(context)) {
            promise.resolve(Arguments.createArray())
            return
        }

        try {
            val projection = arrayOf(
                CalendarContract.Instances.EVENT_ID,
                CalendarContract.Instances.CALENDAR_ID,
                CalendarContract.Instances.CALENDAR_DISPLAY_NAME,
                CalendarContract.Instances.TITLE,
                CalendarContract.Instances.DESCRIPTION,
                CalendarContract.Instances.BEGIN,
                CalendarContract.Instances.END,
                CalendarContract.Instances.ALL_DAY,
                CalendarContract.Instances.DISPLAY_COLOR,
            )

            val builder = CalendarContract.Instances.CONTENT_URI.buildUpon()
            ContentUris.appendId(builder, startMs.toLong())
            ContentUris.appendId(builder, endMs.toLong())

            val cursor: Cursor? = context.contentResolver.query(
                builder.build(),
                projection,
                null,
                null,
                "${CalendarContract.Instances.BEGIN} ASC",
            )

            val result: WritableArray = Arguments.createArray()
            cursor?.use {
                val eventIdIdx = it.getColumnIndex(CalendarContract.Instances.EVENT_ID)
                val calIdIdx = it.getColumnIndex(CalendarContract.Instances.CALENDAR_ID)
                val calNameIdx = it.getColumnIndex(CalendarContract.Instances.CALENDAR_DISPLAY_NAME)
                val titleIdx = it.getColumnIndex(CalendarContract.Instances.TITLE)
                val descIdx = it.getColumnIndex(CalendarContract.Instances.DESCRIPTION)
                val beginIdx = it.getColumnIndex(CalendarContract.Instances.BEGIN)
                val endIdx = it.getColumnIndex(CalendarContract.Instances.END)
                val allDayIdx = it.getColumnIndex(CalendarContract.Instances.ALL_DAY)
                val colorIdx = it.getColumnIndex(CalendarContract.Instances.DISPLAY_COLOR)

                while (it.moveToNext()) {
                    val map: WritableMap = Arguments.createMap()
                    map.putString("id", it.getLong(eventIdIdx).toString())
                    map.putString("calendarId", it.getLong(calIdIdx).toString())
                    map.putString("calendarName", it.getString(calNameIdx) ?: "")
                    map.putString("title", it.getString(titleIdx) ?: "")
                    map.putString("description", it.getString(descIdx) ?: "")
                    map.putDouble("startMs", it.getLong(beginIdx).toDouble())
                    map.putDouble("endMs", it.getLong(endIdx).toDouble())
                    map.putBoolean("allDay", it.getInt(allDayIdx) == 1)
                    map.putString("color", formatColor(it, colorIdx))
                    result.pushMap(map)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CALENDAR_ERROR", "Failed to read event instances: ${e.message}", e)
        }
    }

    private fun hasCalendarPermission(context: ReactApplicationContext): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CALENDAR,
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun formatColor(cursor: Cursor, columnIndex: Int): String? {
        if (columnIndex < 0 || cursor.isNull(columnIndex)) return null
        val colorInt = cursor.getInt(columnIndex)
        return String.format("#%06X", 0xFFFFFF and colorInt)
    }
}
