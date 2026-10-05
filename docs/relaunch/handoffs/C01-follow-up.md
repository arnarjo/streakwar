# C01 received — Codex disposition

Cloud session: https://claude.ai/code/session_01JJkjPxGJV5KhD9sFg8ZFFX
Reported report commit: `214352430c8143edd2add472c021608b4506c149`,
branch `claude/c01-baseline-review`, based on handoff HEAD `4870123`.
Codex read the final response and full rendered report in official Claude
Desktop. The remote commit has not been fetched/merged; Claude's local status
file is therefore deliberately not overwritten. This document is Codex-owned.

Claude found no introduced baseline regression in `a548c17..02abe7c`.
The report is not an APK/device or release approval.

## Disposition

- F1 (medium): confirmed directly in tracked settings. Disable legacy project
  hooks/teams/MCP, preserve env read protection, deny delegation by default.
  Retain old helper files without running them. Add regression tests.
- F2 (low): hosted CI and Node-version parity remain pending. Do not change
  runtimes solely on the report's unverified lifecycle claim. The existing
  workflow runs on pushes to master and PRs targeting master.
- F3 (low): warning cap is a possible later improvement, not a baseline
  regression. Existing lint errors gate CI; the disclosed 64 warnings remain.
  Do not add a permissive cap or suppress warnings just to appear green.
- F4 (low): documentation clarified after checking installed package metadata.
  Hooks ^5.1.0 is a dependency of eslint-config-expo 10.0.0, not a peer.
  The override selects 7.1.1; legacy-peer-deps affects peer validation separately.
  No dependency or lockfile adjustment is needed for this clarification.
- F5 (low): background behavior after SDK package alignment needs native/device
  evidence. It remains a T02/T03 and later C02 concern, not a completed fix.

## Verification

Executed: all 65 unit tests passed in 5 suites (including 3 new config tests);
typecheck passed; lint passed with 0 errors and the same 64 warnings;
git diff --check passed. These results supersede no native/device requirement.
No package installation, external build, deployment, backend call or device
test is part of this configuration/documentation follow-up.
