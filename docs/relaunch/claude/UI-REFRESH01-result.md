# UI-REFRESH01 result

Base `cda5136a0ad682824ad12af9e136de1176375fb3` (tree `e89cb2ec4e20838acf1adfeb8562dce76aef0734` verified, fresh detached worktree, scoped fetch). Only leased paths changed. No hooks, queries, mutations, scoring, sync, auth, backend, native, dependency or lockfile changes.

## What changed (presentation only)
- `theme.ts`: charcoal surfaces (`bg #0E1013`, `card #16191E`, `dimmed #21252C`), off-white text, `muted #A3ABB5`. Orange is kept for the single primary action/active state. New tokens: `onPrimary`, `R` (8/12 radii), `HIT` (44). All existing keys are kept. Lightened `error`, `bronze`, `purple` so every text token is >= 4.5:1 on bg/card/dimmed (asserted).
- `InterfaceIcon.tsx` (new): Ionicons wrapper, hidden from screen readers.
- Tabs: Ionicons (outline idle, filled selected), route names and auth gate unchanged, bar height = 56 + safe-area inset, 48dp items.
- Private card: same hook/guards/constants/notice; large "Personal points", secondary "Imported records", friendly all-history scope copy, 44dp buttons.
- Home: compact header, private card first (Android, unchanged condition and `refreshToken`), then a labelled "Competition" card (points, streak) kept separate from private numbers, rival/league as secondary rows, challenges section with "Browse open challenges" when none (no invented content). Zero-state no longer says "start your journey".
- Profile: compact identity, small Pro link, "Competition stats / points / streak / activity" labels, explanation that private Health Connect data is separate, honest "not available yet" copy for edit/photo.
- Challenges: prominent "Find an open challenge" card opening the existing Discover tab, friend challenge secondary, selected-state tabs, helpful empty states.
- Leaderboard: explicit competition scope and private exclusion, icon tabs, factual no-league text, 36dp visuals with 44dp hit area for follow/nudge.
- Decorative emoji removed from leased UI and share text; the Home glow/fade and Profile count-up animations were removed (none added). Kept on purpose because they are data: quick-challenge `description` and the nudge emoji choices.

## Verification
- Default `npx jest --runInBand`: 19 suites, 485 tests pass (484 baseline + 1).
- `tests/uiRefresh.test.tsx`: 49 tests (theme contrast, navigator, Home, Profile, Challenges, Leaderboard) with real screens/handlers; passes with `--testMatch '<rootDir>/tests/**/*.test.{ts,tsx}'` (all 20 suites, 534 tests).
- `tsc --noEmit` exit 0. ESLint on touched files: 0 errors; warnings 14 -> 9 (all pre-existing).
- Mutation checks (restored): copy, tab icon, browse handler, private/competition merge and label changes each fail a test.

## Limitations / needs Codex
1. **`jest.config.js` `testMatch` is `*.test.ts`, so `tests/uiRefresh.test.tsx` is NOT run by plain `npm test`.** Config is outside the lease; widen it to `*.test.{ts,tsx}`.
2. `@expo/vector-icons` is not in `package.json` (resolved transitively); Codex to pin.
3. Profile uses no icons: `healthSyncFeedbackScreens.test.ts` (outside lease) mocks `react-native` too narrowly to load vector-icons.
4. Theme token changes apply app-wide; non-leased files with hard-coded old hex values (e.g. `#0C1117`, `#151C24`) will differ slightly until updated.
5. No device, screenshot, TalkBack or font-scale evidence; accessibility labels/targets are asserted in mocked trees only. Tab labels do not scale (`tabBarAllowFontScaling: false`) to avoid overflow.
6. "Competition points/streak" show the existing `profile.total_points`/streak; I did not verify what the backend counts for them. The zero-streak sentence that imports "aren't counted yet" follows the owner-mandated notice, not backend proof.
7. "Browse public challenges you can join" does not claim any exist; no sync is started by the summary Refresh.
