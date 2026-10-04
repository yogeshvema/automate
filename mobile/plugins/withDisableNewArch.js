const { withGradleProperties } = require('expo/config-plugins');

const withDisableNewArch = (config) => {
  return withGradleProperties(config, (modConfig) => {
    let found = false;
    modConfig.modResults = modConfig.modResults.map((item) => {
      if (item.type === 'property' && item.key === 'newArchEnabled') {
        found = true;
        return { ...item, value: 'false' };
      }
      return item;
    });
    if (!found) {
      modConfig.modResults.push({
        type: 'property',
        key: 'newArchEnabled',
        value: 'false',
      });
    }
    return modConfig;
  });
};

module.exports = withDisableNewArch;
