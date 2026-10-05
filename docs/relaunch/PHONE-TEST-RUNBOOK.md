# Android phone-test runbook

Scope: isolated StreakWar-test, private Health Connect intake, synthetic records.
Not a launch or acceptance of subscriptions, Strava, social sharing or iOS.

## Build isolation

- Select only `phone-test` in eas.json, not preview/store-testing/production.
- Local commands: `node scripts/phone-test.cjs <command> [args...]`.
- Public config must show StreakWar Test, package `is.streakwar.phonetest`, scheme
  `streakwar-test`, test Supabase URL, no purchase keys, OTA disabled.
- Push registration/reminders are skipped in this test variant. No production
  Firebase configuration or Play ownership token is added on a fresh prebuild.
- Use a fresh generated Android directory when changing variants: Expo's
  incremental prebuild can retain old schemes and Google Services configuration.
  Preserve old generated files by moving them to a named temporary backup; do not
  destructively remove user work. Current backup:
  `/private/tmp/streakwar-native-backup-PH2mRV/android`.
- Current toolchain: `/Users/arnarjohannsson/Documents/Codex/android-toolchain/env.sh`.
- Local standalone build command (after sourcing toolchain):
  `NODE_ENV=production node scripts/phone-test.cjs android/gradlew -p android :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain --max-workers=2`
- This local release variant is debug-signed for internal use, not Play release
  signing. Confirm APK package, certificate, embedded bundle and backend before
  installation. No EAS job is started by this command.

## Device gates

### Current UI refresh artifact — 2026-10-05

- Same APK path/package/signature below, new SHA256:
  `ee81202d762e99eb39a930ebcda9dfd548d19f48b2eefa0c840da18fe035db69`.
- Offline native build PASS in 1m; TEST URL/new UI/Ionicons verified in APK.
- 536 Jest tests/20 suites, TypeScript, 11 Node tests pass; lint 0 errors/56 warnings.
- USB inventory empty: new APK NOT installed; visual/device QA pending.
- See handoffs/UI-REFRESH01-integration.md. Update in place without clearing data.

### Earlier installed artifact — 2026-10-05

- `android/app/build/outputs/apk/release/app-release.apk`
- SHA-256: `90bd2ce60394385fc300b86590de3c2fb5b08a71be7523760ae9127778ed968c`
- BUILD SUCCESSFUL in 3m 21s, 988 tasks. First offline attempt found two missing
  Maven dependencies; normal dependency resolution succeeded without EAS.
- Verified package `is.streakwar.phonetest`, label StreakWar Test, versionCode18,
  minSdk26/target36, arm64-v8a; signature valid, Android Debug certificate.
- Embedded Hermes bundle present (3696388 bytes). Test URL/public key/private
  table present, production URL and production purchase key absent.
- 484 Jest tests/19 suites, TypeScript and 11 Node tests pass; targeted lint
  0 errors/3 pre-existing push-hook warnings. Native dependency deprecations and
  Gradle metaspace warning remain non-fatal; no warnings suppressed.
- Later device checkpoint: S24 / SM-S921B, Android 16, arm64. APK hash matched;
  USB installation returned Success and package presence was verified. Owner
  reports launch and email/password login succeed. These are distinct from full
  device acceptance; deduplication, correction and background tests remain open.

1. Owner connects an arm64 Android phone via USB, enables USB debugging and
   personally approves the computer. Record Android version, device model and
   Health Connect version/capability without collecting a device serial in docs.
2. Install ONLY the verified `is.streakwar.phonetest` APK; never uninstall the old
   app or clear its data. No store upload or unknown-source warning bypass.
3. Owner creates a new test account with their own password.
   Passwords, confirmation links and access tokens must not be pasted into chat.
   First scope is email/password, not Google/Facebook. On 2026-10-05 the owner
   approved `streakwar-test://`; Site URL was changed and verified after reload.
   Following separate action-time owner approval, Confirm email was disabled
   ONLY in vqizpuqmsykmhlyihyry and verified OFF after dashboard reload.
   Anonymous sign-ins and manual linking remain disabled. No production auth change.
   RELEASE GATE: re-enable email confirmation and verify signup/confirmation
   before release; this temporary testing exception must not be copied to production.
   Existing account login is still a device test, not proven by this setting.
4. Confirm Home opens; private activity card shows empty, not an error. Sign out,
   sign in, background/reopen and repeat. Do not claim success from SQL tests.
5. BEFORE enabling Health Connect: use a clean test phone/profile containing only
   synthetic activity. Do not delete personal health data to prepare a test, and
   do not enable access to a real-history store. Owner approves OS health access.
6. Add a known synthetic 30-minute exercise and 5000 steps with an authorized
   test writer. Run manual sync; expect two imported records and 8 personal points
   if both map as the tested records. Repeat sync: no duplicate or point increase.
7. Correct steps to 6000: expect 9 points; 4000: expect 7. Public challenge/profile
   points and leaderboard must not increase from private imports.
8. Disconnect and retry: no new imports. Deny/revoke permission: understandable
   UI, no silent-success claim. Account B must not see A's private records.
9. Background sync is a separate test: feature check, explicit background
   permission, app background/restart and natural scheduling. Do not infer it
   works merely because foreground sync or APK compilation succeeds.

Record expected/observed outcomes, exact source/APK hashes and failures. Stop on
unexpected production URL, personal records, wrong package, auth mismatch or
public scoring side effects. Fix before expanding the test scope.
