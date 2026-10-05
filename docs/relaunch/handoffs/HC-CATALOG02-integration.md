# HC-CATALOG02 integration — 2026-10-05

Claude's read-only review completed in the authorized personal-Chrome session
`session_01JBigCXGLSLxifMZMBGxSgN`, against published commit
`4274b2cd1ec116b00490c5772920d777c0af0725`. The review concerned the proposed
delta in the READY prompt, not a final patched checkout. This is Codex's summary
and disposition, not a verbatim copy of Claude's report.

## Disposition

- D1: an exercise retry must verify the **attempted challenge** too, because a
  trigger conflict could roll back that row while another challenge copy exists.
  Accepted: null uses `.is('challenge_id', null)`, non-null uses `.eq`.
  Exact user/source/external ID and bounded result retained. Regression checks
  the null path and rejects absent rows in the attempted challenge. The actual
  concurrent trigger race is a hypothesis, not a reproduced SQL claim.
- D2: require a positive integer affected-row count. Accepted; 0, null,
  undefined, NaN, negative and fractional counts fail without reporting success.
- D3: global insert/update/delete and aggregate paths still overcount copies.
  Confirmed independently with rollback-only hosted SQL. Not fixed by the client
  update. Parent/challenge foreign keys use SET NULL; no simplistic parent-null
  filter accepted as a scoring solution.
- D4: moving from solo to an active challenge can insert a second Steps identity
  because the per-challenge key differs; this predates the patch. Recorded as
  unresolved. Canonical identity and sharing decision must address it.
- Source-filter statement in the earlier reconciliation was inaccurate for its
  base: old Steps UPDATE filtered only user/external ID. Corrected in that doc.

No Claude source changes were imported; Codex implemented the reviewed changes.
Future backend tests must cover one/three challenges, solo-to-challenge changes,
parent deletion, correction/deletion, weekly/league rankings and achievements.
Review suggestions about copy markers or deduplicated aggregates are options,
not accepted architecture. A copy marker alone does not fix solo-to-challenge
duplicate roots or reconstruct historical orphan identities.

## Verification

- Full Jest: **428 tests /18 suites PASS**.
- TypeScript: PASS.
- Targeted lint: 0 errors, 2 pre-existing warnings.
- Android JS/Hermes export: PASS, **not an APK**.
- Baseline renderer: four Node tests PASS.
- Hosted rollback-only test: corrected source-scoped Steps UPDATE preserves
  two challenge memberships and the other source; ownership/solo checks PASS.
- Separate post-test read-only check: public tables 0, auth users 0, marker
  schemas 0. No persistent test deployment, production writes or real health data.

Client checkpoint accepted within this bounded scope, NOT Expo/device readiness.
Pending: user sharing choice, coherent scoring/identity correction and backend
acceptance, persistent isolated schema/auth setup, isolated Expo configuration.
