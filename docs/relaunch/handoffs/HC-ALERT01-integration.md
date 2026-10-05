# HC-ALERT01 acceptance — 2026-10-05

Claude cloud base f1c5a916bf4ff240224121d7ac0c30ea03251527; delivered
a6830d5a8e884db4c6a3ffa94df5161b3fdbd148 via the existing personal Chrome session.
Original tool-output gzip/base64: 5860 characters; decoded diff: 17220 bytes.
SHA256 verified locally: 12cbe3e582ef49c841fdc4ef561d9cc1b32f4ee3a9622adfa145b3e4417bd982.

Only the two leased screens, screen tests and archived result were imported.
Existing local act-wrapped teardown context was retained, adopting Claude's
awaited act wrappers. Formatter fixes and six independent regressions absent
from the cloud checkout remain intact.

Review: each screen captures a monotonically changing layout-effect generation
for manual sync, checks it after await in success and catch, and invalidates on
account change and unmount. This covers committed A-B-A transitions without
relying on equality of the final user ID. Same-account feedback is unchanged.
No backend, native, dependency, scheduler or timestamp edits.

Independent local validation:
- npm test -- --runInBand: 382 tests / 17 suites PASS (20 added).
- npm run typecheck: PASS.
- Targeted eslint on both screens and screen tests: 0 errors, 4 existing warnings.
- git diff --check: PASS.
- npm run export:android: PASS (JavaScript/assets only, not an APK).

Tests render both real screens with mocked native primitives and deferred
operations, covering stale success/typed partial error, A-B-A, unmount and fresh
operations. They do not prove real-device or app-wide async isolation.
Other async actions are outside this acceptance. No new APK or release.
Next gate: consolidated C02/A1 review and an exact safe device-test checkpoint.
