# Before the first updated Android phone build

Current code snapshot: 2fd19dec38170889694cba09f46cbfe05f046713.
Nothing has been pushed or submitted. Old phone installs cannot test this code.

## Can continue without a physical phone

1. Partial independent C02 review delivered; initial confirmed disconnect and
   zero-row-status defects corrected. Finish remaining scope/fixes listed in
   `C02-follow-up.md`; not accepted as complete.
2. Local JDK/Android SDK established and arm64 debug APK compiled successfully
   on 2026-10-01. See `../LOCAL-ANDROID-BUILD.md`. Release/other ABI compilation
   and installation/runtime checks remain separate requirements.
3. Capability-gated Health Connect bridge/manifest/UI implemented and compiled
   in `2fd19de`. Runtime/native-method/permission-dialog and actual background
   delivery evidence remains pending; compile evidence is not runtime proof.
4. Resolve C02 blockers with synthetic regression tests and rerun standard checks.
5. Establish an isolated backend for RLS/idempotency tests. Existing EAS profile
   names do not imply isolation; no live fixtures or migrations are authorized.
   Local SQL/runner prepared in `../LOCAL-DATABASE-TESTS.md`, not executed.
6. Prepare T04 contract examples; do not finalize owner scoring/privacy/Pro
   choices or start dependent UI/API implementation based on unapproved assumptions.

Native compilation and emulator checks can precede a real phone. This gate is
not a claim that no useful software work remains, nor a reason to defer the
first phone checkpoint until the whole product is finished.

## First phone checkpoint (pending; all results must be recorded)

Record commit, build ID/versionCode, install channel, device/Android/Health Connect
versions, source app, account and isolated environment. Do not include raw health
records or credentials in reports. Use a synthetic/test exercise where possible.

| Scenario | Required evidence |
|---|---|
| Fresh install and login | App launches and native Health Connect initializes |
| Exercise read granted, Steps denied | Exercise progress retained; clear missing-steps status |
| Previously granted/revoked permissions | Accurate current state and recoverable request flow |
| Background capability unsupported/permission denied | Foreground works; no background promise |
| Foreground import, retry, offline recovery | Source IDs/counters consistent; no duplicate credit |
| Disconnect/reconnect, then restart | Connection policy respected; task registration checked |
| Switch A→B during read/write | No old-account UI/status; backend ownership enforced |
| Screen locked / app backgrounded | Natural scheduled run recorded, not just forced invocation |
| Reboot and battery restrictions | Actual behavior/timing recorded, no guaranteed interval |
| Force-stop and reopen | Limitation explicit; safe catch-up without false success |

Repeat relevant cases on a second supported Android phone. Separately test real
Play purchase flows later in T14, not as part of this first Health Connect gate.
