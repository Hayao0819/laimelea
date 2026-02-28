package com.hayao0819.laimelea.fullscreen

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class FullscreenPackage : BaseReactPackage() {

    override fun getModule(
        name: String,
        reactContext: ReactApplicationContext,
    ): NativeModule? {
        return if (name == FullscreenModule.NAME) {
            FullscreenModule(reactContext)
        } else {
            null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                FullscreenModule.NAME to ReactModuleInfo(
                    FullscreenModule.NAME,
                    FullscreenModule.NAME,
                    false,
                    false,
                    false,
                    false,
                ),
            )
        }
    }
}
