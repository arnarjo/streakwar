# Local Android build checkpoint

Date: 2026-10-01. Application snapshot: `d692eb3`; documentation HEAD when
starting: `bb80eee`. Local tooling only; no cloud build or deployment.

## Toolchain

Dedicated machine-local directory (not committed):
`/Users/arnarjohannsson/Documents/Codex/android-toolchain`.
Its `env.sh` sets JAVA_HOME, ANDROID_HOME, ANDROID_USER_HOME, GRADLE_USER_HOME
and PATH for the invoking shell only. No global shell configuration changed.

- Temurin JDK 17.0.20.1+1, macOS aarch64, verified with `java -version`.
- Google command-line tools 15859902, sdkmanager 22.0.
- SDK platform android-36 revision 2; build-tools 36.0.0. Gradle additionally
  installed build-tools 35.0.0 under the accepted SDK license.
- NDK 27.1.12297006; CMake 3.22.1; platform-tools 37.0.1.
- Gradle 8.14.3 from the existing project wrapper.

JDK archive downloaded from the official Adoptium release; SHA-256:
`196d13ba5f10414bef7f6a05a9b3f00edacb18ebacef2b99485db9e2ee18f0e8`.
Google command-line ARM archive SHA-256:
`835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e`.
Both matched their official published checksums before extraction.
SDK package installation completed with exit 0; `--list_installed` confirmed
the versions above. Android SDK license was accepted during installation.

## Command

From this repository's generated `android/` directory:

```sh
source /Users/arnarjohannsson/Documents/Codex/android-toolchain/env.sh
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain --max-workers=2
```

This checks only arm64-v8a. A debug APK is not a signed Play release and normally
needs Metro; do not distribute it as a standalone production build. Do not run
install/launch commands against the shared live backend as part of compilation.

## Evidence and limitations

- **PASS:** `BUILD SUCCESSFUL in 9m 4s`, exit 0; 579 tasks executed.
- Artifact: `android/app/build/outputs/apk/debug/app-debug.apk`, about 79 MiB.
  SHA-256: `cd93d58cecd2761a4760f0eff1fcb4d948c8aa67e5d83603337040de2f7efe3a`.
- `aapt dump badging` confirmed `is.streakwar.app`, versionCode 18,
  versionName 1.0.0, minSdk 26, target/compile SDK 36, arm64-v8a only.
- `apksigner verify` passed (exit 0); this is debug signing, not Play signing.
- Health Connect Kotlin/Java and the app's native CMake tasks compiled.
  JavaScript tests/export and runtime behavior are separate evidence.
- Non-fatal warnings remain: dependency deprecated APIs/Gradle 9 incompatibility,
  SDK XML version mismatch, Amazon Appstore SDK D8 stack-map warnings,
  FSEvents/Android metrics sandbox access, and missing explicit NODE_ENV.
  Use `NODE_ENV=development` for subsequent debug builds; do not change
  dependencies or suppress warnings solely to make this record look clean.
- `adb version` aborted because the sandbox denied creation of `~/.android`;
  no device was enumerated or contacted. This is not a compilation result.
- No app install, emulator launch, login, health-data access, store submission
  or live database operation performed.
- Native background Health Connect capability/permission work and physical
  phone evidence remain required even after a successful compilation.

## Background capability checkpoint — 2fd19de

The earlier artifact above has been superseded locally by the new debug APK.
App code snapshot: `2fd19dec38170889694cba09f46cbfe05f046713`.

- Added tracked Kotlin templates + Expo plugin; repeated Android prebuild
  generated the bridge, one package registration and one explicit dependency.
- Retained connect-client 1.1.0-alpha11 already used by the RN wrapper. Its
  feature check requires `@OptIn(ExperimentalFeatureAvailabilityApi::class)`.
- Build command as above with `NODE_ENV=development` and `--offline` passed:
  `BUILD SUCCESSFUL in 19s`, 579 tasks (30 executed, 549 up-to-date).
- New APK SHA-256:
  `21b82be649a086dc9b4308d9801e7e83e77a13f20b53919bfaa28ca9fe254157`.
- `aapt dump permissions` confirms READ_HEALTH_DATA_IN_BACKGROUND in the APK;
  `apksigner verify` passed. Same development app ID/versionCode; not distributed.
- Typecheck, 163 unit tests in 10 suites, lint (0 errors / 63 warnings), Android
  JS export and diff checks pass. Tests use mocks/synthetic records only.
- Initial attempts caught a plugin closing-brace error, an incorrect TS cast,
  the required Kotlin experimental opt-in and an unsupported dynamic-import
  path in Jest. Corrected source and reran checks; no test expectations weakened.
  Gradle also needed local socket access blocked by sandbox network restrictions;
  permission was granted and the subsequent build used offline dependencies.
- Native bridge invocation under RN New Architecture, actual UI/dialog rendering,
  denied/revoked permissions on device, natural scheduling and Play review remain
  unverified. No install, live health reads or service/database writes performed.

Reference: [Android background read guidance](https://developer.android.com/health-and-fitness/health-connect/read-data#background-read-example).
Background access requires both feature availability and explicit permission;
registration alone is not delivery evidence.
