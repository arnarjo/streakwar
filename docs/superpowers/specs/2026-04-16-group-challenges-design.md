# StreakWar Group Challenges + Discovery — Design Spec
Date: 2026-04-16
Focus: Android first

## Goal
Expand StreakWar challenges from 1v1 to full group competitions (3–50 people), add a "Days Active" scoring mode inspired by GymRats, and add a public challenge discovery screen so users can find and join open challenges without a code.

---

## Context: What Already Exists

The following are already built and do NOT need to change:

- `fitness_challenges` table: `scoring_modes text[]`, `is_public boolean`, `invite_code text`, `is_teams_mode boolean`, `custom_scoring jsonb`
- `challenge_participants` table with `score`, `rank`, live-updating trigger
- `useWorkoutFeed` fetches posts filtered by `challenge_id` ✅
- `ChallengeDetailScreen` has feed + leaderboard + banter + info tabs ✅
- `useFitnessChallenges`: `createChallenge`, `joinByCode`, `joinPublic` all exist ✅
- `CreateChallengeScreen` with `scoring_modes`, `is_public`, start/end date ✅
- Points trigger `award_points_on_workout()` calculates scores per mode ✅

---

## Feature 1: Days Active Scoring Mode

### How it works
- New scoring mode: `'days_active'`
- A user earns 1 point per calendar day they log at least one workout in the challenge
- Logging a second workout on the same day gives 0 additional points
- Maximum possible score = number of days in the challenge window

### DB change
The existing `award_points_on_workout()` trigger adds points incrementally. For `days_active`, we cannot add points blindly — we must check if the user already has a workout on `new.workout_date` in this challenge before awarding the point.

Add this block inside the trigger (after the existing scoring mode checks):
```sql
if 'days_active' = any(v_challenge.scoring_modes) then
  -- Only award 1 point if this is the first workout on this date for this user
  if not exists (
    select 1 from workout_posts
    where challenge_id = new.challenge_id
      and user_id = new.user_id
      and workout_date = new.workout_date
      and id != new.id
  ) then
    v_points := v_points + 1;
  end if;
end if;
```

### App changes
- Add `'days_active'` to `ScoringMode` type in `src/types/database.ts`
- Add to `SCORING_MODE_LABELS`: `days_active: '📅 Days Active'`
- Add to `SCORING_MODE_LABELS` in any scoring picker UI

---

## Feature 2: Max Participants (Group Size)

### How it works
- Challenge creator sets a group size cap: **5 / 10 / 20 / 50 / Unlimited**
- When the cap is reached, `joinByCode` and `joinPublic` are rejected with a "challenge is full" error
- Shown as a badge on challenge cards: "👥 4/10"

### DB change
Add column to `fitness_challenges`:
```sql
alter table fitness_challenges add column if not exists max_participants integer;
-- null = unlimited
```

### App changes

**`src/types/database.ts`**
- Add `max_participants?: number | null` to `FitnessChallenge` interface

**`src/screens/CreateChallengeScreen.tsx`**
- Add `maxParticipants` state (default: `null` = unlimited)
- Add picker row: "Max participants" with options `[5, 10, 20, 50, null]` displayed as `['5', '10', '20', '50', 'Unlimited']`
- Pass `max_participants: maxParticipants` to `createChallenge()`

**`src/hooks/useFitnessChallenges.ts`**
- Add `max_participants` to `createChallenge` params
- In `joinByCode` and `joinPublic`: check current participant count vs `max_participants` before inserting. If full, throw `'Challenge is full'`.

**`src/screens/ChallengesScreen.tsx`**
- On each challenge card, show participant count badge: `👥 {count}/{max || '∞'}`
- Fetch participant count alongside challenges (use existing `getParticipants` or add count to query)

---

## Feature 3: Challenge Discovery Screen

### How it works
- New screen `DiscoverChallengesScreen` — lists all `is_public = true` challenges that are `active` or `upcoming` and not full
- Filter bar: **All / Steps / Days Active / Workouts / Distance**
- Each card shows: title, scoring mode emoji, participant count, days remaining, Join button
- Tapping Join calls `joinPublic(challengeId)` — already implemented
- After joining, navigates to `ChallengeDetail` for that challenge
- "Join" button is **disabled** (greyed, label "Joined") if `myChallenges` already contains this `challenge_id`
- "Join" button is **disabled** (label "Full") if `max_participants` is set and participant count ≥ `max_participants`

### Navigation
- `ChallengesScreen` gets a new tab: **Active | Upcoming | Done | 🔍 Discover**
- Tab type expands from `'active' | 'upcoming' | 'completed'` to include `'discover'`
- Discover tab renders `<DiscoverChallengesScreen />` inline (not a separate stack screen)

### Data
`DiscoverChallengesScreen` queries directly:
```typescript
supabase
  .from('fitness_challenges')
  .select('*, challenge_participants(count)')
  .eq('is_public', true)
  .in('status', ['active', 'upcoming'])
  .order('created_at', { ascending: false })
  .limit(50)
```

Filters applied client-side on scoring_modes. Challenges where `max_participants` is not null and current participant count ≥ `max_participants` are shown but marked "Full" (Join button disabled).

### UI
- Card per challenge: title (bold), `[mode emoji] mode label` + `👥 N joined` + `N days left`
- Orange "Join" button — disabled if already a participant
- Empty state: "No public challenges yet — create one and make it public!"

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/007_group_challenges.sql` | Create — adds `max_participants` column + `days_active` trigger block |
| `src/types/database.ts` | Modify — add `'days_active'` to ScoringMode, `max_participants` to FitnessChallenge |
| `src/hooks/useFitnessChallenges.ts` | Modify — `max_participants` in createChallenge, full-check in join |
| `src/screens/CreateChallengeScreen.tsx` | Modify — add max participants picker |
| `src/screens/ChallengesScreen.tsx` | Modify — participant badge on cards, add Discover tab |
| `src/screens/DiscoverChallengesScreen.tsx` | Create — public challenge browse + join |

---

## Out of Scope (This Phase)
- Teams within challenges (is_teams_mode already in DB — UI deferred)
- Push notification when challenge is full
- Challenge categories or tags
- Custom Hustle Points scoring
- iOS-specific UI adjustments
