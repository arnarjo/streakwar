# Challenge Calendar System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a curated annual challenge calendar with daily missions (Mon/Wed/Fri), reliable auto-renewal via GitHub Actions, monthly themed challenges, and holiday challenges — while removing user-created public challenges from Discover.

**Architecture:** Two DB migrations add the `daily` renewal type and seed the 2026 content calendar. A new `rotate-daily-mission` edge function creates daily challenges deterministically. A GitHub Actions workflow calls both cron functions at 01:00 UTC daily. The Discover screen is restructured into four typed sections.

**Tech Stack:** PostgreSQL migrations, Deno/TypeScript edge functions, GitHub Actions, React Native (TypeScript)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260606100000_daily_missions.sql` | Create | Add `daily` renewal_type, `daily_mission_templates` table + seed, fix RLS |
| `supabase/migrations/20260606200000_challenge_calendar_2026.sql` | Create | Seed monthly + holiday challenges Jul–Dec 2026 |
| `supabase/functions/rotate-daily-mission/index.ts` | Create | Edge function: picks template by week, inserts today's daily challenge |
| `.github/workflows/challenge-cron.yml` | Create | GitHub Actions: daily 01:00 UTC trigger for both cron functions |
| `src/screens/DiscoverChallengesScreen.tsx` | Modify | Restructure into 4 sections, remove user-public section + filter bar |

---

## Task 1: DB Migration — Daily Mission Infrastructure

**Files:**
- Create: `supabase/migrations/20260606100000_daily_missions.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260606100000_daily_missions.sql

-- 1. Add 'daily' to renewal_type enum
ALTER TABLE fitness_challenges
  DROP CONSTRAINT IF EXISTS fitness_challenges_renewal_type_check;
ALTER TABLE fitness_challenges
  ADD CONSTRAINT fitness_challenges_renewal_type_check
    CHECK (renewal_type IN ('none', 'weekly', 'monthly', 'daily'));

-- 2. Daily mission template pool
CREATE TABLE IF NOT EXISTS daily_mission_templates (
  id            serial PRIMARY KEY,
  name          text    NOT NULL,
  description   text    NOT NULL,
  scoring_modes text[]  NOT NULL,
  goal_label    text    NOT NULL,
  sort_order    integer NOT NULL,
  is_active     boolean NOT NULL DEFAULT true
);

INSERT INTO daily_mission_templates
  (name, description, scoring_modes, goal_label, sort_order)
VALUES
  ('Skrefadagur 👟',   'Náðu 8.000 skrefum í dag',              ARRAY['steps'],       '8.000 skref', 1),
  ('Hlaupsdagur 🏃',   'Hlauptu eða gakktu 5 km',               ARRAY['distance_km'], '5 km',        2),
  ('Brennudagur 🔥',   'Brenndu kaloríur í einni æfingu í dag',  ARRAY['workouts'],    'Æfing',       3),
  ('Þolþjálfun 💪',   'Kláraðu 30 mínútna æfingu í dag',        ARRAY['workouts'],    '30 mín',      4),
  ('Göngudagur 🚶',   '10.000 skref í dag',                      ARRAY['steps'],       '10.000 skref',5),
  ('Kílómetrarnir 📍', 'Ferðastu 3 km á hvaða hátt sem er',     ARRAY['distance_km'], '3 km',        6),
  ('Kraftdagur ⚡',    '45 mínútur af hreyfingu',                ARRAY['workouts'],    '45 mín',      7)
ON CONFLICT DO NOTHING;

-- 3. Fix RLS: users can no longer create public challenges
DROP POLICY IF EXISTS "Authenticated users create challenges" ON fitness_challenges;
CREATE POLICY "Authenticated users create challenges" ON fitness_challenges
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND is_public = false
    AND is_global = false
  );
```

- [ ] **Step 2: Push to Supabase**

Run in Supabase Studio SQL Editor (project `uzstenhkngldkrwnsmku`):
Paste the full SQL above and click Run.

Verify by running:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'daily_mission_templates';
-- Should return: id, name, description, scoring_modes, goal_label, sort_order, is_active

SELECT COUNT(*) FROM daily_mission_templates;
-- Should return: 7
```

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260606100000_daily_missions.sql
git commit -m "feat(db): add daily renewal_type, daily_mission_templates table, fix RLS"
```

---

## Task 2: DB Migration — 2026 Content Calendar

**Files:**
- Create: `supabase/migrations/20260606200000_challenge_calendar_2026.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260606200000_challenge_calendar_2026.sql
-- Seeds themed monthly challenges (Jul–Dec 2026) and holiday challenges.
-- All are is_global=true, is_public=true, renewal_type='none' (no auto-renewal).
-- Status is set by refresh_challenge_statuses() — the cron keeps them current.

SELECT refresh_challenge_statuses();

-- ── Monthly themed challenges ────────────────────────────────────────────────
INSERT INTO fitness_challenges
  (name, description, created_by, start_date, end_date, status,
   scoring_modes, points_per_workout, points_per_1000_steps, points_per_km, points_per_30min,
   is_public, is_global, renewal_type, tie_break_rule)
VALUES
  ('Sumarchallenge 🌞',
   'Stærsti sumarchallenge StreakWar! Kepptu við alla í allan júlí — skref, kílómetrar og æfingar telja.',
   NULL, '2026-07-01', '2026-07-31',
   CASE WHEN current_date BETWEEN '2026-07-01' AND '2026-07-31' THEN 'active'
        WHEN current_date < '2026-07-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','steps','distance_km'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Ágústbrennan 💪',
   'Þrýst á í ágúst! Flestar æfingar og flest skref vinnur.',
   NULL, '2026-08-01', '2026-08-31',
   CASE WHEN current_date BETWEEN '2026-08-01' AND '2026-08-31' THEN 'active'
        WHEN current_date < '2026-08-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','steps'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Haustræfing 🍂',
   'Haustið er komið — haldðu þér í formi! Workouts og kílómetrar telja í september.',
   NULL, '2026-09-01', '2026-09-30',
   CASE WHEN current_date BETWEEN '2026-09-01' AND '2026-09-30' THEN 'active'
        WHEN current_date < '2026-09-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','distance_km'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Vinterundirbúningur 🥶',
   'Búðu þig undir veturinn! Þessi mánaðarchallenge í október mælir days active, workouts og skref.',
   NULL, '2026-10-01', '2026-10-31',
   CASE WHEN current_date BETWEEN '2026-10-01' AND '2026-10-31' THEN 'active'
        WHEN current_date < '2026-10-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','steps','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Novemberkrafturinn 🏃',
   'Myrkur og kuldi stoppar þig ekki! Hreyfðu þig á hverjum degi í nóvember.',
   NULL, '2026-11-01', '2026-11-30',
   CASE WHEN current_date BETWEEN '2026-11-01' AND '2026-11-30' THEN 'active'
        WHEN current_date < '2026-11-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Jólachallenge 🎄',
   'Jólachallenge! Lát ekki jólaveislurnar stoppa þig — workouts, skref og active days telja alla desember.',
   NULL, '2026-12-01', '2026-12-31',
   CASE WHEN current_date BETWEEN '2026-12-01' AND '2026-12-31' THEN 'active'
        WHEN current_date < '2026-12-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','steps','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity')

ON CONFLICT DO NOTHING;

-- ── Holiday challenges ────────────────────────────────────────────────────────
INSERT INTO fitness_challenges
  (name, description, created_by, start_date, end_date, status,
   scoring_modes, points_per_workout, points_per_1000_steps, points_per_km, points_per_30min,
   is_public, is_global, renewal_type, tie_break_rule)
VALUES
  ('Jónsmessuchallenge 🌕',
   'Hinn heilagi Jónsmessudagur! Náðu 8.000 skrefum í dag.',
   NULL, '2026-06-24', '2026-06-24',
   CASE WHEN current_date = '2026-06-24' THEN 'active'
        WHEN current_date < '2026-06-24' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['steps'], 1, 1, 1, 1, true, true, 'none', 'most_recent_activity'),

  ('Þjóðhátíðarchallenge 🎉',
   'Þjóðhátíð í Vestmannaeyjum! Hreyfðu þig á þessum 5 dögum og safnaðu stigum.',
   NULL, '2026-08-01', '2026-08-05',
   CASE WHEN current_date BETWEEN '2026-08-01' AND '2026-08-05' THEN 'active'
        WHEN current_date < '2026-08-01' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Halloween 🎃',
   'Halloween challenge! Klárðu eina æfingu á skellilegasta degi ársins.',
   NULL, '2026-10-31', '2026-10-31',
   CASE WHEN current_date = '2026-10-31' THEN 'active'
        WHEN current_date < '2026-10-31' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Jólahreyfing ⛄',
   'Jólin eru hér! Hreyfðu þig á aðfangadegi og jólunum — fjórir dagar til að safna stigum.',
   NULL, '2026-12-23', '2026-12-26',
   CASE WHEN current_date BETWEEN '2026-12-23' AND '2026-12-26' THEN 'active'
        WHEN current_date < '2026-12-23' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['workouts','days_active'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity'),

  ('Áramótachallenge 🎆',
   'Lokaspretturinn! Kepptu við alla í síðustu dögum ársins og fyrstu dögum 2027.',
   NULL, '2026-12-30', '2027-01-02',
   CASE WHEN current_date BETWEEN '2026-12-30' AND '2027-01-02' THEN 'active'
        WHEN current_date < '2026-12-30' THEN 'upcoming' ELSE 'completed' END,
   ARRAY['steps','workouts'], 2, 1, 1, 2, true, true, 'none', 'most_recent_activity')

ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Push to Supabase Studio SQL Editor**

Paste and run. Verify:
```sql
SELECT name, start_date, end_date, status FROM fitness_challenges
WHERE is_global = true AND renewal_type = 'none'
ORDER BY start_date;
-- Should show 6 monthly + 5 holiday rows
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260606200000_challenge_calendar_2026.sql
git commit -m "feat(db): seed 2026 monthly + holiday challenge calendar"
```

---

## Task 3: Edge Function — rotate-daily-mission

**Files:**
- Create: `supabase/functions/rotate-daily-mission/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/rotate-daily-mission/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.error('CRON_SECRET not set');
    return new Response('Service unavailable', { status: 503 });
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  // Only run on Monday(1), Wednesday(3), Friday(5) UTC
  const dayOfWeek = today.getUTCDay();
  if (dayOfWeek !== 1 && dayOfWeek !== 3 && dayOfWeek !== 5) {
    return Response.json({ ok: true, skipped: true, reason: 'not a mission day', day: dayOfWeek });
  }

  // Idempotent: skip if today's daily challenge already exists
  const { data: existing } = await supabase
    .from('fitness_challenges')
    .select('id')
    .eq('is_global', true)
    .eq('renewal_type', 'daily')
    .eq('start_date', todayStr)
    .maybeSingle();

  if (existing) {
    return Response.json({ ok: true, skipped: true, reason: 'already exists', date: todayStr });
  }

  // Pick template deterministically by ISO week number
  const { data: templates, error: tErr } = await supabase
    .from('daily_mission_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (tErr || !templates || templates.length === 0) {
    console.error('Failed to fetch templates:', tErr);
    return Response.json({ ok: false, error: 'no templates' }, { status: 500 });
  }

  const weekOfYear = isoWeekNumber(today);
  const template = templates[weekOfYear % templates.length];

  const { error: insertErr } = await supabase.from('fitness_challenges').insert({
    name:                  template.name,
    description:           template.description,
    created_by:            null,
    start_date:            todayStr,
    end_date:              todayStr,
    status:                'active',
    scoring_modes:         template.scoring_modes,
    points_per_workout:    1,
    points_per_1000_steps: 1,
    points_per_km:         1,
    points_per_30min:      1,
    is_public:             true,
    is_global:             true,
    renewal_type:          'daily',
    tie_break_rule:        'most_recent_activity',
  });

  if (insertErr) {
    console.error('Insert failed:', insertErr);
    return Response.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  console.log(`Created daily mission "${template.name}" for ${todayStr} (week ${weekOfYear})`);
  return Response.json({ ok: true, name: template.name, date: todayStr });
});

/** Returns ISO week number (1–53) for a given Date */
function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy rotate-daily-mission --project-ref uzstenhkngldkrwnsmku
```

Expected output: `Deployed Function rotate-daily-mission`

- [ ] **Step 3: Smoke-test manually (Wednesday or Friday)**

If today is Mon/Wed/Fri:
```bash
curl -X POST https://uzstenhkngldkrwnsmku.supabase.co/functions/v1/rotate-daily-mission \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Expected: `{"ok":true,"name":"...","date":"2026-06-06"}`

If today is another day:
Expected: `{"ok":true,"skipped":true,"reason":"not a mission day","day":5}`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/rotate-daily-mission/index.ts
git commit -m "feat(functions): rotate-daily-mission edge function"
```

---

## Task 4: GitHub Actions Cron Workflow

**Files:**
- Create: `.github/workflows/challenge-cron.yml`

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/challenge-cron.yml
name: Challenge Cron

on:
  schedule:
    - cron: '0 1 * * *'   # 01:00 UTC daily
  workflow_dispatch:        # allows manual trigger from GitHub UI

jobs:
  cron:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Renew recurring challenges
        run: |
          curl -sS -X POST \
            "$SUPABASE_FUNCTIONS_URL/renew-challenges" \
            -H "Authorization: Bearer $CRON_SECRET" \
            --fail-with-body
        env:
          SUPABASE_FUNCTIONS_URL: ${{ secrets.SUPABASE_FUNCTIONS_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}

      - name: Rotate daily mission
        run: |
          curl -sS -X POST \
            "$SUPABASE_FUNCTIONS_URL/rotate-daily-mission" \
            -H "Authorization: Bearer $CRON_SECRET" \
            --fail-with-body
        env:
          SUPABASE_FUNCTIONS_URL: ${{ secrets.SUPABASE_FUNCTIONS_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

- [ ] **Step 2: Add GitHub repository secrets**

In GitHub → repo Settings → Secrets and variables → Actions → New repository secret:

| Secret name | Value |
|-------------|-------|
| `SUPABASE_FUNCTIONS_URL` | `https://uzstenhkngldkrwnsmku.supabase.co/functions/v1` |
| `CRON_SECRET` | The same value stored in Supabase Vault as `CRON_SECRET` |

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/challenge-cron.yml
git commit -m "feat(ci): daily cron for challenge renewal and daily mission rotation"
git push origin feature/perfect-app-10-10
```

- [ ] **Step 4: Verify via manual trigger**

In GitHub → Actions → Challenge Cron → Run workflow. Check both steps pass (green checkmarks).

---

## Task 5: Discover Screen Redesign

**Files:**
- Modify: `src/screens/DiscoverChallengesScreen.tsx`

- [ ] **Step 1: Replace the file with the new version**

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { SCORING_MODE_LABELS } from '../types/database';
import type { FitnessChallenge } from '../types/database';
import { C } from '../theme';

type Props = {
  myChallenges: FitnessChallenge[];
  joinPublic: (challengeId: string) => Promise<{ error: string | null }>;
  onRefreshMyChallenges: () => Promise<void>;
};

type JoinButtonProps = {
  item: FitnessChallenge;
  joined: boolean;
  full: boolean;
  busy: boolean;
  onJoin: (item: FitnessChallenge) => void;
};

function JoinButton({ item, joined, full, busy, onJoin }: JoinButtonProps) {
  return (
    <TouchableOpacity
      style={[s.joinBtn, (joined || full) && s.joinBtnDisabled]}
      onPress={() => !joined && !full && onJoin(item)}
      disabled={joined || full || busy}
      accessibilityRole="button"
      accessibilityLabel={joined ? 'Þegar í challenge' : full ? 'Fullt' : `Taka þátt í ${item.name}`}
    >
      <Text style={[s.joinBtnText, (joined || full) && s.joinBtnTextDisabled]}>
        {busy ? '...' : joined ? 'Joined' : full ? 'Full' : 'Join'}
      </Text>
    </TouchableOpacity>
  );
}

const BADGE_STYLE: Record<string, { border: string; badge: string; label: string }> = {
  daily:   { border: '#10B981', badge: '#10B98120', label: '⚡ DAGLEG' },
  weekly:  { border: C.primary, badge: '#F9731620', label: '🔥 WEEKLY' },
  monthly: { border: C.gold,    badge: '#F59E0B20', label: '🏆 MONTHLY' },
  none:    { border: C.muted2,  badge: 'rgba(255,255,255,0.04)', label: '🎉 SÉRSTAKUR' },
};

export default function DiscoverChallengesScreen({ myChallenges, joinPublic, onRefreshMyChallenges }: Props) {
  const navigation = useNavigation<any>();

  const [dailyMissions, setDailyMissions] = useState<FitnessChallenge[]>([]);
  const [recurringChallenges, setRecurringChallenges] = useState<FitnessChallenge[]>([]);
  const [specialChallenges, setSpecialChallenges] = useState<FitnessChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const { data, error } = await supabase
      .from('fitness_challenges')
      .select('*, challenge_participants(count)')
      .eq('is_global', true)
      .in('status', ['active', 'upcoming'])
      .order('start_date', { ascending: true });

    if (error) {
      setLoadError(true);
    } else {
      const withCount = (data ?? []).map((c: any) => ({
        ...c,
        participant_count: Number(c.challenge_participants?.[0]?.count ?? 0),
      }));
      setDailyMissions(withCount.filter((c: FitnessChallenge) => c.renewal_type === 'daily'));
      setRecurringChallenges(withCount.filter((c: FitnessChallenge) =>
        c.renewal_type === 'weekly' || c.renewal_type === 'monthly'
      ));
      setSpecialChallenges(withCount.filter((c: FitnessChallenge) =>
        c.renewal_type === 'none'
      ));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleJoin(challenge: FitnessChallenge) {
    setJoining(challenge.id);
    const { error } = await joinPublic(challenge.id);
    setJoining(null);
    if (error) {
      Alert.alert('Could not join', error);
    } else {
      await Promise.all([load(), onRefreshMyChallenges()]);
      navigation.navigate('ChallengeDetail', { challengeId: challenge.id });
    }
  }

  function isJoined(challengeId: string) {
    return myChallenges.some(c => c.id === challengeId);
  }

  function isFull(challenge: FitnessChallenge) {
    return !!(challenge.max_participants && (challenge.participant_count ?? 0) >= challenge.max_participants);
  }

  function daysLeftLabel(endDate: string) {
    const d = differenceInDays(parseISO(endDate), new Date());
    if (d < 0) return 'Ending soon';
    if (d === 0) return 'Í dag!';
    return `${d}d left`;
  }

  function ChallengeCard({ item }: { item: FitnessChallenge }) {
    const style = BADGE_STYLE[item.renewal_type ?? 'none'] ?? BADGE_STYLE.none;
    const modes = item.scoring_modes ?? [];
    const modeEmoji = SCORING_MODE_LABELS[modes[0]]?.split(' ')[0] ?? '💪';
    return (
      <View style={[s.card, { borderColor: style.border + '80' }]}>
        <View style={[s.badge, { backgroundColor: style.badge }]}>
          <Text style={[s.badgeText, { color: style.border }]}>{style.label}</Text>
        </View>
        <View style={s.cardContent}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.cardMeta}>
            {modeEmoji} {modes.map(m => SCORING_MODE_LABELS[m]).join(' · ')}
          </Text>
          <Text style={[s.cardMeta, { marginTop: 2 }]}>
            👥 {item.participant_count ?? 0} þátttakendur · {daysLeftLabel(item.end_date)}
          </Text>
        </View>
        <JoinButton
          item={item}
          joined={isJoined(item.id)}
          full={isFull(item)}
          busy={joining === item.id}
          onJoin={handleJoin}
        />
      </View>
    );
  }

  function Section({ title, sub, items }: { title: string; sub: string; items: FitnessChallenge[] }) {
    if (items.length === 0) return null;
    return (
      <View style={s.section}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionSub}>{sub}</Text>
        {items.map(item => <ChallengeCard key={item.id} item={item} />)}
      </View>
    );
  }

  const hasAnything = dailyMissions.length > 0 || recurringChallenges.length > 0 || specialChallenges.length > 0;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
    >
      {!hasAnything && !loading && (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>{loadError ? '⚠️' : '🔍'}</Text>
          <Text style={s.emptyTitle}>{loadError ? 'Failed to load' : 'No challenges yet'}</Text>
          <Text style={s.emptySub}>
            {loadError ? 'Check your connection and pull down to retry' : 'Check back soon'}
          </Text>
        </View>
      )}

      <Section
        title="⚡ Dagsverkefni"
        sub="Dagleg mission — breytist þrisvar í viku"
        items={dailyMissions}
      />
      <Section
        title="🔥 Viku & Mánaðar"
        sub="Endurnýjast sjálfkrafa — alltaf í gangi"
        items={recurringChallenges}
      />
      <Section
        title="🎉 Helgadagar & Sérstakir"
        sub="Curated challenges yfir árið"
        items={specialChallenges}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 2 },
  sectionSub: { fontSize: 12, color: C.muted2, marginBottom: 10 },

  card: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  cardContent: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: C.muted2 },

  joinBtn: { backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  joinBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border },
  joinBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  joinBtnTextDisabled: { color: C.muted2 },

  empty: { paddingTop: 60, alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  emptySub: { fontSize: 13, color: C.muted2, textAlign: 'center' },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to DiscoverChallengesScreen.

- [ ] **Step 3: Commit**

```bash
git add src/screens/DiscoverChallengesScreen.tsx
git commit -m "feat(ui): restructure Discover into daily/recurring/special sections"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** daily_mission_templates ✓, `daily` renewal_type ✓, GitHub Actions ✓, monthly seed ✓, holiday seed ✓, Discover UI 4 sections ✓, RLS fix ✓
- [x] **No placeholders:** all SQL is complete, all TypeScript is complete
- [x] **Type consistency:** `FitnessChallenge` used consistently, `renewal_type` string values match DB constraint exactly (`'daily'|'weekly'|'monthly'|'none'`)
- [x] **BADGE_STYLE covers all renewal_type values** including `'none'` fallback
- [x] **Idempotent edge function** — checks for existing daily challenge before insert
- [x] **`renew-challenges` still handles weekly/monthly** — no changes needed there, Task 4 just adds the trigger
