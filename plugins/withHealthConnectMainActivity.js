const { withMainActivity } = require('@expo/config-plugins');

/**
 * Patches MainActivity.kt to call HealthConnectPermissionDelegate.setPermissionDelegate(this)
 * in onCreate(). This must happen before onStart() so the ActivityResultLauncher is registered
 * before requestPermission() is ever called — otherwise the library crashes with
 * UninitializedPropertyAccessException.
 *
 * Expo SDK 50+ generates super.onCreate(null), not super.onCreate(savedInstanceState),
 * so we match super.onCreate(...) with any argument.
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
      // Must come BEFORE super.onCreate() so the ActivityResultLauncher is
      // registered before React Native initialises the bridge.
      src = src.replace(
        /(super\.onCreate\([^)]*\))/,
        `${delegateCall}\n    $1`
      );
    }

    config.modResults.contents = src;
    return config;
  });
};
