# StreakWar Codex relaunch status

Updated: 2026-10-05. Baseline branch: `codex/streakwar-baseline`.
This file records Codex progress; Claude owns `CLAUDE_STATUS.md`.

Latest checkpoint: PHONE-TEST provisioning approved and persisted in isolated
vqizpuqmsykmhlyihyry. 23/23 tables have RLS; zero users/private records. Post-commit
private intake acceptance passed inside rollback, then zero fixtures verified.
See database/PHONE-TEST-PROVISIONED-2026-10-05.md. Separate Android phone-test
profile built locally: standalone debug-signed release APK, package
is.streakwar.phonetest; signature and embedded TEST backend verified. See
PHONE-TEST-RUNBOOK.md for artifact hash and exact evidence. No paid EAS build or
store submission. No phone connected; installation/device evidence outstanding.

Previous checkpoint: PRIVATE-FIRST01. Owner delegated sharing choice; selected
private imports until explicit share. HC now uses a separate canonical private
table with its own cursor; private points have no public/social effects. Claude
delivered the summary hook/card; Codex added two reproduced callback-race fixes
and integrated Android Home/Connect. 484 tests /19 suites, typecheck, seven Node
tests and Android JS export pass. Targeted lint 0 errors /10 existing warnings.
Hosted rollback-only private ownership/dedup/scoring/consent checks PASS; separate
post-test check confirms 0 tables/0 users/0 markers. See
handoffs/PRIVATE-FIRST01-integration.md and PRIVATE-FIRST-CONTRACT.md.
Persistent test provisioning/access was pending at that checkpoint; now approved
and applied as recorded above. No production changes or device evidence.

Previous checkpoint: isolated hosted rollback rehearsal actually executed. Baseline and
two-user ownership/solo checks pass; multi-challenge update collision and global
double credit reproduced. Client correction preserves challenge links, scopes
updates/duplicate confirmation to Health Connect, and requires nonzero update
count. Expanded hosted SQL confirms two copies update without touching another
source. Claude HC-CATALOG02 review prompted exact-challenge duplicate verification
and positive-integer count validation; both integrated. 428 Jest tests /18 suites,
typecheck, Android JS export and four baseline-renderer tests pass; targeted lint
0 errors /2 existing warnings. See handoffs/HC-CATALOG02-integration.md and
database/HOSTED-REHEARSAL-2026-10-05.md.
No persistent test schema or production data changes at that checkpoint. Sharing
choice was then open; it is now settled above. Historical global scoring remains
unfixed; existing Expo profiles still point at production.

Latest accepted source checkpoint: AUTH-REFRESH01 (C02-R2 F3). Same-user resolved
profile refresh preserves the mounted navigation gate and current profile on
transient failure. Codex reproduced 8 baseline failures, then all 420 tests /18
suites passed with the fix; typecheck and targeted lint pass. See
handoffs/AUTH-REFRESH01-integration.md. No updated APK or phone evidence yet.

Isolated hosted project StreakWar-test (vqizpuqmsykmhlyihyry) created by owner:
Healthy/Free/nano; empty and not configured in the app. See
database/HOSTED-TEST-ENVIRONMENT.md. Fitbet project permanently deleted with
explicit owner approval; shared StreakWar and organization retained. Next:
review isolated baseline, verify RLS with synthetic data, then exact Android build.

DB-BASELINE01 source review received. Read-only current catalog capture confirms
live per-challenge workout indexes and active fan-out differ from app assumptions.
Potential duplicate-verification / Steps-update conflicts and global point
multiplication now need isolated reproduction. See database/RECONCILIATION-2026-10-05.md.
No production rows read/changed; no test schema deployed. Phone gate remains open.

Previous accepted checkpoint: HC-CONSENT01 (C02-R2 F1). Foreground Android import
requires a fresh active connection lookup and a subsequent current-scope check.
Missing/inactive/offline lookup cannot reach native polling. Successful disconnect
reconciles the affected hook's provider before cleanup, retaining cleanup errors.
403 tests /17 suites, typecheck and Android JS export PASS; targeted lint 0 errors
/1 existing warning. See handoffs/HC-CONSENT01-integration.md. In-flight revocation
is not atomic; no live RLS/device evidence. Next: C02-R2 F3 same-user auth refresh
regression/navigation check, then exact safe device-test checkpoint.

Previous accepted checkpoint: HC-ALERT01 manual-sync Alert isolation. Both screens
suppress stale success/error feedback after account change (including A-B-A) or
unmount. Local checks: 382 tests / 17 suites and typecheck PASS; targeted lint
0 errors / 4 existing warnings. See handoffs/HC-ALERT01-integration.md.
Next: consolidated C02 review and exact device-test checkpoint. No device proof.

GitHub backup established: remote `codex/streakwar-baseline` commit `0ead6e3`
is an exact-tree snapshot of local `8c3ed86`, verified by tree SHA
`6e41807a7e1fa19ef57f1414b5fc3cf2ba0b5c78`. Publication used the connected
personal arnarjo GitHub account; local detailed history was not rewritten.
The remote snapshot history differs from local history; do not force-push.
Default branch master and store deployments were not changed. Earlier push
failure notes below are historical. This checkpoint will be published as a
fast-forward child of that snapshot after acceptance.

Previous accepted checkpoint: HC-PARTIAL02B foreground feedback. Manual workout
counts exclude Steps; both screens show accurate partial/missing-permission
feedback and Android full-sync labels. Shared timestamp/background semantics are
unchanged. Codex added two failing-then-fixed formatter regressions and corrected
React test teardown. 362 tests / 17 suites, typecheck and Android JS export PASS;
targeted lint 0 errors / 5 warnings. See handoffs/HC-PARTIAL02B-integration.md.
Next: stale screen completion/Alert review and consolidated C02 device checkpoint.
No app deployment, new APK or successful GitHub push recorded.

Previous: HC-PARTIAL02A accepted after personal-Chrome Claude implementation and
local diff/hash review. Per-type exercise/Steps outcomes are now populated while
existing consumer behavior remains unchanged. 305 tests / 15 suites and standard
typecheck PASS; targeted lint 0 errors / 2 existing warnings; Android JS export
PASS. See handoffs/HC-PARTIAL02A-integration.md. UI partial-success messages and
last_synced_at consumer audit are next; no device/release acceptance. GitHub push
remains unconfirmed after the earlier HTTPS authentication failure.

HC-BATCH01 accepted: Claude's implementation and requested correction retrieved
with verified SHA256. Bounded lookups/inserts, ID deduplication, identity rechecks,
encoded URL budget and first-error retry stopping verified locally. Standard
typecheck, 223 tests / 13 suites, four audit-script tests and Android JS export
pass; lint 0 errors / 63 warnings. See `handoffs/HC-BATCH01-integration.md`.
T02/C02 remain incomplete; next is C02/A1 logout cleanup race. No app deployment
or phone verification.

HC-LIFE01 accepted after Claude's correction and independent local verification.
Serialized logout/account-switch lifecycle, stale-profile guards, queued ABA
invalidation, incomplete-start retry, unregister failure reporting and recovery
identity cleanup are covered. All four independent regressions which failed
against the first delivery now pass unchanged. Latest checks: 290 tests / 15
suites, typecheck and Android JS export PASS; lint 0 errors / 61 warnings.
See `handoffs/HC-LIFE01-integration.md` for verified transport hashes and limits.
No new APK or device evidence; T02/C02 remain incomplete. Next bounded A1 target:
per-record/per-type partial completion and retry semantics, then independent
review and an exact device-test build checkpoint.

Live-backend authorization update (2026-10-01): owner authorized Supabase fixes
and connected the integration. First production change applied and verified:
`20261001093330_restrict_device_token_rpc_execution`, closing anonymous/client
execution of four backend OAuth credential RPCs while retaining service_role.
No data changed. See `SUPABASE-SECURITY-CHECKPOINT.md`. Earlier statements of
"no live migrations performed" describe historical checkpoints only. Major
local/live migration drift discovered: do not push/reset the local chain.

Second live fix: `20261001094527_restrict_device_connection_client_writes` locks
OAuth credentials/external identities to backend writes, preserves native-health
upserts/status/disconnect, and prevents client owner/provider reassignment.
Exact grants verified; synthetic TEMP-table trigger checks and non-executing
SQL permission plans passed. No real application/user rows changed. Existing
security warnings and baseline reconciliation remain open; no end-to-end claim.

Reconciliation audit captured 28 live migration statement arrays in an inert JSON
archive outside the active migration directory. Comparator: 18 token matches,
2 content differences (010/011), 3 version/name collisions, 5 remote-only entries;
four comparator tests pass. Current live streak function uses 20 minutes despite
historical 010's 30; no product rule changed. Active chain remains unreconciled.
See `database/README.md`.

Claude SEC01 supplemental review delivered through Pro after explicit four-file
export approval. Fixed misleading PASS in SQL test; added trigger catalog check.
Revised live permission plans pass; deliberate invalid trigger expectation fails.
Scoped token helper scan found no client EXECUTE. No new live migration/data
writes. Full C04, isolated ownership and phone/provider tests remain pending.

| Task | State | Evidence or next action |
|---|---|---|
| C00 | ACCEPTED | `handoffs/C00-accepted.md`; Claude setup preserved |
| T00 | IN_PROGRESS | Checkout/environment map recorded in `BASELINE.md`; phone/build and service-access inventory pending |
| T01 | IN_PROGRESS | Local checks, package alignment and arm64 debug APK compilation delivered; install/runtime, release build and Doctor findings still pending |
| C01 | DELIVERED | Cloud report read; `handoffs/C01-follow-up.md` records findings and disposition. Remote report commit is not yet imported locally. |
| T02 | IN_PROGRESS | Poll-lock recovery, completion reporting and per-user cursors verified with mocks. See `handoffs/T02-progress.md`. |
| T03 | IN_PROGRESS | Background identity/status guards, reconnect registration and async account boundaries implemented; native capability/delivery and real DB safety remain unverified |
| C02 | DELIVERED_PARTIAL | Local Claude review saved in `claude/C02-result.md`; scope gaps and Codex triage in `handoffs/C02-follow-up.md`. Not accepted/complete. |
| T04–T19 / C03–C15 | PENDING | Contract, backend/product integration and release acceptance not established |

Do not mark T01 complete because prebuild or JavaScript export passed.
No app/Edge Function deployment, cloud build or store submission has been
performed. Two live permission-hardening migrations are recorded above.
`CONTRACTS.md` is due at T04, not required by C01.

Latest pre-device checkpoint: 132 tests in 8 suites; lint 0 errors / 62
warnings. Standard typecheck passes again. The 21 verified-empty duplicate
`node_modules/@types/* 2` directories were moved, not deleted, to
`/private/tmp/streakwar-empty-type-folders-nsh5E8`. Cause of their creation is
unknown; no dependency or lockfile changes were needed.
Previous checkpoint: 90 tests, standard typecheck passed, lint 0 errors / 63
warnings. C01 tooling follow-up is commit d03a111;
the first poll-lock fix is e1440a2. All new sync tests use mocks, not live services.
Exercise pagination now fails closed on later-page errors and invalid continuations.
Exercise batch conflicts now retry individual inserts and verify duplicates
without overwriting existing rows. Large-batch efficiency and live DB/RLS proof
are still pending. Reconnection now requests background registration again
after saving the connection and user ID. Native delivery is not verified.
Connection-time registration failures now show a warning on Connect Devices;
manual sync remains available. This state is local to the mounted hook, not a
persistent/global background-health monitor. Raw-step summation fallback is now
removed; read permissions are checked explicitly and invalid totals rejected.
Missing record permissions now produce a visible connection-screen notice.
Account identity is rechecked around import writes/cursor and status writes;
late connection fetches/old-account UI state are discarded. Server RLS and
in-flight request atomicity are not proven by these checks. Android JS/Hermes
export passed; offline Expo dependency-map check passed with an offline warning.
Local native checkpoint on 2026-10-01: isolated JDK/Android SDK installed;
arm64 debug APK compiled successfully (579 tasks, 9m 4s). Package metadata and
debug signature verified; see `LOCAL-ANDROID-BUILD.md` for hash/toolchain and
warnings. No install or runtime evidence yet. C02 is ready for independent
review of a bounded snapshot, not marked complete.

Native follow-up delivered in `2fd19de`: manifest background-read permission,
prebuild-persistent native feature-status bridge, explicit optional permission
button, foreground fallback and per-invocation worker/registration gates.
No OS-version guessing. Existing connect-client 1.1.0-alpha11 retained with the
required experimental feature-API opt-in. 163 mocked tests / 10 suites pass;
typecheck, Android export and arm64 debug APK compilation pass. ESLint has
0 errors / 63 warnings (one new advisory for deliberately guarded native require).
APK manifest and debug signature checked. Native method invocation, permission
dialog, background delivery and UI appearance still require runtime evidence.
Independent C02 partial review delivered against `2fd19de`; it did not read all
handoff scope or compare the base diff. First corrective pass now checks active
in-app connection before Android startup/registration/worker import, and requires
exactly one active connection row returned when saving sync success. 181 tests /
12 suites, typecheck, lint (0 errors / 63 warnings) and Android export pass.
No new native changes in this pass; prior APK evidence remains at `2fd19de`.
Logout lifecycle races, bounded lookup/write batching and per-record partial
completion remain open. See `handoffs/C02-follow-up.md` for all findings.

Isolated DB test preparation added: loopback-only guarded runner and transactional
synthetic ownership/dedup SQL. SQL NOT RUN; PostgreSQL/Supabase/Docker tooling is
not available on PATH. Owner-supplied dashboard is the same shared/live project.
No live DB calls, migrations, fixtures or resets were performed.

## Position in the full plan

Source: the 2026-09-29 planning artifacts `HEILDARAETLUN.md` and `VERKEFNI.md`
under workspace `outputs/streakwar-plan/`; their original all-pending snapshot
is not current status. The written estimate is 20–35 active days / 6–10 calendar
weeks including beta, with re-estimation after A1; it is not a delivery promise.

| Phase | Current evidence | Next acceptance boundary |
|---|---|---|
| A0 / T00–T01: baseline | Local tests/typecheck/lint; JS export/prebuild; arm64 debug APK compiled | Device install/runtime, release build, account/environment inventory |
| A1 / T02–T03: Health Connect | Incremental sync fixes and mocked failure tests | Per-type status, background permission capability, account-switch safety, independent C02 review, two-phone evidence |
| A2 / T04–T07: data/scoring/security | Relaunch acceptance not yet established | Approved contract and isolated DB; canonical ingestion, corrections and access tests |
| A3 / T08–T09: open competitions | Relaunch acceptance not yet established | Four periods, world/country rankings and own rank beyond top page |
| A4 / T10–T12: first-use/UI | Relaunch acceptance not yet established | Solo-first onboarding, real APIs, recovery states and notification preferences |
| A5 / T13–T16: Pro/privacy/providers | Relaunch acceptance not yet established | Free/Pro contract, purchase sandbox, deletion and allowed provider use |
| A6 / T17–T19: release/beta | Not started | Integrated signed build, 14–21 days beta evidence, owner release decision |

Existing app features are not implied absent by this table; their acceptance
against the relaunch requirements remains unverified. Do not calculate a
completion percentage from unit-test counts. No build has been distributed.

Before the first device checkpoint: finish the A1 code review target, document
known limits, get independent C02 review, establish safe test data/environment,
and identify an exact build commit. Device testing should happen early in A1,
not be postponed until A2–A6 are complete. While waiting for devices, contract
drafting and synthetic backend test preparation can progress without declaring
their dependency gates satisfied. Live Supabase corrections are authorized as
recorded above; paid builds and destructive data operations remain unapproved.
