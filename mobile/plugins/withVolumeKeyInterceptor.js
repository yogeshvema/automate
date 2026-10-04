const { withMainActivity } = require('expo/config-plugins');

/**
 * Expo Config Plugin to intercept hardware volume button events (Volume Down and Volume Up)
 * and Bluetooth camera shutter remotes directly at the Android Activity root.
 *
 * It prevents the Android OS from changing phone volume or showing the volume slider popup,
 * and directly emits 'hardwareKeyEvent' and 'onHardwareVolumeButton' into React Native.
 */
const withVolumeKeyInterceptor = (config) => {
  return withMainActivity(config, (modConfig) => {
    let content = modConfig.modResults.contents;
    if (!content.includes('getActiveReactContext')) {
      const imports = `import android.view.KeyEvent
import com.facebook.react.ReactHost
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
`;
      // Insert imports after package statement
      content = content.replace(/(package\s+[\w\.]+)/, `$1\n\n${imports}`);

      const methods = `
  private fun getActiveReactContext(): ReactContext? {
    try {
      val host = reactHost
      val ctx = host?.currentReactContext
      if (ctx != null) return ctx
    } catch (_: Throwable) {}

    try {
      val delegate = reactActivityDelegate
      val ctx = delegate?.currentReactContext
      if (ctx != null) return ctx
    } catch (_: Throwable) {}

    try {
      val instanceManager = reactInstanceManager
      val ctx = instanceManager?.currentReactContext
      if (ctx != null) return ctx
    } catch (_: Throwable) {}

    return null
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
      if (event == null || event.repeatCount == 0) {
        val keyName = if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) "VOLUME_DOWN" else "VOLUME_UP"
        try {
          val ctx = getActiveReactContext()
          if (ctx != null) {
            val params = Arguments.createMap().apply {
              putString("key", keyName)
              putString("action", keyName.lowercase())
              putInt("keyCode", keyCode)
            }
            ctx.emitDeviceEvent("hardwareKeyEvent", params)
            ctx.emitDeviceEvent("onHardwareVolumeButton", params)
          }
        } catch (e: Exception) {
          e.printStackTrace()
        }
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
