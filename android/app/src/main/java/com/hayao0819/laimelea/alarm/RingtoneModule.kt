package com.hayao0819.laimelea.alarm

import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RingtoneModule.NAME)
class RingtoneModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "RingtoneModule"
    }

    private var currentRingtone: Ringtone? = null

    override fun getName(): String = NAME

    @ReactMethod
    fun getAlarmRingtones(promise: Promise) {
        try {
            val rm = RingtoneManager(reactApplicationContext)
            rm.setType(RingtoneManager.TYPE_ALARM)

            val cursor = rm.cursor
            val result = Arguments.createArray()

            while (cursor.moveToNext()) {
                val title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX)
                val uri = rm.getRingtoneUri(cursor.position).toString()

                val map = Arguments.createMap()
                map.putString("title", title)
                map.putString("uri", uri)
                result.pushMap(map)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to get alarm ringtones", e)
        }
    }

    @ReactMethod
    fun playRingtone(uri: String, promise: Promise) {
        try {
            stopCurrentRingtone()

            val ringtoneUri = Uri.parse(uri)
            val ringtone = RingtoneManager.getRingtone(reactApplicationContext, ringtoneUri)
            if (ringtone == null) {
                promise.reject("RINGTONE_ERROR", "Failed to load ringtone for URI: $uri")
                return
            }

            ringtone.play()
            currentRingtone = ringtone
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to play ringtone", e)
        }
    }

    @ReactMethod
    fun stopRingtone(promise: Promise) {
        try {
            stopCurrentRingtone()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to stop ringtone", e)
        }
    }

    @ReactMethod
    fun getDefaultAlarmUri(promise: Promise) {
        try {
            val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            promise.resolve(defaultUri?.toString())
        } catch (e: Exception) {
            promise.reject("RINGTONE_ERROR", "Failed to get default alarm URI", e)
        }
    }

    override fun onCatalystInstanceDestroy() {
        stopCurrentRingtone()
        super.onCatalystInstanceDestroy()
    }

    private fun stopCurrentRingtone() {
        currentRingtone?.let {
            if (it.isPlaying) {
                it.stop()
            }
        }
        currentRingtone = null
    }
}
