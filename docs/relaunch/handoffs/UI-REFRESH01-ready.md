# UI-REFRESH01 — presentation refresh

Status: DELIVERED and source-integrated 2026-10-05; phone acceptance pending.
Dispatched to Claude Code session
`session_01JBigCXGLSLxifMZMBGxSgN`, Sonnet 5.5 / Medium. Initial browser safety
review blocked broader private-code egress; owner subsequently explicitly
approved the named code/source and destination. See UI-REFRESH01-integration.md.

Owner requested visual redesign on 2026-10-05. This explicitly supersedes the
old Claude packet's exclusion of visual redesign for this bounded task only.
Base: published `cda5136a0ad682824ad12af9e136de1176375fb3`, tree
`e89cb2ec4e20838acf1adfeb8562dce76aef0734`. Later local edits are documentation only.

## Lease

- src/theme.ts
- src/navigation/RootNavigator.tsx (tabs only; preserve auth gate and routes)
- src/components/PrivateActivitySummaryCard.tsx (presentation only)
- src/screens/HomeScreen.tsx
- src/screens/ProfileScreen.tsx
- src/screens/ChallengesScreen.tsx
- src/screens/LeaderboardScreen.tsx
- optional src/components/InterfaceIcon.tsx
- tests/uiRefresh.test.tsx
- tests/privateActivitySummary.test.ts (presentation assertions only)
- docs/relaunch/claude/UI-REFRESH01-result.md

One agent, separate worktree, no reset of existing work, dependencies/lockfiles,
backend, Health Connect, data queries/mutations, native/config, live services,
credentials, pushes, PRs or deployments. Necessary related source read-only.
No personal screenshots, identity, exercise history or real activity counts sent
to Claude. Synthetic fixtures only. Existing 484 tests/owner-race guards remain.

## Visual direction

Restrained sports editorial design: charcoal, off-white, one orange accent,
readable secondary text, strong number hierarchy, 8–12px radii, fewer nested
cards and less wasted header space. Consistent installed Ionicons rather than
decorative emoji. No new icon/font dependencies in Claude's lease; Codex owns
pinning the existing installed @expo/vector-icons 15.1.1 if used. Minimum 44–48px
hit targets, meaningful accessibility labels/selected states, text scaling,
narrow screens and safe-area-aware bottom tabs. Avoid new decorative animations.

## Information hierarchy and non-negotiable semantics

Home leads with private personal progress; social feed is secondary. Existing
RPC totals represent ALL imported history, not today/week. Never display a
daily total, goal percentage, graph or last-sync timestamp without a matching
source. Imported records include daily Steps snapshots, not just workouts.
Refresh reloads the summary; it does not initiate native sync. Keep exact
privacy notice, exported accessibility-label contracts, and all error/loading/
empty/retry states. Never merge private data with competition points or share it.

Keep existing streak, rival, feed and challenge functionality, but label public
streaks/points as competition scope. No 'start your journey' message implying
private activity does not exist. No invented participants, feed entries or
available challenges. Browse existing challenges is primary; inviting a friend
is optional and secondary. Preserve create/code/join/filter/paywall handlers.

Profile: compact identity and secondary Pro action; 'Competition stats' and
'Competition points' rather than ambiguous total points. Explain private imports
are separate. Heatmap labelled with competition scope, no data changes.

Leaderboard: explicit competition/private distinction, clean tabs, factual
unassigned-league empty state instead of unverified 'check back Monday'. Keep
other board views accessible. No invented scoring or backend capabilities.

## Acceptance and delivery

Run full Jest, typecheck and targeted lint. Tests must render real components and
check scope copy, private-summary failure states and actual action handlers;
do not weaken safety tests or rely exclusively on source-string assertions.
Commit only leased paths. Return exact base/head, verification and limitations,
plus tool-generated lease-only BASE..HEAD diff bytes/SHA256 and gzip/base64
between UI_REFRESH01_PAYLOAD_BEGIN / UI_REFRESH01_PAYLOAD_END in tool output.
Codex reviews/integrates, validates Android bundle and builds the isolated test
APK, then obtains actual S24 visual evidence. No claim of device acceptance
from mocks or code alone. No screenshot/health-data upload to Claude.
