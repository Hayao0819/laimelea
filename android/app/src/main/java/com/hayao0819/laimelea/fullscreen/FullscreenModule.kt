package com.hayao0819.laimelea.fullscreen

import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = FullscreenModule.NAME)
class FullscreenModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "FullscreenModule"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun activate() {
        UiThreadUtil.runOnUiThread {
            currentActivity?.window?.addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
        }
    }

    @ReactMethod
    fun deactivate() {
        UiThreadUtil.runOnUiThread {
            currentActivity?.window?.clearFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
        }
    }

    @ReactMethod
    fun enterImmersive() {
        UiThreadUtil.runOnUiThread {
            currentActivity?.window?.let { window ->
                WindowCompat.setDecorFitsSystemWindows(window, false)
                WindowInsetsControllerCompat(window, window.decorView).apply {
                    hide(WindowInsetsCompat.Type.systemBars())
                    systemBarsBehavior =
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            }
        }
    }

    @ReactMethod
    fun exitImmersive() {
        UiThreadUtil.runOnUiThread {
            currentActivity?.window?.let { window ->
                WindowCompat.setDecorFitsSystemWindows(window, true)
                WindowInsetsControllerCompat(window, window.decorView)
                    .show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }
}
