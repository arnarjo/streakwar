# HC-BATCH01 integration review — 2026-10-01

State: ACCEPTED for this bounded implementation; T02/C02 remain incomplete.

Initial cloud commit: `3e9f00289e669b0a6337e556d1c81f673aabf74d`.
Snapshot base: `c9c910f9d23cd9b85ebdbda05f3bb67b5ef3d357`.
Retrieved complete gzip/base64 diff through the authenticated Chrome session.
Decoded bytes: 23549; SHA256 verified:
`5b9edc7129c0ec19fdef9595605e936f740282afb7eb36b803eb9b37087d361b`.
All five delivered paths match the lease. Applied locally for verification;
original report archived under `docs/relaunch/claude/HC-BATCH01-result.md`.
No cloud Git remote/push/PR, live-service or device operation.

## Independently verified initial delivery

- `npm run typecheck`: PASS with the unchanged standard configuration.
- `npm test -- --runInBand`: PASS, 205 tests / 13 suites.
- Actual new tests: 15 polling + 9 helper = 24 (not the report's 14 + 9).
- Cloud-only missing Jest globals are not reproduced locally; no config weakened.
- Android JavaScript/Hermes export: PASS (not an APK or device test).
- Full lint initially exposed one existing Node-script global error in the
  earlier migration audit. Declared CommonJS `__dirname` read-only in that file;
  lint now reports 0 errors / 63 existing warnings. No lint rule disabled.

## Corrections returned to the same Claude session

1. URL budget underestimates form encoding. Using the installed PostgrestClient
   with a synthetic URL and no request, a single ID containing 3990 exclamation
   marks has estimated cost 3999 but actual encoded filter-value length 11979.
   Require conservative punctuation/framing accounting and tests against the
   real installed query builder rather than the estimator alone.
2. Stop individual retries after the first exercise error/unverified duplicate,
   not just before the next batch; retain earlier counts and hold the cursor.
3. Validate exported helper size/budget parameters to avoid a zero-size loop.
4. Correct report counts and distinguish exercise stopping from unchanged Steps.

Follow-up delivered in `session_01JBigCXGLSLxifMZMBGxSgN`.
Correction commit: `3864569a5c3d89c25e8bea153ef2c173f46e6105`.
Incremental diff: 16925 bytes, SHA256 verified:
`47851aae48334aff14a400fa91513b1f04f3b242eabb0fe3baadea155f5a2540`.
All five paths remain in the lease. Accepted after reviewing encoded framing,
UTF-8 upper bound, positive-size guards, early retry stop and new regression tests.
No dependencies/config/native/backend changed. Codex only clarified the budget
comment to avoid implying a measured proxy limit or including headers in a URL.

## Final local acceptance

- Standard `npm run typecheck`: PASS, unchanged configuration.
- `npm test -- --runInBand --silent`: PASS, 223 tests / 13 suites (42 above base).
- `node --test scripts/audit-migration-history.test.cjs`: PASS, 4 tests.
- Full ESLint: 0 errors / 63 warnings after the separate Node global declaration.
- Android JavaScript/Hermes export: PASS with corrected code, not an APK.
- `git diff --check`: PASS.

Actual installed query-builder serialization is tested without network, including
punctuation, Unicode, lone surrogates and boundary/oversize cases. The budget is
intentionally conservative (ASCII IDs can split well below the 100-ID ceiling).
Typecheck failure in the first cloud report was not reproduced locally or in
Claude's final run; no evidence establishes its original cause.

No live service/data writes, publication, reset or new billing setting. Phone,
native background delivery, provider permissions and real RLS remain unverified.
Next scoped task: logout/account-switch cleanup race from C02/A1, before phone QA.
