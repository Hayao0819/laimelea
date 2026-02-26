package com.hayao0819.laimelea.calendar

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class CalendarPackage : BaseReactPackage() {

    override fun getModule(
        name: String,
        reactContext: ReactApplicationContext,
    ): NativeModule? {
        return if (name == CalendarModule.NAME) {
            CalendarModule(reactContext)
        } else {
            null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                CalendarModule.NAME to ReactModuleInfo(
                    CalendarModule.NAME,
                    CalendarModule.NAME,
                    false,
                    false,
                    false,
                    true,
                ),
            )
        }
    }
}
