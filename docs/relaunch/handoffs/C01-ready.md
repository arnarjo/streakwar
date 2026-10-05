# C01 ready for baseline review

Task: C01
Master tasks: T01 (T00 environment inventory is supporting context)
Mode: REVIEW
Repository: arnarjo/streakwar
Branch containing the handoff: codex/streakwar-baseline
Base commit: a548c17ed39fa1f7002d7c054bea5e0091718a2a
Target commit: 02abe7ca1a5a4228a75cc84c6c4ecbdd77b3171c
Contract: NOT_REQUIRED

## Readiness and access

C00 is accepted; see `C00-accepted.md`. The target is a concrete baseline
checkpoint with executed local checks, not a completed native/device baseline.
This C01 review is explicitly allowed while the outstanding native build and
device evidence remain pending. Do not call T00/T01 complete or release-ready.

Fetch `origin codex/streakwar-baseline` if needed. Work from a separate review
branch/worktree containing this handoff, preserving existing changes. Review
the exact base-to-target range above; later handoff/status-only commits do not
change that target. Do not merge into master or into Codex's active worktree.
If either commit cannot be resolved, request the missing ref/patch rather than
reviewing some other HEAD. No dependency on the future T04 contract exists.

## Writable scope

- `docs/relaunch/claude/C01-result.md` — create the C01 review result.
- `docs/relaunch/CLAUDE_STATUS.md` — reconcile C00 acceptance and record C01.
- Application code, tests, dependencies, build configuration, READY files and
  Codex status: NONE. No test paths are leased in this review.

## Review scope and delivered behavior

Compare `a548c17ed39fa1f7002d7c054bea5e0091718a2a..02abe7ca1a5a4228a75cc84c6c4ecbdd77b3171c`:

- `package.json` / `package-lock.json`: Expo SDK 54 alignment, retained Hooks
  lint plugin 7.1.1, Android-only default production script, explicit all-platform
  alternative, dependency/prebuild/export scripts. No SDK-major/RN upgrade.
- `.github/workflows/ci.yml`: lint errors now gate CI; warnings remain visible.
- `.gitignore`: local `.env.*` protection, example exception.
- `AGENTS.md` / `CLAUDE.md`: concise single-agent task ownership and honest
  verification rules, replacing generic swarm instructions.
- `docs/relaunch/BASELINE.md`, `STATUS.md`, `handoffs/C00-accepted.md`:
  evidence, environment boundaries and deliberately incomplete T00/T01 status.

Read unchanged `eas.json`, `app.json`, `eslint.config.js`, `jest.config.js` and
the test scripts as needed to verify claims. Do not print credentials or copy
environment values into the report. Do not audit unrelated application screens.

## Checks already run

Full evidence and reproducible commands: `docs/relaunch/BASELINE.md` at target.

- Clean dependency installation from the updated lock passed.
- Typecheck passed; 4 unit-test suites / 62 tests passed.
- Lint passed with 0 errors / 64 existing warnings. No severity suppression was
  added; the same warning counts/categories remain after package alignment.
- Online Expo compatibility check passed; Android prebuild and Android
  JavaScript/Hermes export passed. Neither is an installable Android binary.
- Expo Doctor 1.20.4: 16/18 checks passed; exit 1 for duplicate fingerprint
  dependencies and the existing Apple Health package's New Architecture status.
- Native Gradle debug build: exit 1 before compilation, no Java runtime.
- `git diff --check` passed. Hosted CI, APK/AAB, installation and device testing
  have NOT been verified. No EAS cloud build was started.

Do not install dependencies or attempt another native build merely to repeat
these results. Targeted non-mutating checks are allowed for a suspected gap;
report what you actually run. Use synthetic data only and do not call live
backend endpoints, run migrations, make purchases or publish anything.

## Known failures and pending validation

1. Native toolchain absent locally. Compilation, install, launch/login and
   physical Health Connect/background behavior remain unverified.
2. Duplicate fingerprint chain predates this work: old root 0.15.4 / nested
   0.6.1; current root 0.15.5 / nested 0.6.1 through `react-native-health`.
   The latter package is also listed by Doctor as untested on New Architecture.
3. npm reported deprecated packages and unapproved lifecycle scripts. No
   vulnerability scan or blanket script approval is claimed.
4. Local Node 24/npm 11 differs from CI Node 20/Ubuntu; fresh hosted CI pending.
5. Preview, store-testing and production share the same configured Supabase
   project. They are NOT verified isolated test services. Dashboard credentials,
   installed phone build and device/Health Connect versions are still unknown.
6. Existing Health Connect correctness, scoring, RLS, subscriptions and Strava
   permitted-use issues are not fixed by this baseline. No contract is supplied.

## Acceptance criteria and result

- Check that manifest/lock changes match the described SDK 54 alignment and
  that the Hooks override is explicit and does not silently hide prior lint.
- Confirm default production is Android-only and that neither `build`,
  `prebuild:android` nor `export:android` is misrepresented as an APK.
- Confirm CI does not ignore lint errors and test/runtime boundaries are honest.
- Confirm the environment map does not imply production-safe integration tests.
- Identify actionable baseline regressions or missing evidence with severity,
  file/line, trigger, impact and proposed correction. Separate pre-existing
  issues, new issues and unverified behavior. Do not fix application/config code.
- Deliver the review even if it contains findings. C01 DELIVERED is not T01
  COMPLETE. No C02–C15 readiness is implied.

Save `docs/relaunch/claude/C01-result.md`, update Claude's own status, commit
only the leased report/status paths on the review branch, and return the exact
commit/branch using the packet's AFHENDING TIL CODEX format. Stop after C01.
