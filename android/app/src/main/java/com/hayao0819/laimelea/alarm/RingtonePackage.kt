package com.hayao0819.laimelea.alarm

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class RingtonePackage : BaseReactPackage() {

    override fun getModule(
        name: String,
        reactContext: ReactApplicationContext,
    ): NativeModule? {
        return if (name == RingtoneModule.NAME) {
            RingtoneModule(reactContext)
        } else {
            null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                RingtoneModule.NAME to ReactModuleInfo(
                    RingtoneModule.NAME,
                    RingtoneModule.NAME,
                    false,
                    false,
                    false,
                    false,
                ),
            )
        }
    }
}
