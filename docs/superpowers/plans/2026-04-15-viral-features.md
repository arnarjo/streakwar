# StreakWar Viral Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add league competition system, multi-type reactions, trash talk in challenges, weekly recap notifications, and Strava OAuth deployment to make StreakWar viral.

**Architecture:** Four independent phases — (1) League System with DB + Edge Function + UI, (2) Reactions & Trash Talk updating existing tables + new challenge_messages table, (3) Weekly Recap screen + cron Edge Function, (4) Strava deployment. All JS/TS changes — no new native modules, so no EAS rebuild needed; use `npx expo start --dev-client`.

**Tech Stack:** React Native + Expo SDK 54, Supabase (Postgres + Edge Functions), expo-notifications, date-fns, TypeScript

**Dev server:** `npx expo start --dev-client` in `c:\Users\maria\Arnar\streakwar\app`

---

## Phase 1: League System

### Task 1: DB Migration — League Tables + RPC

**Files:**
- Create: `supabase/migrations/005_leagues.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/005_leagues.sql`:

```sql
-- StreakWar – League system
-- Run in Supabase SQL Editor after 004

-- ── Tier enum ─────────────────────────────────────────────────
do $$ begin
  create type league_tier as enum ('bronze', 'silver', 'gold', 'platinum', 'diamond');
exception when duplicate_object then null; end $$;

-- ── Current tier per user ─────────────────────────────────────
create table if not exists user_league_tier (
  user_id    uuid primary key references profiles(id) on delete cascade,
  tier       league_tier not null default 'bronze',
  updated_at timestamptz default now()
);

alter table user_league_tier enable row level security;
drop policy if exists "League tiers readable" on user_league_tier;
create policy "League tiers readable" on user_league_tier for select using (true);
drop policy if exists "League tiers writable by service" on user_league_tier;
create policy "League tiers writable by service" on user_league_tier
  for all using (true) with check (true);

-- ── League groups (20-person buckets per week) ────────────────
create table if not exists league_groups (
  id         uuid primary key default uuid_generate_v4(),
  tier       league_tier not null,
  week_start date not null,
  created_at timestamptz default now()
);

alter table league_groups enable row level security;
drop policy if exists "League groups readable" on league_groups;
create policy "League groups readable" on league_groups for select using (true);

-- ── Who is in which group ─────────────────────────────────────
create table if not exists league_memberships (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id) on delete cascade not null,
  group_id    uuid references league_groups(id) on delete cascade not null,
  week_start  date not null,
  final_rank  integer,
  promoted    boolean default false,
  relegated   boolean default false,
  unique(user_id, week_start)
);

alter table league_memberships enable row level security;
drop policy if exists "Memberships readable" on league_memberships;
create policy "Memberships readable" on league_memberships for select using (true);
drop policy if exists "Memberships writable by service" on league_memberships;
create policy "Memberships writable by service" on league_memberships
  for all using (true) with check (true);

create index if not exists idx_memberships_user_week on league_memberships(user_id, week_start);
create index if not exists idx_memberships_group on league_memberships(group_id, week_start);

-- ── RPC: Get leaderboard for a league group ───────────────────
create or replace function get_league_group_leaderboard(p_group_id uuid, p_week_start date)
returns table (
  user_id       uuid,
  username      text,
  full_name     text,
  tier          text,
  weekly_points bigint
)
language sql security definer as $$
  select
    p.id as user_id,
    p.username,
    p.full_name,
    ult.tier::text,
    coalesce(sum(
      1
      + coalesce(floor(wp.steps          / 1000.0)::integer, 0)
      + coalesce(floor(wp.distance_km              )::integer, 0)
      + coalesce(floor(wp.duration_minutes / 30.0 )::integer, 0)
    ), 0) as weekly_points
  from league_memberships lm
  join profiles p on p.id = lm.user_id
  left join user_league_tier ult on ult.user_id = p.id
  left join workout_posts wp
    on  wp.user_id = p.id
    and wp.workout_date >= p_week_start
    and wp.workout_date <= current_date
  where lm.group_id = p_group_id
    and lm.week_start = p_week_start
  group by p.id, p.username, p.full_name, ult.tier
  order by weekly_points desc;
$$;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Copy the SQL above, paste into Supabase Dashboard → StreakWar project → SQL Editor → New query → Run.
Expected: no errors, 3 tables created.

---

### Task 2: useLeague Hook

**Files:**
- Create: `src/hooks/useLeague.ts`
- Modify: `src/types/database.ts` (add league types)

- [ ] **Step 1: Add types to `src/types/database.ts`**

Add at the end of the file (before the last line):

```typescript
// ── League ────────────────────────────────────────────────────
export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export const LEAGUE_TIER_META: Record<LeagueTier, { label: string; emoji: string; color: string }> = {
  bronze:   { label: 'Bronze',   emoji: '🥉', color: '#B45309' },
  silver:   { label: 'Silver',   emoji: '🥈', color: '#9CA3AF' },
  gold:     { label: 'Gold',     emoji: '🥇', color: '#F59E0B' },
  platinum: { label: 'Platinum', emoji: '💎', color: '#60A5FA' },
  diamond:  { label: 'Diamond',  emoji: '👑', color: '#A78BFA' },
};

export interface LeagueMember {
  user_id: string;
  username: string;
  full_name: string | null;
  tier: LeagueTier;
  weekly_points: number;
}
```

- [ ] **Step 2: Create `src/hooks/useLeague.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { LeagueTier, LeagueMember } from '../types/database';

function currentMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff)
    .toISOString().slice(0, 10);
}

export function useLeague(userId: string) {
  const [members, setMembers]   = useState<LeagueMember[]>([]);
  const [myTier, setMyTier]     = useState<LeagueTier>('bronze');
  const [myRank, setMyRank]     = useState<number | null>(null);
  const [groupId, setGroupId]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const weekStart = currentMonday();

    // Get or create user's tier record
    const { data: tierRow } = await supabase
      .from('user_league_tier')
      .select('tier')
      .eq('user_id', userId)
      .maybeSingle();

    if (tierRow) {
      setMyTier(tierRow.tier as LeagueTier);
    } else {
      // First time: insert bronze tier
      await supabase.from('user_league_tier').insert({ user_id: userId, tier: 'bronze' });
      setMyTier('bronze');
    }

    // Find this week's group membership
    const { data: membership } = await supabase
      .from('league_memberships')
      .select('group_id')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (!membership) {
      setLoading(false);
      return; // Edge Function hasn't assigned a group yet
    }

    setGroupId(membership.group_id);

    // Get leaderboard for this group
    const { data: rows } = await supabase
      .rpc('get_league_group_leaderboard', {
        p_group_id: membership.group_id,
        p_week_start: weekStart,
      });

    if (rows) {
      setMembers(rows as LeagueMember[]);
      const idx = (rows as LeagueMember[]).findIndex(m => m.user_id === userId);
      setMyRank(idx >= 0 ? idx + 1 : null);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { members, myTier, myRank, groupId, loading, refresh: fetch, currentMonday };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLeague.ts src/types/database.ts
git commit -m "feat: add useLeague hook and league types"
```

---

### Task 3: LeaderboardScreen — Add League Tab

**Files:**
- Modify: `src/screens/LeaderboardScreen.tsx`

- [ ] **Step 1: Read the full file**

Read `src/screens/LeaderboardScreen.tsx` to see exact current tab structure.

- [ ] **Step 2: Add League tab**

At the top of the file add the import:
```typescript
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_TIER_META } from '../types/database';
import type { LeagueTier } from '../types/database';
```

Change the Tab type from:
```typescript
type Tab = 'week' | 'world' | 'friends';
```
to:
```typescript
type Tab = 'league' | 'week' | 'world' | 'friends';
```

Inside `LeaderboardScreen`, add after the existing hooks:
```typescript
const { members: leagueMembers, myTier, myRank, loading: leagueLoading, refresh: refreshLeague } = useLeague(userId);
const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];
```

Change the default tab from `'week'` to `'league'`:
```typescript
const [tab, setTab] = useState<Tab>('league');
```

Add `'league'` to the tab bar (before 'week'). Find the tabs row and add:
```typescript
{ key: 'league', label: `${tierMeta?.emoji ?? '🥉'} League` },
```

Add the league tab content panel (below the existing panels):
```typescript
{tab === 'league' && (
  <FlatList
    data={leagueMembers}
    keyExtractor={m => m.user_id}
    contentContainerStyle={s.list}
    refreshControl={<RefreshControl refreshing={leagueLoading} onRefresh={refreshLeague} tintColor={C.primary} />}
    ListHeaderComponent={
      <View style={s.leagueHeader}>
        <Text style={[s.leagueTierLabel, { color: tierMeta?.color ?? C.primary }]}>
          {tierMeta?.emoji} {tierMeta?.label} League
        </Text>
        <Text style={s.leagueSubLabel}>Top 5 promote · Bottom 5 relegate</Text>
        {leagueMembers.length === 0 && !leagueLoading && (
          <View style={s.leagueEmpty}>
            <Text style={s.leagueEmptyText}>Your league group is being set up — check back Monday!</Text>
          </View>
        )}
      </View>
    }
    renderItem={({ item, index }) => {
      const rank = index + 1;
      const isMe = item.user_id === userId;
      const isPromotion = rank <= 5;
      const isRelegation = rank > leagueMembers.length - 5 && leagueMembers.length >= 10;
      const initials = (item.full_name ?? item.username)
        .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
      return (
        <View style={[
          s.leagueRow,
          isMe && s.leagueRowMe,
          isPromotion && s.leagueRowPromotion,
          isRelegation && s.leagueRowRelegation,
        ]}>
          <Text style={[s.leagueRank, { color: rankColor(rank) }]}>{medalOrRank(rank)}</Text>
          <View style={s.leagueAvatar}>
            <Text style={s.leagueAvatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.leagueName} numberOfLines={1}>
              {item.full_name ?? item.username}{isMe ? ' (you)' : ''}
            </Text>
            {isPromotion && <Text style={s.promotionTag}>⬆️ Promotion zone</Text>}
            {isRelegation && <Text style={s.relegationTag}>⬇️ Relegation zone</Text>}
          </View>
          <Text style={s.leaguePts}>{item.weekly_points} pts</Text>
        </View>
      );
    }}
  />
)}
```

Add styles to the StyleSheet:
```typescript
leagueHeader: { paddingBottom: 8 },
leagueTierLabel: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
leagueSubLabel: { fontSize: 12, color: C.muted, marginBottom: 12 },
leagueEmpty: { paddingVertical: 24, alignItems: 'center' },
leagueEmptyText: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
leagueRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 6, gap: 10 },
leagueRowMe: { borderColor: C.primary + '60', backgroundColor: C.primary + '10' },
leagueRowPromotion: { borderLeftWidth: 3, borderLeftColor: '#22C55E' },
leagueRowRelegation: { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
leagueRank: { fontSize: 14, fontWeight: '800', width: 32, textAlign: 'center' },
leagueAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' },
leagueAvatarText: { fontSize: 13, fontWeight: '800', color: C.primary },
leagueName: { fontSize: 14, fontWeight: '700', color: C.text },
promotionTag: { fontSize: 10, color: '#22C55E', fontWeight: '700', marginTop: 2 },
relegationTag: { fontSize: 10, color: '#EF4444', fontWeight: '700', marginTop: 2 },
leaguePts: { fontSize: 15, fontWeight: '900', color: C.primary },
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/LeaderboardScreen.tsx
git commit -m "feat: add League tab to LeaderboardScreen"
```

---

### Task 4: HomeScreen — League Banner

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Add league banner to HomeScreen**

Add import at top:
```typescript
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_TIER_META } from '../types/database';
import type { LeagueTier } from '../types/database';
```

Inside `HomeScreen`, add after existing hooks:
```typescript
const { myTier, myRank, members: leagueMembers } = useLeague(profile?.id ?? '');
const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];
const daysUntilSunday = 7 - new Date().getDay() || 7;
```

In `ListHeaderComponent`, add this banner after the streak banner:
```typescript
{leagueMembers.length > 0 && myRank !== null && (
  <TouchableOpacity
    style={s.leagueBanner}
    onPress={() => navigation.navigate('Leaderboard')}
    activeOpacity={0.85}
  >
    <Text style={s.leagueBannerEmoji}>{tierMeta?.emoji ?? '🥉'}</Text>
    <View style={{ flex: 1 }}>
      <Text style={[s.leagueBannerTitle, { color: tierMeta?.color ?? '#B45309' }]}>
        #{myRank} in {tierMeta?.label} League
      </Text>
      <Text style={s.leagueBannerSub}>
        {daysUntilSunday} day{daysUntilSunday !== 1 ? 's' : ''} left · {leagueMembers.length} competitors
      </Text>
    </View>
    <Text style={s.leagueBannerArrow}>→</Text>
  </TouchableOpacity>
)}
```

Add styles:
```typescript
leagueBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1C1828', borderWidth: 1, borderColor: '#7C3AED30', borderRadius: 14, padding: 14, marginBottom: 10 },
leagueBannerEmoji: { fontSize: 28 },
leagueBannerTitle: { fontSize: 15, fontWeight: '800' },
leagueBannerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
leagueBannerArrow: { fontSize: 18, color: '#7C3AED', fontWeight: '700' },
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: add league banner to HomeScreen"
```

---

### Task 5: Edge Function — Weekly League Reset

**Files:**
- Create: `supabase/functions/weekly-league-reset/index.ts`

- [ ] **Step 1: Create Edge Function**

Create `supabase/functions/weekly-league-reset/index.ts`:

```typescript
// Runs every Monday at 00:01 UTC (set up cron in Supabase Dashboard)
// 1. Calculates final ranks for last week
// 2. Promotes/relegates users
// 3. Creates new league groups for this week
// 4. Sends push notifications

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;
type Tier = typeof TIERS[number];

function getLastMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff - 7);
  return monday.toISOString().slice(0, 10);
}

function getCurrentMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().slice(0, 10);
}

function nextTier(tier: Tier): Tier {
  const idx = TIERS.indexOf(tier);
  return TIERS[Math.min(idx + 1, TIERS.length - 1)];
}

function prevTier(tier: Tier): Tier {
  const idx = TIERS.indexOf(tier);
  return TIERS[Math.max(idx - 1, 0)];
}

Deno.serve(async () => {
  const lastWeek = getLastMonday();
  const thisWeek = getCurrentMonday();

  // ── Step 1: Finalise last week's groups ───────────────────────
  const { data: lastGroups } = await supabase
    .from('league_groups')
    .select('id, tier')
    .eq('week_start', lastWeek);

  for (const group of lastGroups ?? []) {
    const { data: rows } = await supabase
      .rpc('get_league_group_leaderboard', {
        p_group_id: group.id,
        p_week_start: lastWeek,
      });

    if (!rows || rows.length === 0) continue;

    const promotionCutoff = Math.min(5, Math.floor(rows.length * 0.25));
    const relegationCutoff = Math.max(rows.length - 5, Math.ceil(rows.length * 0.75));

    for (let i = 0; i < rows.length; i++) {
      const member = rows[i];
      const rank = i + 1;
      const promoted = rank <= promotionCutoff && group.tier !== 'diamond';
      const relegated = rank > relegationCutoff && group.tier !== 'bronze';

      // Update membership final rank
      await supabase
        .from('league_memberships')
        .update({ final_rank: rank, promoted, relegated })
        .eq('user_id', member.user_id)
        .eq('week_start', lastWeek);

      // Update user's tier
      const newTier = promoted
        ? nextTier(group.tier as Tier)
        : relegated
          ? prevTier(group.tier as Tier)
          : group.tier;

      await supabase
        .from('user_league_tier')
        .upsert({ user_id: member.user_id, tier: newTier, updated_at: new Date().toISOString() });

      // Send push notification
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', member.user_id)
        .maybeSingle();

      if ((profile as any)?.push_token) {
        const title = promoted
          ? `Promoted to ${nextTier(group.tier as Tier)} league! 🎉`
          : relegated
            ? `Relegated to ${prevTier(group.tier as Tier)} league`
            : `League week complete`;
        const body = promoted
          ? `You finished #${rank} — keep it up! 🔥`
          : relegated
            ? `Finish in the top half next week to move back up`
            : `You finished #${rank} in ${group.tier} league`;

        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: (profile as any).push_token,
            title,
            body,
            sound: 'default',
          }),
        });
      }
    }
  }

  // ── Step 2: Create new groups for this week ────────────────────
  // Get all users grouped by tier
  const { data: allTiers } = await supabase
    .from('user_league_tier')
    .select('user_id, tier');

  const byTier: Record<Tier, string[]> = {
    bronze: [], silver: [], gold: [], platinum: [], diamond: [],
  };

  for (const row of allTiers ?? []) {
    byTier[row.tier as Tier].push(row.user_id);
  }

  // Add users not yet in any tier to bronze
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id');

  const tieredIds = new Set((allTiers ?? []).map(r => r.user_id));
  for (const p of allProfiles ?? []) {
    if (!tieredIds.has(p.id)) {
      byTier.bronze.push(p.id);
      await supabase.from('user_league_tier').upsert({ user_id: p.id, tier: 'bronze' });
    }
  }

  // Bucket each tier into groups of 20
  for (const tier of TIERS) {
    const users = byTier[tier];
    // Shuffle for fairness
    for (let i = users.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [users[i], users[j]] = [users[j], users[i]];
    }

    for (let i = 0; i < users.length; i += 20) {
      const chunk = users.slice(i, i + 20);
      if (chunk.length === 0) continue;

      // Create group
      const { data: group } = await supabase
        .from('league_groups')
        .insert({ tier, week_start: thisWeek })
        .select()
        .single();

      if (!group) continue;

      // Add members
      await supabase.from('league_memberships').insert(
        chunk.map(user_id => ({ user_id, group_id: group.id, week_start: thisWeek }))
      );
    }
  }

  return new Response(JSON.stringify({ ok: true, week: thisWeek }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Deploy Edge Function**

```bash
cd c:\Users\maria\Arnar\streakwar\app
npx supabase functions deploy weekly-league-reset --project-ref uzstenhnkngldkrwnsmku
```

- [ ] **Step 3: Set up cron in Supabase Dashboard**

Go to Supabase Dashboard → StreakWar → Edge Functions → `weekly-league-reset` → Schedule.
Set cron: `1 0 * * 1` (Monday 00:01 UTC).

Alternatively run it manually once to create this week's groups:
```bash
npx supabase functions invoke weekly-league-reset --project-ref uzstenhnkngldkrwnsmku
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/weekly-league-reset/
git commit -m "feat: add weekly league reset Edge Function"
```

---

## Phase 2: Reactions + Trash Talk

### Task 6: DB Migration — Multi-type Reactions + Challenge Messages

**Files:**
- Create: `supabase/migrations/006_reactions_trash_talk.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/006_reactions_trash_talk.sql`:

```sql
-- StreakWar – Multi-type reactions + Trash talk
-- Run after 005

-- workout_reactions already exists — no schema change needed,
-- reaction column is already text. Just confirm it exists:
-- create table if not exists workout_reactions (already in 001)

-- ── Challenge trash talk ───────────────────────────────────────
create table if not exists challenge_messages (
  id           uuid primary key default uuid_generate_v4(),
  challenge_id uuid references fitness_challenges(id) on delete cascade not null,
  sender_id    uuid references profiles(id) on delete cascade not null,
  message_key  text not null,
  created_at   timestamptz default now()
);

alter table challenge_messages enable row level security;
drop policy if exists "Challenge messages readable by participants" on challenge_messages;
create policy "Challenge messages readable by participants" on challenge_messages
  for select using (
    exists (
      select 1 from challenge_participants
      where challenge_id = challenge_messages.challenge_id
        and user_id = auth.uid()
    )
  );
drop policy if exists "Challenge messages insertable by participants" on challenge_messages;
create policy "Challenge messages insertable by participants" on challenge_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from challenge_participants
      where challenge_id = challenge_messages.challenge_id
        and user_id = auth.uid()
    )
  );

create index if not exists idx_challenge_messages_challenge on challenge_messages(challenge_id, created_at desc);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Copy SQL, paste into Supabase → SQL Editor → Run. Expected: no errors.

---

### Task 7: Update REACTIONS Constant + WorkoutPostCard

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/components/WorkoutPostCard.tsx`

- [ ] **Step 1: Update REACTIONS in `src/types/database.ts`**

Find and replace:
```typescript
export const REACTIONS = ['💪', '🔥', '👏', '🤩', '❤️'] as const;
export type Reaction = typeof REACTIONS[number];
```
with:
```typescript
export const REACTIONS = ['🔥', '💪', '👏', '😂'] as const;
export type Reaction = typeof REACTIONS[number];
```

- [ ] **Step 2: Read full WorkoutPostCard to find reaction UI section**

Read `src/components/WorkoutPostCard.tsx` fully to see where reactions are rendered.

- [ ] **Step 3: Update reaction buttons in WorkoutPostCard**

Find the reaction row in the card and replace it with multi-reaction buttons that show all 4 reactions:

```typescript
{/* Reactions row */}
<View style={cs.reactRow}>
  {REACTIONS.map(emoji => {
    const count = post.reaction_counts?.[emoji] ?? 0;
    const active = post.my_reaction === emoji;
    return (
      <TouchableOpacity
        key={emoji}
        style={[cs.reactBtn, active && cs.reactBtnActive]}
        onPress={() => onReact(post.id, emoji)}
        activeOpacity={0.7}
      >
        <Text style={cs.reactEmoji}>{emoji}</Text>
        {count > 0 && <Text style={[cs.reactCount, active && { color: '#F97316' }]}>{count}</Text>}
      </TouchableOpacity>
    );
  })}
</View>
```

Add import at top of file:
```typescript
import { REACTIONS } from '../types/database';
```

Add styles (cs = card styles):
```typescript
reactRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
reactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
reactBtnActive: { backgroundColor: '#F9731615', borderColor: '#F9731640' },
reactEmoji: { fontSize: 16 },
reactCount: { fontSize: 12, fontWeight: '700', color: '#4A6070' },
```

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts src/components/WorkoutPostCard.tsx
git commit -m "feat: multi-type reactions (fire/muscle/clap/laugh)"
```

---

### Task 8: useChallengeMessages Hook + Trash Talk UI

**Files:**
- Create: `src/hooks/useChallengeMessages.ts`
- Modify: `src/screens/ChallengeDetailScreen.tsx`

- [ ] **Step 1: Create `src/hooks/useChallengeMessages.ts`**

```typescript
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const TRASH_TALK_MESSAGES: Record<string, string> = {
  see_you_at_top:    'See you at the top 🔥',
  just_giving_up:    'Just giving up already?',
  warming_up:        "I'm just warming up 💪",
  may_best_win:      'May the best win 😤',
  falling_behind:    "You're falling behind 📉",
  gg_better_athlete: 'GG, better athlete won 🏆',
};

export interface ChallengeMessage {
  id: string;
  sender_id: string;
  message_key: string;
  created_at: string;
  sender?: { username: string; full_name: string | null };
}

export function useChallengeMessages(challengeId: string, userId: string) {
  const [messages, setMessages] = useState<ChallengeMessage[]>([]);
  const [sending, setSending] = useState(false);

  const fetch = useCallback(async () => {
    if (!challengeId) return;
    const { data } = await supabase
      .from('challenge_messages')
      .select('*, sender:profiles!challenge_messages_sender_id_fkey(username, full_name)')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setMessages(data as ChallengeMessage[]);
  }, [challengeId]);

  const sendMessage = useCallback(async (messageKey: string) => {
    if (!userId || sending) return;
    setSending(true);
    await supabase.from('challenge_messages').insert({
      challenge_id: challengeId,
      sender_id: userId,
      message_key: messageKey,
    });
    setSending(false);
    await fetch();
  }, [challengeId, userId, sending, fetch]);

  return { messages, sending, fetch, sendMessage };
}
```

- [ ] **Step 2: Add Banter tab to ChallengeDetailScreen**

Read `src/screens/ChallengeDetailScreen.tsx` fully to find the tab definitions and render section.

Add import:
```typescript
import { useChallengeMessages, TRASH_TALK_MESSAGES } from '../hooks/useChallengeMessages';
```

Change tab type to include `'banter'`:
```typescript
type Tab = 'leaderboard' | 'feed' | 'banter' | 'info';
```

Add hook inside component:
```typescript
const { messages: banterMessages, sendMessage, fetch: fetchBanter } = useChallengeMessages(challengeId, profile?.id ?? '');
```

Call `fetchBanter()` in the `useEffect` that loads the challenge.

Add "Banter" to the tab bar (between 'feed' and 'info'):
```typescript
{ key: 'banter', label: '💬 Banter' }
```

Add banter panel content:
```typescript
{tab === 'banter' && (
  <View style={{ flex: 1 }}>
    {/* Trash talk buttons */}
    <View style={bs.trashGrid}>
      {Object.entries(TRASH_TALK_MESSAGES).map(([key, text]) => (
        <TouchableOpacity
          key={key}
          style={bs.trashBtn}
          onPress={() => sendMessage(key)}
          activeOpacity={0.75}
        >
          <Text style={bs.trashBtnText}>{text}</Text>
        </TouchableOpacity>
      ))}
    </View>
    {/* Message stream */}
    <FlatList
      data={banterMessages}
      keyExtractor={m => m.id}
      contentContainerStyle={bs.messageList}
      renderItem={({ item }) => (
        <View style={bs.messageRow}>
          <Text style={bs.messageSender}>
            {item.sender?.full_name ?? item.sender?.username ?? 'Unknown'}
          </Text>
          <Text style={bs.messageText}>{TRASH_TALK_MESSAGES[item.message_key]}</Text>
        </View>
      )}
      ListEmptyComponent={
        <View style={bs.emptyBanter}>
          <Text style={bs.emptyBanterText}>No trash talk yet — send the first shot 💬</Text>
        </View>
      }
    />
  </View>
)}
```

Add styles (bs = banter styles, add to StyleSheet.create):
```typescript
trashGrid: { padding: 16, gap: 8 },
trashBtn: { backgroundColor: '#151C24', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
trashBtnText: { fontSize: 14, color: '#EEF4F8', fontWeight: '600' },
messageList: { paddingHorizontal: 16, paddingBottom: 40 },
messageRow: { backgroundColor: '#1E2A35', borderRadius: 10, padding: 12, marginBottom: 6 },
messageSender: { fontSize: 11, color: '#F97316', fontWeight: '700', marginBottom: 2 },
messageText: { fontSize: 14, color: '#EEF4F8' },
emptyBanter: { alignItems: 'center', paddingTop: 32 },
emptyBanterText: { fontSize: 14, color: '#4A6070', textAlign: 'center' },
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useChallengeMessages.ts src/screens/ChallengeDetailScreen.tsx
git commit -m "feat: trash talk banter tab in challenges"
```

---

## Phase 3: Weekly Recap

### Task 9: WeeklyRecapScreen

**Files:**
- Create: `src/screens/WeeklyRecapScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Create `src/screens/WeeklyRecapScreen.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useStreaks } from '../hooks/useStreaks';
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_TIER_META } from '../types/database';
import type { LeagueTier } from '../types/database';

const C = {
  bg: '#0C1117', card: '#151C24', border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8', muted: '#4A6070', primary: '#F97316',
};

function getLastMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff - 7).toISOString().slice(0, 10);
}

function getCurrentMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().slice(0, 10);
}

export default function WeeklyRecapScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isCurrentWeek = route.params?.week === 'current';

  const weekStart = isCurrentWeek ? getCurrentMonday() : getLastMonday();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { streak } = useStreaks(profile?.id ?? '');
  const { myTier, myRank, members } = useLeague(profile?.id ?? '');
  const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];

  const [workoutCount, setWorkoutCount] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [totalPts, setTotalPts] = useState(0);
  const [prevWorkouts, setPrevWorkouts] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    async function load() {
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      const { data: workouts } = await supabase
        .from('workout_posts')
        .select('steps, duration_minutes, distance_km')
        .eq('user_id', profile!.id)
        .gte('workout_date', weekStart)
        .lte('workout_date', weekEndStr);

      const count = workouts?.length ?? 0;
      setWorkoutCount(count);

      const steps = (workouts ?? []).reduce((s, w) => s + (w.steps ?? 0), 0);
      setTotalSteps(steps);

      const pts = (workouts ?? []).reduce((s, w) =>
        s + 1
        + Math.floor((w.steps ?? 0) / 1000)
        + Math.floor(w.distance_km ?? 0)
        + Math.floor((w.duration_minutes ?? 0) / 30), 0);
      setTotalPts(pts);

      // Previous week comparison
      const prevStart = new Date(weekStart);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(weekStart);
      prevEnd.setDate(prevEnd.getDate() - 1);

      const { count: prevCount } = await supabase
        .from('workout_posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile!.id)
        .gte('workout_date', prevStart.toISOString().slice(0, 10))
        .lte('workout_date', prevEnd.toISOString().slice(0, 10));

      setPrevWorkouts(prevCount ?? 0);
    }
    load();
  }, [profile?.id, weekStart]);

  async function handleShare() {
    const diff = workoutCount - prevWorkouts;
    const diffText = diff > 0 ? `↑ ${diff} more than last week` : diff < 0 ? `↓ ${Math.abs(diff)} less than last week` : 'Same as last week';
    await Share.share({
      message:
        `My week on StreakWar 💪\n` +
        `${workoutCount} workouts · ${totalSteps.toLocaleString()} steps\n` +
        `🔥 ${streak?.current_streak ?? 0}-day streak\n` +
        `${tierMeta?.emoji} #${myRank} in ${tierMeta?.label} League\n` +
        `+${totalPts} pts this week · ${diffText}\n\n` +
        `Join me on StreakWar!`,
    });
  }

  const workoutDiff = workoutCount - prevWorkouts;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Weekly Recap</Text>
        <TouchableOpacity onPress={handleShare}>
          <Text style={s.shareBtn}>📤 Share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* League result */}
        <View style={[s.leagueCard, { borderColor: (tierMeta?.color ?? '#B45309') + '40' }]}>
          <Text style={[s.leagueTier, { color: tierMeta?.color ?? '#B45309' }]}>
            {tierMeta?.emoji} {tierMeta?.label} League
          </Text>
          <Text style={s.leagueRank}>#{myRank ?? '—'} of {members.length}</Text>
          <Text style={s.leagueSub}>Top 5 get promoted next week</Text>
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          {[
            { icon: '💪', value: workoutCount, label: 'Workouts', sub: workoutDiff > 0 ? `+${workoutDiff} vs last week` : workoutDiff < 0 ? `${workoutDiff} vs last week` : '= last week' },
            { icon: '👟', value: totalSteps.toLocaleString(), label: 'Steps', sub: '' },
            { icon: '⭐', value: `+${totalPts}`, label: 'Points', sub: 'earned this week' },
            { icon: '🔥', value: streak?.current_streak ?? 0, label: 'Streak', sub: `${streak?.longest_streak ?? 0} day best` },
          ].map(({ icon, value, label, sub }) => (
            <View key={label} style={s.statCard}>
              <Text style={s.statIcon}>{icon}</Text>
              <Text style={s.statValue}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
              {sub ? <Text style={s.statSub}>{sub}</Text> : null}
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.shareCard} onPress={handleShare} activeOpacity={0.85}>
          <Text style={s.shareCardTitle}>Share your week 📤</Text>
          <Text style={s.shareCardSub}>Show your friends what you achieved</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  back: { color: C.muted, fontSize: 14, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '800', color: C.text },
  shareBtn: { color: C.primary, fontSize: 14, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 80, gap: 16 },
  leagueCard: { borderWidth: 2, borderRadius: 16, padding: 20, alignItems: 'center', gap: 6, backgroundColor: C.card },
  leagueTier: { fontSize: 22, fontWeight: '900' },
  leagueRank: { fontSize: 32, fontWeight: '900', color: C.text },
  leagueSub: { fontSize: 12, color: C.muted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  statIcon: { fontSize: 24 },
  statValue: { fontSize: 26, fontWeight: '900', color: C.text },
  statLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  statSub: { fontSize: 10, color: C.muted, textAlign: 'center' },
  shareCard: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 18, alignItems: 'center', gap: 4, marginTop: 8 },
  shareCardTitle: { color: '#000', fontSize: 16, fontWeight: '800' },
  shareCardSub: { color: '#00000080', fontSize: 12 },
});
```

- [ ] **Step 2: Add WeeklyRecap to navigation**

Read `src/navigation/RootNavigator.tsx` to find the Stack.Screen list.

Add import:
```typescript
import WeeklyRecapScreen from '../screens/WeeklyRecapScreen';
```

Add screen inside the Stack.Navigator (same level as other screens):
```typescript
<Stack.Screen name="WeeklyRecap" component={WeeklyRecapScreen} options={{ headerShown: false }} />
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/WeeklyRecapScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: WeeklyRecapScreen with league result and share card"
```

---

### Task 10: Weekly Recap Notification Edge Function

**Files:**
- Create: `supabase/functions/weekly-recap-notification/index.ts`

- [ ] **Step 1: Create Edge Function**

Create `supabase/functions/weekly-recap-notification/index.ts`:

```typescript
// Runs every Monday at 08:00 UTC
// Sends "Your weekly recap is ready" push notification to all users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async () => {
  // Get all profiles with push tokens
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, push_token, full_name, username')
    .not('push_token', 'is', null);

  let sent = 0;

  for (const profile of profiles ?? []) {
    if (!(profile as any).push_token) continue;

    const name = (profile as any).full_name?.split(' ')[0] ?? (profile as any).username ?? 'there';

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: (profile as any).push_token,
        title: 'Your weekly recap is ready 📊',
        body: `See how you did this week, ${name}!`,
        sound: 'default',
        data: { screen: 'WeeklyRecap' },
      }),
    });

    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy weekly-recap-notification --project-ref uzstenhnkngldkrwnsmku
```

- [ ] **Step 3: Set cron in Supabase Dashboard**

Supabase Dashboard → StreakWar → Edge Functions → `weekly-recap-notification` → Schedule.
Cron: `0 8 * * 1` (Monday 08:00 UTC).

- [ ] **Step 4: Handle deep link in App.tsx**

In `App.tsx`, the `usePushNotifications` hook handles notification taps. Make sure tapping the recap notification navigates to `WeeklyRecap`. Read `src/hooks/usePushNotifications.ts` and add:

```typescript
if (data?.screen === 'WeeklyRecap') {
  navigationRef.current?.navigate('WeeklyRecap' as never);
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/weekly-recap-notification/ App.tsx
git commit -m "feat: weekly recap push notification Edge Function"
```

---

## Phase 4: Deploy Strava OAuth

### Task 11: Deploy Strava Edge Functions

**Files:**
- Existing: `supabase/functions/oauth-init/`
- Existing: `supabase/functions/oauth-callback/`

- [ ] **Step 1: Add Strava secrets to Supabase**

In Supabase Dashboard → StreakWar project → Edge Functions → Manage secrets, add:
- `STRAVA_CLIENT_ID` = `218896`
- `STRAVA_CLIENT_SECRET` = value from `.env` (`EXPO_PUBLIC_STRAVA_CLIENT_SECRET`)
- `APP_SCHEME` = `streakwar`
- `SUPABASE_URL` = `https://uzstenhnkngldkrwnsmku.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = value from `.env`

- [ ] **Step 2: Deploy functions**

```bash
npx supabase functions deploy oauth-init --project-ref uzstenhnkngldkrwnsmku
npx supabase functions deploy oauth-callback --project-ref uzstenhnkngldkrwnsmku
```

- [ ] **Step 3: Test Strava connect flow**

Open app → Profile → Auto-sync → Manage → tap Strava → should open browser OAuth flow → redirects back to app.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: deploy Strava OAuth Edge Functions"
```

---

## Final: EAS Build + Test

- [ ] **Commit all changes and build**

```bash
git add -A
git commit -m "chore: viral features complete - league, reactions, trash talk, recap"
eas build --platform android --profile development
```

- [ ] **Manual test checklist**

1. Log in → league banner appears on Home screen
2. Go to Leaderboard → League tab shows your group
3. React to a workout post → all 4 reactions appear
4. Open a challenge → Banter tab → send a trash talk message
5. Navigate to Profile → weekly recap manually via `navigation.navigate('WeeklyRecap')`
6. Hit Share → native share sheet opens with recap text
7. Profile → Manage → connect Strava
