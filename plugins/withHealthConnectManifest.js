const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Adds to AndroidManifest.xml:
 * 1. The SHOW_PERMISSIONS_RATIONALE intent filter on MainActivity — required for
 *    the app to appear in Health Connect's "App permissions" list.
 * 2. The privacy policy URL metadata — Health Connect requires this to recognize
 *    the app as a health app at all. Without it the app never shows in HC.
 */
module.exports = function withHealthConnectManifest(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];

    // 1. Privacy policy metadata (required by Health Connect)
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }
    const privacyPolicyKey = 'health_permissions_privacy_policy';
    const alreadyHasPolicy = application['meta-data'].some(
      (m) => m.$?.['android:name'] === privacyPolicyKey
    );
    if (!alreadyHasPolicy) {
      application['meta-data'].push({
        $: {
          'android:name': privacyPolicyKey,
          'android:value': 'https://streakwar.is/privacy',
        },
      });
    }

    // 2. SHOW_PERMISSIONS_RATIONALE intent filter on MainActivity
    const mainActivity = application.activity[0];
    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }
    const hasNewAction = mainActivity['intent-filter'].some((f) =>
      f.action?.some(
        (a) => a.$?.['android:name'] === 'androidx.health.connect.client.SHOW_PERMISSIONS_RATIONALE'
      )
    );
    if (!hasNewAction) {
      mainActivity['intent-filter'].push({
        action: [{
          $: { 'android:name': 'androidx.health.connect.client.SHOW_PERMISSIONS_RATIONALE' },
        }],
      });
    }

    return config;
  });
};
