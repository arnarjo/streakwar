// The normal app is unchanged. Phone-test builds must explicitly opt in and
// supply the isolated backend; never silently fall back to production.
module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_APP_VARIANT !== 'phone-test') return config;
  if (process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://vqizpuqmsykmhlyihyry.supabase.co' ||
      !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.startsWith('sb_publishable_')) {
    throw new Error('Phone-test requires the isolated TEST backend and publishable key');
  }
  if (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS) {
    throw new Error('Phone-test must not use purchase credentials');
  }
  const android = { ...config.android, package: 'is.streakwar.phonetest' };
  delete android.googleServicesFile;
  return {
    ...config,
    name: 'StreakWar Test',
    platforms: ['android'],
    scheme: 'streakwar-test',
    android,
    updates: { ...config.updates, enabled: false },
    plugins: config.plugins.filter(plugin => plugin !== './plugins/withPlayStoreVerification'),
    extra: { ...config.extra, appVariant: 'phone-test' },
  };
};
