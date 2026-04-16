# Group Challenges + Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Days Active scoring mode, group size cap on challenges, and a public challenge discovery screen.

**Architecture:** DB migration adds `max_participants` column and `days_active` trigger block. Type layer and hook updated to match. Three UI changes: CreateChallengeScreen gets a max-participants picker, ChallengeCard gets a participant badge, ChallengesScreen gets a Discover tab powered by a new DiscoverChallengesScreen component.

**Tech Stack:** React Native + Expo SDK 54, Supabase (Postgres trigger), TypeScript

**Dev server:** `npx expo start --dev-client` in `c:\Users\maria\Arnar\streakwar\app`

---

## Task 1: DB Migration — Days Active + Max Participants

**Files:**
- Create: `supabase/migrations/007_group_challenges.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/007_group_challenges.sql`:

```sql
-- StreakWar – Group challenges: max_participants + days_active scoring
-- Run in Supabase SQL Editor after 006

-- ── Max participants cap ───────────────────────────────────────
alter table fitness_challenges
  add column if not exists max_participants integer;
-- null = unlimited

-- ── Days Active scoring mode ──────────────────────────────────
-- Replace the points trigger to add days_active support
create or replace function award_points_on_workout()
returns trigger language plpgsql security definer as $$
declare
  v_challenge fitness_challenges%rowtype;
  v_points    integer := 0;
begin
  if new.challenge_id is null then return new; end if;

  select * into v_challenge from fitness_challenges where id = new.challenge_id;
  if not found then return new; end if;

  -- workouts: fixed points per workout
  if 'workouts' = any(v_challenge.scoring_modes) then
    v_points := v_points + coalesce(v_challenge.points_per_workout, 1);
  end if;

  -- days_active: 1 point per unique calendar day (first workout of day only)
  if 'days_active' = any(v_challenge.scoring_modes) then
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

  -- steps
  if 'steps' = any(v_challenge.scoring_modes) and new.steps is not null then
    v_points := v_points + floor(new.steps / 1000.0 * coalesce(v_challenge.points_per_1000_steps, 1))::integer;
  end if;

  -- distance
  if 'distance_km' = any(v_challenge.scoring_modes) and new.distance_km is not null then
    v_points := v_points + floor(new.distance_km * coalesce(v_challenge.points_per_km, 1))::integer;
  end if;

  -- duration
  if 'duration_min' = any(v_challenge.scoring_modes) and new.duration_minutes is not null then
    v_points := v_points + floor(new.duration_minutes / 30.0 * coalesce(v_challenge.points_per_30min, 1))::integer;
  end if;

  -- Update post points_awarded
  update workout_posts set points_awarded = v_points where id = new.id;

  -- Update participant score
  update challenge_participants
     set score = score + v_points
   where challenge_id = new.challenge_id and user_id = new.user_id;

  -- Refresh ranks
  with ranked as (
    select user_id, rank() over (order by score desc, joined_at asc) as r
      from challenge_participants
     where challenge_id = new.challenge_id
  )
  update challenge_participants cp
     set rank = ranked.r
    from ranked
   where cp.challenge_id = new.challenge_id and cp.user_id = ranked.user_id;

  return new;
end;
$$;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Paste SQL into Supabase Dashboard → StreakWar project → SQL Editor → Run.
Expected: no errors, `max_participants` column added, trigger replaced.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_group_challenges.sql
git commit -m "feat: add max_participants column and days_active scoring trigger"
```

---

## Task 2: Type Updates

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add `days_active` to ScoringMode**

In `src/types/database.ts`, find:
```typescript
export type ScoringMode =
  | 'workouts'
  | 'steps'
  | 'distance_km'
  | 'duration_min'
  | 'calories'
  | 'custom';
```

Replace with:
```typescript
export type ScoringMode =
  | 'workouts'
  | 'days_active'
  | 'steps'
  | 'distance_km'
  | 'duration_min'
  | 'calories'
  | 'custom';
```

- [ ] **Step 2: Add `max_participants` to FitnessChallenge interface**

Find the `FitnessChallenge` interface (around line 108). Add `max_participants` after `is_public`:

```typescript
  is_public: boolean;
  max_participants: number | null;
  invite_code: string;
```

- [ ] **Step 3: Add `days_active` to SCORING_MODE_LABELS**

Find `SCORING_MODE_LABELS`. Add `days_active` entry:

```typescript
export const SCORING_MODE_LABELS: Record<ScoringMode, string> = {
  workouts:    '💪 Workouts',
  days_active: '📅 Days Active',
  steps:       '👟 Steps',
  distance_km: '📍 Distance (km)',
  duration_min:'⏱ Duration (min)',
  calories:    '🔥 Calories',
  custom:      '⭐ Custom points',
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd c:\Users\maria\Arnar\streakwar\app
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add days_active ScoringMode and max_participants to FitnessChallenge type"
```

---

## Task 3: useFitnessChallenges Hook Updates

**Files:**
- Modify: `src/hooks/useFitnessChallenges.ts`

- [ ] **Step 1: Add participant count to fetch**

In `useFitnessChallenges.ts`, find the `fetch` function. After `setMyChallenges(challenges)` but before `setLoading(false)`, add a participant count lookup:

Find this block (around lines 26–38):
```typescript
    if (data) {
      const challenges = data
        .map((row: any) => ({
          ...row.fitness_challenges,
          my_score: row.score,
          my_rank: row.rank,
        }))
        .filter(Boolean);
      setMyChallenges(challenges);
    }
    setLoading(false);
```

Replace with:
```typescript
    if (data) {
      const challenges = data
        .map((row: any) => ({
          ...row.fitness_challenges,
          my_score: row.score,
          my_rank: row.rank,
        }))
        .filter(Boolean);

      const ids = challenges.map((c: any) => c.id);
      if (ids.length > 0) {
        const { data: rows } = await supabase
          .from('challenge_participants')
          .select('challenge_id')
          .in('challenge_id', ids);
        const countMap: Record<string, number> = {};
        for (const row of rows ?? []) {
          countMap[row.challenge_id] = (countMap[row.challenge_id] ?? 0) + 1;
        }
        setMyChallenges(challenges.map((c: any) => ({ ...c, participant_count: countMap[c.id] ?? 0 })));
      } else {
        setMyChallenges(challenges);
      }
    }
    setLoading(false);
```

- [ ] **Step 2: Add max_participants to createChallenge params**

Find `createChallenge(params: { ... })`. Add `max_participants` to the params type and pass it through:

```typescript
  async function createChallenge(params: {
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    scoring_modes: ScoringMode[];
    points_per_workout: number;
    points_per_1000_steps: number;
    points_per_km: number;
    points_per_30min: number;
    custom_scoring: Record<string, number> | null;
    backlog_days_allowed: number;
    require_photo_proof: boolean;
    is_teams_mode: boolean;
    tie_break_rule: TieBreakRule;
    is_public: boolean;
    max_participants: number | null;
  }): Promise<{ error: string | null; challenge: FitnessChallenge | null }> {
```

The `...params` spread in the insert already handles `max_participants` — no further change needed there.

- [ ] **Step 3: Add fullness check in joinByCode**

In `joinByCode`, after fetching the challenge and before inserting the participant, add:

```typescript
    if (!challenge) return { error: 'Invalid invite code', challenge: null };

    // Check if challenge is full
    if (challenge.max_participants) {
      const { count } = await supabase
        .from('challenge_participants')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challenge.id);
      if ((count ?? 0) >= challenge.max_participants) {
        return { error: 'Challenge is full', challenge: null };
      }
    }

    const { error } = await supabase
      .from('challenge_participants')
      .insert({ challenge_id: challenge.id, user_id: userId });
```

- [ ] **Step 4: Add fullness check in joinPublic**

In `joinPublic`, find where it inserts into `challenge_participants`. Before that insert, add:

```typescript
  async function joinPublic(challengeId: string): Promise<{ error: string | null }> {
    // Check fullness
    const { data: challenge } = await supabase
      .from('fitness_challenges')
      .select('max_participants')
      .eq('id', challengeId)
      .single();

    if (challenge?.max_participants) {
      const { count } = await supabase
        .from('challenge_participants')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challengeId);
      if ((count ?? 0) >= challenge.max_participants) {
        return { error: 'Challenge is full' };
      }
    }

    const { error } = await supabase
      .from('challenge_participants')
      .insert({ challenge_id: challengeId, user_id: userId });
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useFitnessChallenges.ts
git commit -m "feat: participant count, max_participants, fullness check in challenges hook"
```

---

## Task 4: CreateChallengeScreen — Max Participants Picker

**Files:**
- Modify: `src/screens/CreateChallengeScreen.tsx`

- [ ] **Step 1: Read the file**

Read `src/screens/CreateChallengeScreen.tsx` fully to find the `isPublic` state and where to add max participants UI.

- [ ] **Step 2: Add state**

After `const [isPublic, setIsPublic] = useState(false);` (around line 62), add:

```typescript
const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
const MAX_PARTICIPANT_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '∞', value: null },
];
```

- [ ] **Step 3: Pass to createChallenge call**

Find where `createChallenge({...})` is called (around line 85). Add `max_participants: maxParticipants` to the params object.

- [ ] **Step 4: Add picker UI**

Find the `isPublic` switch row in the form and add a max participants row directly after it:

```typescript
{/* Max participants */}
<View style={s.formRow}>
  <Text style={s.formLabel}>Max participants</Text>
  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
    {MAX_PARTICIPANT_OPTIONS.map(opt => (
      <TouchableOpacity
        key={String(opt.value)}
        style={[
          s.maxBtn,
          maxParticipants === opt.value && s.maxBtnActive,
        ]}
        onPress={() => setMaxParticipants(opt.value)}
      >
        <Text style={[s.maxBtnText, maxParticipants === opt.value && s.maxBtnTextActive]}>
          {opt.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
</View>
```

- [ ] **Step 5: Add styles**

Add to the `StyleSheet.create` call:

```typescript
maxBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
maxBtnActive: { borderColor: '#F97316', backgroundColor: '#F9731618' },
maxBtnText: { fontSize: 13, fontWeight: '700', color: '#4A6070' },
maxBtnTextActive: { color: '#F97316' },
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/screens/CreateChallengeScreen.tsx
git commit -m "feat: add max participants picker to CreateChallengeScreen"
```

---

## Task 5: ChallengeCard — Participant Badge

**Files:**
- Modify: `src/components/ChallengeCard.tsx`

- [ ] **Step 1: Read the file**

Read `src/components/ChallengeCard.tsx` fully to understand the card layout.

- [ ] **Step 2: Add participant badge**

In the `topRow` section, after the name and scoring label, add a participant count badge. Find the `topRow` View and add a badge showing `challenge.participant_count`:

```typescript
{/* Participant count */}
{challenge.participant_count !== undefined && (
  <Text style={s.participantBadge}>
    👥 {challenge.participant_count}{challenge.max_participants ? `/${challenge.max_participants}` : ''}
  </Text>
)}
```

Place this inside the left `<View style={{ flex: 1 }}>` block, below the `<Text style={s.scoring}>` line.

- [ ] **Step 3: Add style**

Add to the StyleSheet:

```typescript
participantBadge: { fontSize: 11, color: '#4A6070', marginTop: 2, fontWeight: '600' },
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ChallengeCard.tsx
git commit -m "feat: show participant count badge on ChallengeCard"
```

---

## Task 6: DiscoverChallengesScreen

**Files:**
- Create: `src/screens/DiscoverChallengesScreen.tsx`

- [ ] **Step 1: Create the file**

Create `src/screens/DiscoverChallengesScreen.tsx`:

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { SCORING_MODE_LABELS } from '../types/database';
import type { FitnessChallenge, ScoringMode } from '../types/database';

const C = {
  bg: '#0C1117', card: '#151C24', border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8', muted: '#4A6070', primary: '#F97316',
};

type Filter = 'all' | ScoringMode;
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all',         label: 'All' },
  { key: 'days_active', label: '📅 Days Active' },
  { key: 'workouts',    label: '💪 Workouts' },
  { key: 'steps',       label: '👟 Steps' },
  { key: 'distance_km', label: '📍 Distance' },
];

export default function DiscoverChallengesScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const { myChallenges, joinPublic, refresh: refreshMine } = useFitnessChallenges(profile?.id ?? '');

  const [challenges, setChallenges] = useState<FitnessChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fitness_challenges')
      .select('*, challenge_participants(count)')
      .eq('is_public', true)
      .in('status', ['active', 'upcoming'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      const withCounts = data.map((c: any) => ({
        ...c,
        participant_count: c.challenge_participants?.[0]?.count ?? 0,
      }));
      setChallenges(withCounts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all'
    ? challenges
    : challenges.filter(c => c.scoring_modes.includes(filter as ScoringMode));

  async function handleJoin(challenge: FitnessChallenge) {
    if (!profile?.id) return;
    setJoining(challenge.id);
    const { error } = await joinPublic(challenge.id);
    setJoining(null);
    if (error) {
      Alert.alert('Could not join', error);
    } else {
      await Promise.all([load(), refreshMine()]);
      navigation.navigate('ChallengeDetail', { challengeId: challenge.id });
    }
  }

  function isJoined(challengeId: string) {
    return myChallenges.some(c => c.id === challengeId);
  }

  function isFull(challenge: FitnessChallenge) {
    return !!(challenge.max_participants && (challenge.participant_count ?? 0) >= challenge.max_participants);
  }

  return (
    <View style={s.container}>
      {/* Filter bar */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => f.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.filterBtn, filter === item.key && s.filterBtnActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[s.filterBtnText, filter === item.key && s.filterBtnTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Challenge list */}
      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
        renderItem={({ item }) => {
          const joined = isJoined(item.id);
          const full = isFull(item);
          const daysLeft = differenceInDays(parseISO(item.end_date), new Date());
          const modeEmoji = SCORING_MODE_LABELS[item.scoring_modes[0]]?.split(' ')[0] ?? '💪';

          return (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.cardMeta}>
                  {modeEmoji} {SCORING_MODE_LABELS[item.scoring_modes[0]]} · 👥 {item.participant_count ?? 0}
                  {item.max_participants ? `/${item.max_participants}` : ''} · {daysLeft > 0 ? `${daysLeft}d left` : 'Ending soon'}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  s.joinBtn,
                  (joined || full) && s.joinBtnDisabled,
                ]}
                onPress={() => !joined && !full && handleJoin(item)}
                disabled={joined || full || joining === item.id}
              >
                <Text style={[s.joinBtnText, (joined || full) && s.joinBtnTextDisabled]}>
                  {joining === item.id ? '...' : joined ? 'Joined' : full ? 'Full' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyTitle}>No public challenges yet</Text>
              <Text style={s.emptySub}>Create a challenge and make it public to show up here</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  filterBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  filterBtnActive: { backgroundColor: C.primary + '20', borderColor: C.primary + '60' },
  filterBtnText: { fontSize: 13, color: C.muted, fontWeight: '600' },
  filterBtnTextActive: { color: C.primary },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  cardName: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: C.muted },
  joinBtn: { backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  joinBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border },
  joinBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  joinBtnTextDisabled: { color: C.muted },
  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  emptySub: { fontSize: 13, color: C.muted, textAlign: 'center', paddingHorizontal: 32 },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/DiscoverChallengesScreen.tsx
git commit -m "feat: DiscoverChallengesScreen with filter bar and one-tap join"
```

---

## Task 7: ChallengesScreen — Add Discover Tab

**Files:**
- Modify: `src/screens/ChallengesScreen.tsx`

- [ ] **Step 1: Read the file**

Read `src/screens/ChallengesScreen.tsx` fully.

- [ ] **Step 2: Add import**

At the top of the file, add:

```typescript
import DiscoverChallengesScreen from './DiscoverChallengesScreen';
```

- [ ] **Step 3: Update Tab type and labels**

Find:
```typescript
type Tab = 'active' | 'upcoming' | 'completed';
const TAB_LABELS: Record<Tab, string> = { active: 'Active', upcoming: 'Upcoming', completed: 'Done' };
```

Replace with:
```typescript
type Tab = 'active' | 'upcoming' | 'completed' | 'discover';
const TAB_LABELS: Record<Tab, string> = { active: 'Active', upcoming: 'Upcoming', completed: 'Done', discover: '🔍' };
```

- [ ] **Step 4: Render Discover tab content**

Find where `{tab !== 'discover' && <FlatList ...}` type pattern is — or find the `<FlatList` that renders challenges. Wrap it so it only shows for non-discover tabs, and add the Discover panel:

Find the `<FlatList` that renders `filtered` challenges. Wrap as:

```typescript
{tab !== 'discover' ? (
  <FlatList
    data={filtered}
    /* ...all existing props unchanged... */
  />
) : (
  <DiscoverChallengesScreen />
)}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/ChallengesScreen.tsx
git commit -m "feat: add Discover tab to ChallengesScreen"
```

---

## Final: Manual Test Checklist

- [ ] Run `npx expo start --dev-client` and open on Android device
- [ ] Create a challenge → "Max participants" picker appears → select 5 → create
- [ ] Second user tries to join after 5 participants → gets "Challenge is full" error
- [ ] Create challenge with "Days Active" mode → log 2 workouts same day → score stays at 1
- [ ] Log workout on a new day → score increments to 2
- [ ] Challenges screen → "🔍" tab opens → public challenges listed with Join button
- [ ] Tap Join on a public challenge → navigates to ChallengeDetail
- [ ] ChallengeCard shows "👥 2/5" badge for capped challenges
