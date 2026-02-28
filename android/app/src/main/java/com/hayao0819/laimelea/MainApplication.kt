package com.hayao0819.laimelea

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.hayao0819.laimelea.calendar.CalendarPackage
import com.hayao0819.laimelea.deviceinfo.DeviceInfoPackage
import com.hayao0819.laimelea.fullscreen.FullscreenPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(CalendarPackage())
          add(DeviceInfoPackage())
          add(FullscreenPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
