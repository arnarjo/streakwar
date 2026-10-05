# Isolated hosted test environment — 2026-10-05

Owner created StreakWar-test through personal Chrome after Codex prepared the
form. Owner handled database password and submission; no credential is stored
here. Dashboard status Healthy, nano, eu-west-1; organization Free plan.

- TEST only: vqizpuqmsykmhlyihyry
- Existing shared/production: uzstenhkngldkrwnsmku — do not seed/reset.
- Retired Fitbet: nzxdnwovvyjbzxrsgfaa — permanently deleted without backup by
  explicit owner confirmation. Organization retained because it hosts StreakWar.

New project has no migrations. Form disabled automatic table exposure and enabled
automatic RLS. Verify effective grants/policies after provisioning, not just form
settings. No app profile points to this project yet, and no schema, fixtures,
functions, provider credentials, cron jobs or webhooks have been deployed.

Next: review a separate schema baseline using the reconciliation archive and
current definitions. Do not replay the historical archive or active migration
chain blindly: they contain conflicts, seeds, schedules and credential functions.
Keep all real health/user data out. Existing local SQL runner remains loopback-only;
do not weaken its host guard to reach this hosted project. A separately reviewed
hosted SQL test path must hard-check this exact test project and use rollback-only
synthetic fixtures. Require RLS/grant verification before configuring the app.

First phone scope is Health Connect with synthetic data and email authentication.
Strava OAuth/webhooks, real purchases and social provider credentials are separate
gates; do not copy production credentials or redirect provider callbacks here.
