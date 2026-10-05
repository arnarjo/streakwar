# HC-LIFE01 — serialize Android health lifecycle across accounts

Mode: IMPLEMENT, C02 finding 2 / A1. Main source e78be70.
Continue the existing source-only cloud snapshot at commit
3864569a5c3d89c25e8bea153ef2c173f46e6105; the files below still match main.
No additional source upload or live access is required.

This new explicit lease supersedes the old HC-BATCH01 task, which is accepted.
Write only:
- App.tsx
- src/contexts/AuthContext.tsx
- src/lib/backgroundSync.ts
- src/lib/healthSyncLifecycle.ts (new optional coordinator)
- src/hooks/useHealthSync.ts
- tests/healthSyncLifecycle.test.ts (new)
- tests/authContext.test.ts (new, use createElement: Jest matches .test.ts)
- tests/backgroundSync.test.ts
- tests/useHealthSync.test.ts
- HC-LIFE01-result.md (<=600 words)

Everything else read-only. No dependencies/config/native/backend/schema/paywall
changes, agents, hooks, MCP, live services, credentials, uploads to new destinations,
remote builds, publication, purchases, resets or Git push/PR. No new npm install.
All records/users synthetic. Keep current Health Connect batching code unchanged.

## Confirmed race
AuthContext.signOut calls auth.signOut then fire-and-forgets clearUserId and
unregisterBackgroundSync. AppInner independently launches bootHealthSync on
user/loading changes and independently clears persisted identity on logout.
Reconnect/permission actions in useHealthSync also persist/register/unregister.
An old cleanup can finish after B has started, erasing B's persisted ID or
unregistering B's task. An old startup can persist A after logout. Profile fetch
responses in AuthContext also lack identity/revision guards.

## Required design/behavior
1. One serialized authority for local health lifecycle mutations: identity
   persistence/clear, task registration/unregistration, existing HealthKit
   startup/teardown call sites. Use a generation/desired-owner guard so stale
   queued operations cannot mutate a newer session. Account changes must invalidate
   old work synchronously; let in-flight local operations settle, clean up, then
   start the latest desired owner. Merely await signOut cleanup is insufficient.
   Keep Android consent/background capability checks and scheduling options.
2. Wire all competing call sites above through the same authority, including
   reconnect and disconnect/enable-background. Do not introduce a dependency
   cycle. Preserve existing APIs if possible; no standalone unused helper.
   Check identity after awaits and before new side effects. Same-user token
   refresh must not tear down/restart unnecessarily. A->B without null and
   A->null->B transitions must work.
3. Supabase auth subscription callback must remain synchronous (no awaiting
   Supabase auth operations inside its auth lock). Defer asynchronous work safely
   outside the callback. No second auth subscription. SIGNED_OUT from any source
   must request cleanup, not only the custom signOut function.
4. signOut must handle Supabase returned errors without claiming logout/tearing
   down a still-signed-in account. Surface failure through the existing UI-safe
   pattern; no unhandled rejection from ProfileScreen's callback. On success,
   settle the relevant cleanup without a late independent cleanup clearing B.
5. Clear stale profile on identity change immediately; ignore stale profile
   response/finally updates after account changes/unmount. Do not let profile
   fetch/loading gate delay logout cleanup or create repeated lifecycle boots.
   Preserve password-recovery behavior. Purchases/notification redesign is NOT
   this task: leave their existing behavior; disclose any remaining races.
6. Failure must not poison a promise queue or produce unhandled rejections.
   Attempt independent cleanup steps even if one fails. Don't falsely claim
   registration if it failed. No claim that already dispatched DB requests are
   atomically cancelled or that all cross-account isolation is solved.
7. Android-first. Preserve iOS calls without expanding this into a HealthKit
   data-import or permission redesign. No new native prompts during startup.

## Tests (deferred promises, not elapsed timing)
Prove late A startup + logout; delayed logout cleanup + B login; direct A->B;
multiple rapid changes; same-user auth refresh; external SIGNED_OUT; auth signOut
returned/thrown error; cleanup/startup failure then later recovery; stale profile
response after switching/unmount; reconnect/disconnect competing with auth switch.
Assert final stored ID and registration belong to latest owner, stale operations
don't unregister/clear B, and no stale profile is shown. Test real integration
call sites, not only a helper that production doesn't invoke. Existing worker
identity/consent tests must remain.

Run targeted and full Jest --runInBand, standard npm run typecheck, targeted lint.
Don't weaken checks or change test config. Commit leased paths only; report real
results and open limitations. Return full HEAD and SHA256 of incremental
git diff --binary 3864569a5c3d89c25e8bea153ef2c173f46e6105 HEAD.
For transport, include the exact plain unified diff in a fenced code block
(command-generated, not manually reconstructed). If too long, provide gzip/base64.
Do not include unchanged earlier HC-BATCH01 diff. Stop after delivery.
