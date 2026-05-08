const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Adds to AndroidManifest.xml:
 * 1. The SHOW_PERMISSIONS_RATIONALE intent filters (both old and new action names) with
 *    android.intent.category.DEFAULT — required for the app to appear in HC's app list.
 * 2. The privacy policy URL metadata — HC requires this to recognise the app as a health app.
 * 3. <queries> entries for the Health Connect package so Linking.canOpenURL works on Android 11+.
 */
module.exports = function withHealthConnectManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application[0];

    // 1. Privacy policy metadata
    if (!application['meta-data']) application['meta-data'] = [];
    const privacyPolicyKey = 'health_permissions_privacy_policy';
    if (!application['meta-data'].some((m) => m.$?.['android:name'] === privacyPolicyKey)) {
      application['meta-data'].push({
        $: { 'android:name': privacyPolicyKey, 'android:value': 'https://fitbet.fit/streakwar/policy.html' },
      });
    }

    // 2. Intent filters on MainActivity — find by name, not by index
    const mainActivity =
      application.activity?.find((a) => a.$?.['android:name'] === '.MainActivity') ??
      application.activity?.[0];
    if (!mainActivity) return config;
    if (!mainActivity['intent-filter']) mainActivity['intent-filter'] = [];

    const HC_ACTIONS = [
      'androidx.health.connect.client.SHOW_PERMISSIONS_RATIONALE',
      'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
    ];

    for (const actionName of HC_ACTIONS) {
      const existingFilter = mainActivity['intent-filter'].find((f) =>
        f.action?.some((a) => a.$?.['android:name'] === actionName)
      );
      if (existingFilter) {
        // Ensure DEFAULT category exists on the existing filter
        if (!existingFilter.category) existingFilter.category = [];
        const hasDefault = existingFilter.category.some(
          (c) => c.$?.['android:name'] === 'android.intent.category.DEFAULT'
        );
        if (!hasDefault) {
          existingFilter.category.push({ $: { 'android:name': 'android.intent.category.DEFAULT' } });
        }
      } else {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': actionName } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        });
      }
    }

    // 3. <queries> for Health Connect package visibility (Android 11+)
    if (!manifest.queries) manifest.queries = [{}];
    const queries = manifest.queries[0];

    if (!queries.package) queries.package = [];
    const hcPackage = 'com.google.android.apps.healthdata';
    if (!queries.package.some((p) => p.$?.['android:name'] === hcPackage)) {
      queries.package.push({ $: { 'android:name': hcPackage } });
    }

    if (!queries.intent) queries.intent = [];
    const hcIntentAction = 'androidx.health.connect.client.SHOW_PERMISSIONS_RATIONALE';
    if (!queries.intent.some((i) => i.action?.[0]?.$?.['android:name'] === hcIntentAction)) {
      queries.intent.push({ action: [{ $: { 'android:name': hcIntentAction } }] });
    }

    // Declare android-health-connect:// scheme so Linking.canOpenURL works on Android 11+
    if (!queries.intent.some((i) => i.data?.[0]?.$?.['android:scheme'] === 'android-health-connect')) {
      queries.intent.push({
        data: [{ $: { 'android:scheme': 'android-health-connect' } }],
      });
    }

    return config;
  });
};
