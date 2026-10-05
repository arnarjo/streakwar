/* global __dirname */
const { withMainApplication, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs/promises');
const path = require('path');

const registration = 'add(com.streakwar.health.HealthConnectBackgroundPackage())';
const dependency = 'implementation "androidx.health.connect:connect-client:1.1.0-alpha11"';

function patchApplication(contents) {
  if (contents.includes(registration)) return contents;
  const anchor = 'PackageList(this).packages.apply {';
  if (!contents.includes(anchor)) throw new Error('Health Connect: MainApplication package anchor missing');
  return contents.replace(anchor, `${anchor}\n              ${registration}`);
}

function patchGradle(contents) {
  if (contents.includes(dependency)) return contents;
  if (!contents.includes('dependencies {')) throw new Error('Health Connect: Gradle dependencies anchor missing');
  // Match the installed react-native-health-connect dependency; no SDK upgrade here.
  return contents.replace('dependencies {', `dependencies {\n    ${dependency}`);
}

module.exports = function withHealthConnectBackground(config) {
  config = withMainApplication(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('Health Connect background bridge requires Kotlin MainApplication');
    mod.modResults.contents = patchApplication(mod.modResults.contents);
    return mod;
  });
  config = withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Health Connect background bridge requires Groovy Gradle');
    mod.modResults.contents = patchGradle(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java/com/streakwar/health');
    await fs.mkdir(target, { recursive: true });
    for (const file of ['HealthConnectBackgroundModule.kt', 'HealthConnectBackgroundPackage.kt']) {
      await fs.copyFile(path.join(__dirname, 'health-connect-background', file), path.join(target, file));
    }
    return mod;
  }]);
};
module.exports.patchApplication = patchApplication;
module.exports.patchGradle = patchGradle;
