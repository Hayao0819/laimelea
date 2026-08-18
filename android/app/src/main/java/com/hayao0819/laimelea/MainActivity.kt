package com.hayao0819.laimelea

import android.os.Bundle
import android.content.Intent
import android.view.KeyEvent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.hayao0819.laimelea.alarm.RingtoneModule
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate

class MainActivity : ReactActivity() {

  private val handledAlarmVolumeKeys = mutableSetOf<Int>()

  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    super.onCreate(savedInstanceState)
    HealthConnectPermissionDelegate.setPermissionDelegate(this)
  }

  override fun getMainComponentName(): String = "Laimelea"

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    RingtoneModule.emitPendingAlarmDelivery(reactDelegate?.currentReactContext, intent)
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
    val isVolumeKey =
        keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
    if (isVolumeKey) {
      if (keyCode in handledAlarmVolumeKeys) return true
      if (
          event.repeatCount == 0 &&
              RingtoneModule.handleAlarmVolumeButton(reactDelegate?.currentReactContext)
      ) {
        handledAlarmVolumeKeys.add(keyCode)
        return true
      }
    }
    return super.onKeyDown(keyCode, event)
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
    if (handledAlarmVolumeKeys.remove(keyCode)) return true
    return super.onKeyUp(keyCode, event)
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
