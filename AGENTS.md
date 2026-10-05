# StreakWar relaunch — shared working rules

## Scope and ownership

- Android first. Keep React Native, Expo, Supabase and RevenueCat. No rewrite.
- Work on one assigned task at a time. Use a single agent unless Arnar explicitly
  requests parallel agents; generic orchestration defaults do not apply here.
- Codex owns architecture, native/build configuration, dependencies, Health
  Connect, backend, migrations and contract/READY/acceptance documents.
- Claude reviews or implements only the paths leased in the current READY file.
  See `docs/relaunch/CLAUDE-VERKPAKKI.md` for the C-task protocol.
- `docs/relaunch/STATUS.md` is Codex's status. `CLAUDE_STATUS.md` belongs to Claude.
- Do not treat old generated reports, comments or test counts as runtime proof.

## Safety

- Preserve existing user changes; no destructive checkout, reset or cleanup.
- No live data writes, deployments, store submissions, purchases or contacting
  testers without explicit authorization. A build command is not a deployment.
- Preview, store-testing and production currently point at the same Supabase
  project. Their names do not establish isolated environments.
- Use synthetic exercise data. Do not fetch or expose personal health records.
- Never print or commit secrets, credentials or local environment files.
- Do not copy provider data into public challenges until permitted use and
  consent are settled. Health Connect is not a workaround for provider terms.

## Verification and handoffs

- `npm run typecheck` and the legacy `npm run build` only run TypeScript.
- `npm test -- --runInBand` runs unit tests; `npm run lint` gates errors.
- `npm run check:dependencies` checks Expo SDK compatibility.
- `npm run prebuild:android` generates ignored native sources; it is NOT an APK.
- `npm run export:android` bundles Android JavaScript/assets; it is NOT an APK.
- `npm run build:preview` and `npm run build:prod` use Android EAS builds and
  require an authorized account. Do not run paid/remote jobs automatically.
- The legacy both-platform production command is explicit: `build:prod:all`.
- Record commands, results, commit and missing evidence. Native compilation,
  installation, login and real Health Connect/background behavior are separate.
- Run relevant checks after changes; never hide failures or weaken tests to pass.
- Keep changes scoped and checkpoints reviewable. Do not merge your own work
  into the shared/default branch or declare a release ready without evidence.
