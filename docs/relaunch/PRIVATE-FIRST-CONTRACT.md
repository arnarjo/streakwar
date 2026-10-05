# Private-first imports — decision, 2026-10-05

Owner delegated the sharing choice to Codex on 2026-10-05. Selected policy:
imports are private until the user explicitly chooses to share with a named
challenge. Joining a challenge, reconnecting, background sync or retries are
not sharing consent. Raw records and derived private metrics must not leak
through followers, profile points, leaderboards, achievements or milestones.

## First Android phone slice

Use a separate owner-only canonical `private_health_activities` table for Health
Connect. Its identity is `(user_id, source, external_activity_id)`, independent
of challenges. There is no challenge/parent field, public profile-points trigger,
fan-out, league/achievement/streak side effect or realtime publication.
Personal activity points are computed from these canonical rows, not stored in
public `profiles.total_points`. Repeated Steps snapshots replace the same row.
This separates private intake from the existing social-post model without a
framework rewrite or a risky reinterpretation of historical shared rows.

The first slice does NOT include the explicit share workflow, provider migration,
private streak engine or merging private scores into competition rankings.
Those require a separately tested share/withdraw contract and allowed provider
use. Do not advertise those features as working. Existing public/manual metrics
keep their meaning; private imported metrics are labelled separately.

No fallback to `workout_posts` if private storage is unavailable. No migration,
copy or deletion of existing production health records. The new client requires
the new backend before distribution. First test scope is Health Connect and
synthetic data only; Strava/HealthKit are not private-first accepted yet.

## Acceptance

- A can insert/read/update/delete own records; B, followers and challenge peers
  cannot read/write them or call an RPC to retrieve A's metrics.
- Same source ID for B is independent; A retries cannot produce duplicates.
- Clients cannot rewrite owner/source/external ID or inject challenge fields.
- Two/three challenge memberships do not change private row count or points.
- Steps corrections, repeats and deletion are reflected once by the aggregate.
- Public profile points, weekly/league metrics and achievements stay unchanged.
- Native/account lifecycle regression tests remain green; failures are visible.
- Test-only baseline is executed/verified before any persistent deployment.

Historical public fan-out/scoring defects remain separate production work.
The private intake path bypasses those defects; it does not repair old scores.
