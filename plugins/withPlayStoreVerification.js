const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Writes the Play Store developer verification token into res/raw/ so that
// the "Sign and upload an APK" ownership check in Play Console passes.
const TOKEN = 'C7GC7CSVFB35WAAAAAAAAAAAAA';

module.exports = function withPlayStoreVerification(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const assetsDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(path.join(assetsDir, 'adi-registration.properties'), TOKEN);
      return config;
    },
  ]);
};
