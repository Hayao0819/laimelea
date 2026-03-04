package com.hayao0819.laimelea.alarm

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = BatteryOptimizationModule.NAME)
class BatteryOptimizationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BatteryOptimizationModule"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = reactApplicationContext.packageName
            promise.resolve(pm.isIgnoringBatteryOptimizations(packageName))
        } catch (e: Exception) {
            promise.reject("BATTERY_OPT_ERROR", "Failed to check battery optimization status", e)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = reactApplicationContext.packageName

            if (pm.isIgnoringBatteryOptimizations(packageName)) {
                promise.resolve(true)
                return
            }

            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BATTERY_OPT_ERROR", "Failed to request battery optimization exemption", e)
        }
    }
}
