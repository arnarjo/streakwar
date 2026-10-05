# Isolated phone-test provisioning

Owner approved persistent TEST provisioning at action time with “Já haltu áfram
að gera símatest”. Applied through the owner's personal Chrome Supabase session
to **StreakWar-test / vqizpuqmsykmhlyihyry** only. Production was not changed.

## Applied source

Source checkpoint: local `8f3091ba2ab7de483b6901010fd5da71b23cb87d`, equivalent
published tree `f4637f29c4c1ba150804ab7a4fcd8749819b16f3`.

The reviewed `supabase/tests/hosted-baseline-rehearsal.sql` was used with its final
`ROLLBACK;` replaced by the complete `supabase/tests/private-health-schema.sql`
and `COMMIT;`. No acceptance fixtures were included in the committed transaction.
Both checked-in source files remain unchanged and retain their rehearsal roles.
The deterministic local reconstruction is 73987 UTF-8 bytes, SHA-256:
`0cdf2549b55e139c0396b90e307e3d39048b08b92044b2c8643d9726183ed185`.

Do not rerun provisioning: the baseline refuses existing relations/users/marker.
Do not delete data or bypass these guards. Future changes need separate review.

## Independent post-commit verification

A new read-only transaction returned:

- marker project_ref `vqizpuqmsykmhlyihyry`
- 23 public tables, all 23 with RLS enabled
- zero auth users and zero private activity records
- anonymous private SELECT: false
- authenticated owner-id UPDATE: false
- authenticated steps UPDATE: true (subject to owner + active-consent RLS)

Then `private-health-acceptance.sql` was run against the persistent schema inside
a fresh BEGIN/ROLLBACK wrapper. Result:
`PRIVATE_INTAKE_OWNERSHIP_DEDUP_POINTS_AND_NO_PUBLIC_EFFECTS_PASS`.
The separate read-only query above again confirmed 23/23/0/0/false/false/true.
Synthetic users/activities were not retained.

Dashboard auth inspection: email enabled; new signups enabled; email confirmation
enabled; anonymous sign-ins disabled; Google/Facebook disabled. No settings or
passwords changed. No provider secrets, Edge Functions, jobs, webhook endpoints,
production records or storage buckets copied.

The default publishable key was read from this project's API Keys page for the
isolated client profile. No secret/service-role key was revealed or copied.

## Remaining evidence

Physical device installation, signup/email delivery, login, permission dialogs,
synthetic Health Connect import and background behavior are not yet verified.
No claim that the full app or release is ready. First device scope is email auth
and private Health Connect intake only; no purchases, Strava, social sharing or
production use. Built-in email delivery limits and redirect settings still need
to be checked during first account creation.
