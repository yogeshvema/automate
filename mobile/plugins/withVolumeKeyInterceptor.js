const { withMainActivity } = require('expo/config-plugins');

/**
 * Expo Config Plugin to intercept hardware volume button events (Volume Down and Volume Up)
 * and Bluetooth camera shutter remotes directly at the Android Activity root (onKeyDown/onKeyUp).
 *
 * This prevents the Android OS from changing phone volume or showing the volume slider popup,
 * and directly emits a 'hardwareKeyEvent' into React Native's DeviceEventEmitter.
 */
const withVolumeKeyInterceptor = (config) => {
  return withMainActivity(config, (modConfig) => {
    let content = modConfig.modResults.contents;
    if (!content.includes('onKeyDown')) {
      const imports = `import android.view.KeyEvent
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
`;
      // Insert imports after package statement
      content = content.replace(/(package\s+[\w\.]+)/, `$1\n\n${imports}`);

      const methods = `
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
      try {
        val reactContext = reactInstanceManager?.currentReactContext
        if (reactContext != null) {
          val params = Arguments.createMap()
          params.putString("key", if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) "VOLUME_DOWN" else "VOLUME_UP")
          params.putInt("keyCode", keyCode)
          reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("hardwareKeyEvent", params)
        }
      } catch (e: Exception) {
        e.printStackTrace()
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
};

module.exports = withVolumeKeyInterceptor;
