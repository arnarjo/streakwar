# Claude DB-BASELINE01 rendered report

Retrieved through personal Chrome on 2026-10-05; source review only, not database evidence.

DB-BASELINE01: hosted-test baseline/replay manifest (read-only review)

Verified: base 97ac45d9653f3d9c6e56dca808e99fd38990a46d, tree c4bf07c6e4a8d350577e92bf224d5a5418368c82 (scoped fetch, new detached worktree). I read AGENTS.md, the database README, HOSTED-TEST-ENVIRONMENT.md, the comparison JSON, the inert live-history statements for the conflicting/remote-only versions, all 23 migration files, both test SQL files, the loopback runner and app DB usage. No SQL, live access or credentials were used. Everything is from files, not a database.

1. Decision

Do not replay the repo chain, and do not hand-build only health tables. Build a side-effect-free schema of every object the app references, reconstructed from reconciled live catalog metadata (repo files are reference only). Reasons:

The live schema materially differs from the repo for exactly the Health Connect path. Live 020 dropped both local dedup indexes (001 workout_posts_dedup, 002 idx_workout_posts_external_dedup) and replaced them with (user_id, challenge_id, source, external_activity_id) plus a no-challenge fallback, and added a fan-out trigger copying auto-synced rows into every active challenge (024 adds parent_workout_id). Live 019/021/022-024 and two June files are not in the repo. Local 019's validation trigger (duration ≤ 1440, steps ≤ 120000), step-update points and delete compensation may or may not exist live.
Omitting triggers would change scoring; the app hits ~20 tables, 3 RPCs and 2 realtime channels at login/Home, so a health-only baseline gives noise and untested triggers.
Replaying the repo adds seeds, cron, an IDOR RPC and Vault-dependent code.
2. File manifest (reference only; live DDL wins on conflict)
File	Include	Exclude / note
001	L5 uuid-ossp, tables, handle_new_user + auth.users trigger (use live/019 collision-safe body), RLS, indexes, triggers	L68-75 commented cron; L277 insert into storage.buckets; L346-353 storage policies; workout_posts_dedup (live-replaced)
002	device_connections, RLS, unique(user_id, provider) (needed by upsert)	L49-51 dedup index (live-replaced); plaintext token columns, take live shape (bytea, external_token_ref) or omit as inert
003-009	all	none are side-effecting; 005 creates the enum, 008 needs 007's max_participants
010	skip (017 supersedes the function)	live 30 min vs local 20 min is unresolved
011	L14-33 columns/policy/index, L124-134 refresh_challenge_statuses	L40-122 seeds (fixed IDs, Icelandic text)
012, 016	none	pg_cron extension, cron.schedule, user-data UPDATE jobs
013	L4-19, L74-80	L21-62 use_streak_freeze (IDOR; live 022/024 fix absent from repo)
014, 015	all	
017	L60-148 trigger functions	L7-55 use_streak_freeze
018, 021	none	renewal backfill and seed updates
019 local	policies/grants/triggers only after comparing with live 024	collides with live 019 encrypt_oauth_tokens
020 local	workout_points, read-scoping policies	collides with live 020 fan-out; global-points function must be live's post-024 version
…093330	exclude	needs live-only token RPCs
…094527	include, but apply grants first and run its verify block separately	verify requires service_role column grants (fails if default privileges are absent)

Dependency order: extensions → enum/tables (profiles, challenges, participants, workout_posts, device_connections, streaks, social/league tables) → functions → triggers → indexes → RLS/policies → explicit grants → verification.

3. App-required objects
Tables: workout_posts, challenge_participants, profiles, device_connections, fitness_challenges, user_streaks, workout_reactions/comments, friendships, milestone_reactions, streak_milestones, challenge_messages, user_league_tier, league_memberships, user_achievements, streak_freeze_uses. RPCs: get_weekly_leaderboard, get_league_group_leaderboard (use_streak_freeze only if the live fixed body is used; Pro-only, omit for phone 1).
getActiveChallengeId needs the participant→challenge FK embed. Profile reads need select grants on id, username, full_name, avatar_url, total_points, streak_freeze_credits, bio, is_admin, created_at.
Realtime: useStreaks.ts:85 and ChallengeDetailScreen.tsx:70 use channels; no migration adds a publication, so live publication membership is unknown.
Storage workout-media: not needed for the Health Connect/email scope; omit.
Edge functions, webhooks, OAuth, RevenueCat: none deployed.
4. Hosted-specific blockers
Explicit grants. The project was created with table exposure disabled, so migrations that rely on Supabase default privileges will leave authenticated without table/column grants. Reproduce live ACLs per table, column and function (including anon, authenticated, service_role), then verify.
Automatic RLS means policy-less tables deny everything; every policy must be created and checked.
…094527's verify block fails without service_role grants.
Email auth is dashboard config: confirm-email, site/redirect URLs (streakwar://), email rate limits, social/OAuth providers off. These are unresolved.
The existing SQL test cannot run on hosted: it requires an empty auth.users (phone users will exist), asserts the repo-only cross-source uniqueness, and is correctly loopback-only. Leave it unchanged.
5. Read-only metadata queries (run on LIVE, then re-run on TEST after baseline; never print function bodies containing secrets)
select version,name from supabase_migrations.schema_migrations order by 1;
select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by 1,ordinal_position;
select tablename,indexname,indexdef from pg_indexes where schemaname='public';
select tgrelid::regclass,tgname,tgenabled,pg_get_triggerdef(oid) from pg_trigger where not tgisinternal; (includes auth.users)
select p.oid::regprocedure,p.prosecdef,p.proacl,md5(pg_get_functiondef(p.oid)) from pg_proc p where pronamespace='public'::regnamespace; Fetch bodies only for named functions and check for credential-like tokens first (024 mentions a cron secret header).
select * from pg_policies where schemaname in ('public','storage');
select grantee,table_name,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role'); plus information_schema.column_privileges, routine_privileges, pg_default_acl.
select relname,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r';
select conrelid::regclass,conname,pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace;
select extname,extversion from pg_extension; select jobname,schedule,active,md5(command) from cron.job; select * from pg_publication_tables; select id,public,file_size_limit,allowed_mime_types from storage.buckets;
Enum labels: select t.typname,e.enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid;
On TEST only: select count(*) from auth.users; must be 0 before the first user.
6. Minimum rollback-only two-user tests (new hosted script and wrapper; loopback guard untouched)

Guard: the wrapper hard-checks host db.vqizpuqmsykmhlyihyry.supabase.co and refuses uzstenhkngldkrwnsmku; SQL checks a baseline-created marker row plus streakwar.test_environment. Everything runs in BEGIN … ROLLBACK, SET LOCAL ROLE, synthetic @example.invalid users, timeouts.

T1 auth trigger creates profile and streak row for A and B.
T2 A upserts the health_connect connection (same identity succeeds); B cannot read, update or delete it; owner/provider reassignment and credential-column writes are denied.
T3 A inserts an HC workout; B cannot insert for A; same external ID for B is allowed; duplicate for A is rejected per the reconciled live index (the cross-source assertion is only valid if live keeps it).
T4 Steps row insert then owner UPDATE affects one row, B affects zero; repeat with two active challenges (fan-out copies, challenge-id update, unique index, global points not multiplied).
T5 trigger effects (points, streak) apply to the owner only.
T6 a 1441-minute duration behaves as live does (documents F2).
T7 clients cannot update total_points, is_admin, is_pro; push_token is not selectable; anon reads nothing.
T8 B cannot read A's standalone workouts; token RPCs absent or service-only.
7. Unresolved facts (not assumed)

Live current schema for every object above; whether local 019 (validation, step-update points, delete compensation), 020 read-scoping and profile column grants exist live; live workout_posts dedup/fan-out semantics versus the app's maybeSingle() duplicate verification and Steps UPDATE … challenge_id with multiple copies (hypothesis); default privileges on TEST; realtime publication; hosted email-auth settings; whether uuid_generate_v4 resolves via the extensions search path on TEST.

The report is saved as DB-BASELINE01-result.md (1153 words, untracked). It is in the temporary worktree and copied to the main checkout. No source was edited, no SQL was run, nothing was committed or pushed, and I stopped after the review.


