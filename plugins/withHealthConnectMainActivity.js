const { withMainActivity } = require('@expo/config-plugins');

/**
 * Patches MainActivity.kt to call HealthConnectPermissionDelegate.setPermissionDelegate(this)
 * as the FIRST statement in onCreate(), before super.onCreate(). This is required by
 * react-native-health-connect v3.x so the ActivityResultLauncher is registered before
 * onStart() — otherwise requestPermission() silently fails and the app never appears
 * in Health Connect's "App permissions" list.
 *
 * See: https://github.com/matinzd/react-native-health-connect (v3.x setup docs)
 */
module.exports = function withHealthConnectMainActivity(config) {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;

    const importLine = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
    if (!src.includes(importLine)) {
      // Insert after the last existing import line
      const lastImport = src.lastIndexOf('\nimport ');
      if (lastImport !== -1) {
        const lineEnd = src.indexOf('\n', lastImport + 1);
        src = src.slice(0, lineEnd + 1) + importLine + '\n' + src.slice(lineEnd + 1);
      } else {
        src = src.replace(/^(package .+\n)/, `$1\n${importLine}\n`);
      }
    }

    const delegateCall = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';
    if (!src.includes(delegateCall)) {
      // react-native-health-connect v3.x requires the delegate BEFORE super.onCreate()
      // so the ActivityResultLauncher is registered before onStart() is reached.
      src = src.replace(
        /(override fun onCreate\([^)]*\)\s*\{)/,
        `$1\n    ${delegateCall}`
      );
    }

    config.modResults.contents = src;
    return config;
  });
};
