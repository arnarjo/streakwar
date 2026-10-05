# HC-LIFE01 integration review — 2026-10-01

State: ACCEPTED for the bounded local lifecycle scope; device acceptance pending.

Cloud base: `3864569a5c3d89c25e8bea153ef2c173f46e6105`.
First delivery: `c4b798ff97e6dd2518224212cd586fe197de04df`.
10 changed paths all within the lease, report archived under `../claude/`.
Exact tool-output payload: 21248 base64 characters; 71182 uncompressed bytes.
SHA256 independently verified before applying:
`1a7062d29aff4f6efd0e4d6804a940a8e6280d49f4e6b27ede01c64959d27601`.

Important transport lesson: final response retyped a corrupt payload (28595
characters), despite claiming exact output. It was rejected by gzip validation.
The expanded original command output contained the valid payload. Future
transport must use original tool output and verify the hash, never trust a
final-response assertion. Native AX truncates long values; Chrome DOM is complete.

## Initial local verification

- Standard typecheck PASS.
- All 273 tests / 15 suites PASS.
- Added four adversarial regressions: all four FAIL, 39 existing targeted tests
  PASS. These expose actual acceptance gaps, not environmental failures.

## Corrections sent to the same session

1. ABA: an old queued disconnect for A is accepted after A -> B -> A because
   epoch is captured when execution begins instead of when operation is enqueued.
2. Android startup failure returned as false is ignored; next same-owner request
   does not retry after a transient native registration error.
3. Explicit disconnect ignores unregister's returned false and resolves success.
4. PASSWORD_RECOVERY returns before identity/profile invalidation and lifecycle
   reconciliation, retaining A when the recovery session belongs to B.

Sent reproductions and a bounded correction request. The four independently
added regressions were preserved unchanged when integrating the correction.

## Correction accepted locally

Cloud correction: `1a1f3b57651f23bc5cf5646bbf73b2c458b88228`.
Original tool-output payload: 7244 base64 characters; 18571 uncompressed bytes.
SHA256 independently verified:
`52d6d08746eb9dd2e691ed88e3bc06a5542ad277cb564332eaeb4edf8f374f0a`.
Five leased paths changed, including the archived Claude report. A local
transcription duplicate was rejected by gzip and corrected before applying.

- `npm test -- --runInBand`: PASS, 290 tests / 15 suites (including all four
  independent regressions which failed against the first delivery).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, 0 errors / 61 warnings; warnings are not release approval.
- `npm run export:android`: PASS, Android JavaScript/assets only, not an APK.
- `git diff --check`: PASS.

The coordinator now captures operation epochs at enqueue time, retries incomplete
startup, and reports unregister failures. Cross-account PASSWORD_RECOVERY drops
the previous identity/profile and requests local health cleanup synchronously;
the callback itself remains synchronous. Purchases logout and reminder cleanup
in this recovery branch are accepted as old-account cleanup, not a billing
redesign. The recovery event itself does not adopt the new health owner; later
normal auth events still follow the usual owner path.

Limits: already-dispatched database requests are not atomically cancelled;
non-consented Android accounts may re-check consent on repeated auth events;
cold-start stale identity, iOS permission callbacks, and broader purchases or
notification races are not closed by this package. No new native compilation,
device tests, live-service writes, push, deployment or store submission.
T02/C02 remain incomplete. Next bounded A1 work: per-record/per-type partial
completion and retry semantics, followed by independent review and an exact
device-test build checkpoint.
