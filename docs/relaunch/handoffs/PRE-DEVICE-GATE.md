# Before the first updated Android phone build

## Current checkpoint — 2026-10-05

Accepted source: local 82be9fcc1f93240825ec649c3a3e51fdc9210f06;
published equivalent 39b722babadcc84d1e7ed15846036b76215b4027 on
codex/streakwar-baseline. Exact tree: 72d0cb1f81e3d57b0d1d3619f4c3797320be1677.
382 mocked tests /17 suites, typecheck and Android JS export pass. No updated
APK, installation or runtime evidence exists for this source checkpoint.
C02-R2 is the consolidated source-review gate, not release acceptance.

Before installation/testing:
1. Triage C02-R2 findings, fixing confirmed blockers with regression tests.
2. Choose a safe backend/test-account plan. Preview/store-testing/production
   still share the live project. Do not infer isolation from a build profile.
   Live security fixes authorized separately do not authorize health fixtures,
   destructive migration resets or test-data publication into competitions.
3. Build from an exact accepted commit, record artifact/version/signature and
   confirm target configuration without publishing credentials or health data.
   Paid EAS jobs and Play uploads require owner authorization.
4. Run the scenario matrix below, initially with synthetic data; record failures
   and missing evidence explicitly. Old installs cannot validate new source.

Source-review completion cannot replace phone/background/permission evidence.

## Historical preparation — 2026-10-01

The following preparation was recorded against 2fd19dec38170889694cba09f46cbfe05f046713.
GitHub publication and subsequent source fixes are recorded above and in STATUS.

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
