package com.hayao0819.laimelea.deviceinfo

import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = DeviceInfoModule.NAME)
class DeviceInfoModule(reactContext: ReactApplicationContext) :
    NativeDeviceInfoModuleSpec(reactContext) {

    companion object {
        const val NAME = "DeviceInfoModule"
    }

    override fun getName(): String = NAME

    override fun getManufacturer(): String = Build.MANUFACTURER
}
