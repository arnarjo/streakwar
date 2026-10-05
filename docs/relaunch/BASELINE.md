# StreakWar Android baseline

Codex evidence for C01, recorded 2026-09-29–30. This is a partial T00/T01
baseline, not an Android release approval. The exact review target is identified
in `handoffs/C01-ready.md` after the baseline commit is created.

## Checkout and scope

- Repository: `arnarjo/streakwar`.
- Start: `a548c17ed39fa1f7002d7c054bea5e0091718a2a`, Claude C00, based on
  `58a91d95e97a8dcc80355bd6d0c86abd9c586714`.
- Working branch: `codex/streakwar-baseline`, a separate clean clone of C00.
- Source configuration: app `1.0.0`, Android package `is.streakwar.app`,
  `versionCode: 18`. The version actually installed on Arnar's phone is unknown.
- Local checks: macOS arm64, Node `24.20.0`, npm `11.19.0`.
  CI still uses Node 20 on Ubuntu; a fresh hosted CI run is not claimed.
- No application source, database migrations, service data, credentials,
  Health Connect logic, scoring or payments behavior was edited.

## Changes and their limits

1. Aligned packages to Expo SDK 54's current compatibility recommendations;
   Expo resolves to `54.0.37`, React Native remains `0.81.5`.
   In particular, Background Fetch and Task Manager move from SDK-old v12
   packages to `~14.0.9`, and build-properties to `~1.0.10`.
   This does not migrate Background Fetch to a new scheduling API or prove
   that a real background import works.
2. Used the SDK 54 ESLint config (`~10.0.0`) and explicitly retained
   `eslint-plugin-react-hooks@7.1.1` through an override. The previous lock
   already used 7.1.1. This keeps the existing advisory rules available rather
   than dropping them during config alignment. `eslint.config.js` is unchanged;
   the 64 warnings remain visible and unchanged in count/rule categories.
   The installed `eslint-config-expo@10.0.0` declares Hooks `^5.1.0` as a
   **dependency**, not a peer dependency; our explicit override selects 7.1.1.
   Existing `.npmrc` uses `legacy-peer-deps=true`, which bypasses peer checks,
   but is not what selects this Hooks version. Passing lint is the observed
   evidence, not proof of compatibility with every future config release.
3. Made `build:prod` Android-only. Both-platform builds require the explicit
   `build:prod:all`. Added named dependency-check, Android prebuild and export
   scripts. The legacy `build` script still only runs TypeScript.
4. Removed CI's `continue-on-error` for lint: actual lint errors must now fail.
   Warnings are not presented as resolved. Existing tests/ignores were not weakened.
5. Replaced generic swarm instructions with short project-specific instructions
   in `AGENTS.md`/`CLAUDE.md`. Preserved Claude's packet and status untouched.
6. Added `.env.*` to ignored local files, keeping `.env.example` available.

### C01 follow-up (after the original review target)

The original target still contained active legacy Claude settings despite the
new single-agent instructions. The follow-up replaces project settings with
disabled hooks/teams, explicit delegation/MCP denies and preserved env-file
read protection; `.mcp.json` registers no servers. Legacy helper/agent files
are retained, not deleted or executed. This does not change account-wide
permissions or prevent a human from manually running a helper.

`tests/agentConfiguration.test.ts` guards these checked-in defaults. Future
parallel-agent work needs an explicit reviewed settings change; do not quietly
restore the previous orchestration or `npx ...@latest` launch permissions.
No application runtime, dependency versions or lockfile changed in this follow-up.

Package alignment followed the Expo CLI compatibility check, not an SDK-major
upgrade. See the official [Expo CLI documentation](https://docs.expo.dev/more/expo-cli/).

## Executed checks

| Check | Starting C00 checkout | Updated baseline |
|---|---|---|
| `npm ci --no-audit --no-fund` | Passed | Passed again from updated lock, 1,131 packages |
| `npm run typecheck` | Exit 0 | Exit 0 |
| `npm test -- --ci --runInBand` | 62 passed in 4 suites; initial run omitted `--ci` | 62 passed in 4 suites |
| `npm run lint` | 0 errors, 64 warnings | 0 errors, 64 warnings |
| `CI=1 npm run check:dependencies` | Original equivalent `expo install --check` failed with 14 recommended alignments | Exit 0, dependencies up to date |
| `CI=1 npm run prebuild:android` | Not run | Exit 0; Android sources generated |
| `CI=1 EXPO_OFFLINE=1 npm run export:android -- --max-workers 2` | Not run | Exit 0; 1,726 modules, Hermes bundle and assets exported |
| `npx --yes expo-doctor@latest` (resolved `1.20.4`) | Not run | Exit 1; 16 of 18 checks passed; two findings below |
| `./gradlew :app:assembleDebug --no-daemon` from `android/` | Not run | Exit 1 before compilation: no Java runtime |
| `git diff --check` | Clean start | Exit 0 |

Final typecheck, unit tests and lint were rerun after the clean `npm ci`.
The lint run used `--format json --output-file ../streakwar-baseline-lint.json`
to count results, without changing severity or the checked paths.
Generated `android/` and `dist/` remain ignored and are not source deliverables.
No live backend credentials were supplied to the local JavaScript export;
bundling is not login, network, native-module or device verification.

### Remaining lint warnings

| Rule | Count |
|---|---:|
| `import/no-duplicates` | 6 |
| `react-hooks/exhaustive-deps` | 11 |
| `react-hooks/refs` | 15 |
| `@typescript-eslint/array-type` | 7 |
| `react-hooks/set-state-in-effect` | 14 |
| `@typescript-eslint/no-require-imports` | 4 |
| `@typescript-eslint/no-unused-vars` | 5 |
| `react-hooks/preserve-manual-memoization` | 2 |

## Outstanding findings and device evidence

- Expo Doctor reports duplicate `@expo/fingerprint`: root `0.15.5` and
  `react-native-health/node_modules/@expo/fingerprint@0.6.1`. The old lock
  already contained the root `0.15.4` and nested `0.6.1`, so the duplicate
  dependency chain predates this work. Do not force a transitive-major override
  or suppress this check just to make Doctor green.
- Expo Doctor reports `react-native-health` as untested on New Architecture.
  This existing Apple Health dependency is not proof of an Android failure,
  but native compatibility remains unverified. Resolve or justify it before
  calling the native baseline/release complete.
- npm warned about deprecated transitive packages and unapproved lifecycle
  scripts for `esbuild`, `fsevents` and `unrs-resolver` in npm 11. Scripts were
  not newly approved; the listed JS checks passed in this environment.
  `--no-audit` means no security-audit result is claimed.
- Historical baseline: the machine had no working Java runtime/Android SDK;
  Gradle reported `Unable to locate a Java Runtime.` No APK was produced then.
  Superseded on 2026-10-01: dedicated local JDK/SDK installed and arm64 debug
  APK compiled successfully; details in `LOCAL-ANDROID-BUILD.md`.
  No APK has been installed/opened and no EAS cloud build was started.
- Pending: release/other ABI compilation, physical-device install, launch/login
  and module initialization.
  Record device model, Android/Health Connect versions and installed app build.
- Pending T02/T03: partial/revoked permissions, no data vs failure, per-account
  cursors, duplicate import, background/locked-screen behavior, reboot,
  battery restrictions, force-stop/reopen and recovery on two supported phones.
- No claim is made about Supabase RLS, payments, Strava policy compliance,
  deletion or public competition correctness from these unit tests.

## Environment and access map

| Environment or service | Verified configuration | Limit or next check |
|---|---|---|
| Local unit tests/export | No service configuration injected; source fallback for missing Supabase env remains | Not an authenticated app test |
| EAS `development` | Internal development client; no inline `env` section | Remote/dashboard environment values unknown |
| EAS `preview` | Internal APK profile | Same configured Supabase project as production |
| EAS `store-testing` | Android app-bundle, `store-testing` channel | Same configured Supabase project as production |
| EAS `production` | Existing store profile | No cloud build/submission run |
| Supabase | The last three profiles all reference `uzstenhkngldkrwnsmku.supabase.co` | Treat as shared/live until an isolated test environment is established |
| RevenueCat | Android/iOS public SDK environment variable names present | Dashboard, products, entitlements and Play purchases not verified |
| Google Play internal test | Link supplied by Arnar; code versionCode is 18 | Installed build and console state not verified |
| Strava | Existing integration in source; Arnar reports previous sync success | Current access and permitted public-data use not established |

Relevant client variable names are `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` and
`EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`. Values are deliberately omitted.
EAS profile names do not create separate databases. Do not run integration
fixtures or migrations against those profiles as though they were staging.

## Completion boundary

C01 may review these concrete changes and evidence now. T00 and T01 remain
in progress: the device/access inventory is incomplete, native build/install
is unverified and Doctor findings remain. C01 delivery does not unlock all
later tasks or make the app release-ready. `CONTRACTS.md` is intentionally not
required for this review; the proposed data/product contract belongs to T04.
