const { withDangerousMod, withMainActivity, withMainApplication } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to intercept hardware volume button events (Volume Down and Volume Up)
 * and Bluetooth camera shutter remotes directly at the Android Activity root.
 *
 * 1. Creates VolumeKeyModule.kt and VolumeKeyPackage.kt in the Android native project.
 * 2. Registers VolumeKeyPackage in MainApplication.kt.
 * 3. Intercepts onKeyDown and onKeyUp in MainActivity.kt, forwarding key events to React Native.
 */
const withVolumeKeyInterceptor = (config) => {
  // Step 1: Write native VolumeKeyModule and VolumeKeyPackage
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const packageDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app/src/main/java/com/snapsend/app'
      );
      fs.mkdirSync(packageDir, { recursive: true });

      const moduleFile = path.join(packageDir, 'VolumeKeyModule.kt');
      const moduleContent = `package com.snapsend.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager

class VolumeKeyModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "VolumeKeyModule"

  init {
    instance = this
  }

  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}

  companion object {
    @Volatile
    var instance: VolumeKeyModule? = null

    fun sendEvent(key: String, keyCode: Int) {
      val inst = instance ?: return
      val ctx = inst.reactApplicationContext ?: return
      try {
        val params = Arguments.createMap().apply {
          putString("key", key)
          putString("action", key.lowercase())
          putInt("keyCode", keyCode)
        }
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("hardwareKeyEvent", params)
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("onHardwareVolumeButton", params)
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }
}

class VolumeKeyPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(VolumeKeyModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;
      fs.writeFileSync(moduleFile, moduleContent, 'utf8');
      return modConfig;
    },
  ]);

  // Step 2: Register VolumeKeyPackage in MainApplication.kt
  config = withMainApplication(config, (modConfig) => {
    let content = modConfig.modResults.contents;
    if (!content.includes('VolumeKeyPackage')) {
      // Add package registration in packageList
      content = content.replace(
        /PackageList\(this\)\.packages\.apply\s*\{([\s\S]*?)\}/,
        `PackageList(this).packages.apply {\n          add(VolumeKeyPackage())$1}`
      );
      modConfig.modResults.contents = content;
    }
    return modConfig;
  });

  // Step 3: Intercept onKeyDown in MainActivity.kt
  config = withMainActivity(config, (modConfig) => {
    let content = modConfig.modResults.contents;
    if (!content.includes('VolumeKeyModule.sendEvent')) {
      const imports = `import android.view.KeyEvent
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
`;
      content = content.replace(/(package\s+[\w\.]+)/, `$1\n\n${imports}`);

      const methods = `
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
      if (event == null || event.repeatCount == 0) {
        val keyName = if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) "VOLUME_DOWN" else "VOLUME_UP"
        
        // 1. Send via registered Native Module instance (guaranteed context)
        try {
          VolumeKeyModule.sendEvent(keyName, keyCode)
        } catch (_: Throwable) {}

        // 2. Direct Application reactHost fallback
        try {
          val appReactHost = (application as? ReactApplication)?.reactHost
          val ctx = appReactHost?.currentReactContext
          if (ctx != null) {
            val params = Arguments.createMap().apply {
              putString("key", keyName)
              putString("action", keyName.lowercase())
              putInt("keyCode", keyCode)
            }
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
              .emit("hardwareKeyEvent", params)
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
              .emit("onHardwareVolumeButton", params)
          }
        } catch (_: Throwable) {}
      }
      return true
    }
    return super.onKeyDown(keyCode, event)
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
      return true
    }
    return super.onKeyUp(keyCode, event)
  }
`;
      const lastIndex = content.lastIndexOf('}');
      content = content.slice(0, lastIndex) + methods + '\n}\n';
      modConfig.modResults.contents = content;
    }
    return modConfig;
  });

  return config;
};

module.exports = withVolumeKeyInterceptor;
