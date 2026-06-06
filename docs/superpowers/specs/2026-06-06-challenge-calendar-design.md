# Challenge Calendar System — Design Spec
**Date:** 2026-06-06  
**Status:** Approved

## Overview

Expand StreakWar's global challenge system from two auto-renewing challenges (weekly + monthly) to a curated annual calendar with four tiers: daily missions (selective days), weekly (every week), monthly (every month), and holiday/special challenges. Only admins create global/public challenges. Users create private friend-group challenges exclusively.

---

## 1. Data Model Changes

### 1.1 `fitness_challenges` table

Add `'daily'` to the `renewal_type` check constraint:

```sql
ALTER TABLE fitness_challenges
  DROP CONSTRAINT IF EXISTS fitness_challenges_renewal_type_check;

ALTER TABLE fitness_challenges
  ADD CONSTRAINT fitness_challenges_renewal_type_check
    CHECK (renewal_type IN ('none', 'weekly', 'monthly', 'daily'));
```

No other schema changes needed. All global challenges use the existing `is_global = true` flag.

### 1.2 `daily_mission_templates` table (new)

Stores the rotating pool of daily missions used by the cron.

```sql
CREATE TABLE daily_mission_templates (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  description   text NOT NULL,
  scoring_modes text[] NOT NULL,
  goal_label    text NOT NULL,   -- human-readable, e.g. "8.000 skref"
  sort_order    integer NOT NULL,
  is_active     boolean NOT NULL DEFAULT true
);
```

**Seed data (7 templates):**

| sort_order | name | description | goal_label | scoring_modes (text[]) |
|-----------|------|-------------|------------|---------------|
| 1 | Skrefadagur 👟 | Náðu 8.000 skrefum í dag | 8.000 skref | {steps} |
| 2 | Hlaupsdagur 🏃 | Hlauptu eða gakktu 5 km | 5 km | {distance_km} |
| 3 | Brennudagur 🔥 | Brenndu kaloríur í einni æfingu í dag | Æfing | {workouts} |
| 4 | Þolþjálfun 💪 | Kláraðu 30 mínútna æfingu í dag | 30 mín | {workouts} |
| 5 | Göngudagur 🚶 | 10.000 skref í dag | 10.000 skref | {steps} |
| 6 | Kílómetrarnir 📍 | Ferðastu 3 km á hvaða hátt sem er | 3 km | {distance_km} |
| 7 | Kraftdagur ⚡ | 45 mínútur af hreyfingu | 45 mín | {workouts} |

Note: `goal_label` is display-only. Daily missions work like any challenge — users earn points normally; the leaderboard resets next day.

### 1.3 RLS change — remove user-created public challenges

Users can no longer set `is_public = true`. Only `is_global = true` challenges (admin-created) appear in Discover.

```sql
-- Drop and recreate insert policy: force is_public = false for all user inserts
DROP POLICY IF EXISTS "Users insert challenges" ON fitness_challenges;
CREATE POLICY "Users insert challenges" ON fitness_challenges
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND is_public = false
    AND is_global = false
  );
```

---

## 2. Auto-Renewal Infrastructure — GitHub Actions

### 2.1 Workflow file: `.github/workflows/challenge-cron.yml`

Runs daily at 01:00 UTC. Two jobs in sequence:
1. `renew-challenges` — handles weekly/monthly template expiry → creates next instance
2. `rotate-daily-mission` — checks if today is a mission day (Mon/Wed/Fri) → creates today's challenge from template rotation

**Secrets required in GitHub repo settings:**
- `SUPABASE_FUNCTIONS_URL` = `https://uzstenhkngldkrwnsmku.supabase.co/functions/v1`
- `CRON_SECRET` = same value as in Supabase Vault

### 2.2 New edge function: `rotate-daily-mission`

Logic:
1. Check `CRON_SECRET` header (same pattern as `renew-challenges`)
2. Determine if today is Mon, Wed, or Fri (UTC). If not, return `{ ok: true, skipped: true }`.
3. Check if a daily challenge already exists for today (idempotent).
4. Pick template: `SELECT * FROM daily_mission_templates WHERE is_active = true ORDER BY sort_order` then index by `week_of_year % template_count` — deterministic, predictable rotation.
5. Insert challenge: `is_global = true`, `is_public = true`, `renewal_type = 'daily'`, `start_date = today`, `end_date = today`, `status = 'active'`.

Daily missions expire at end of day — the existing `refresh_challenge_statuses()` DB function marks them `completed` the next morning.

---

## 3. Content Calendar — Rest of 2026

### 3.1 Monthly challenges (admin pre-seeded, `renewal_type = 'none'`)

The auto-renewing Viku/Mánaðar templates continue as-is. These themed challenges run **alongside** them — users see both in the "Þessi mánuður" section in Discover. The themed challenge has its own leaderboard and name; the generic Mánaðar Challenge auto-renews separately. New admin challenges are created directly via Supabase Studio SQL.

| Month | Name | Dates | Scoring modes |
|-------|------|-------|---------------|
| Júní | Sumarbyrjunin ☀️ | Jun 1–30 | workouts, days_active, steps |
| Júlí | Sumarchallenge 🌞 | Jul 1–31 | workouts, steps, distance_km |
| Ágúst | Ágústbrennan 💪 | Aug 1–31 | workouts, steps |
| September | Haustræfing 🍂 | Sep 1–30 | workouts, distance_km |
| Október | Vinterundirbúningur 🥶 | Oct 1–31 | workouts, steps, days_active |
| Nóvember | Novemberkrafturinn 🏃 | Nov 1–30 | workouts, days_active |
| Desember | Jólachallenge 🎄 | Dec 1–31 | workouts, steps, days_active |

Points: 2 per workout, 1 per 1000 steps, 1 per km, 2 per 30 min (matching existing Mánaðar template).

### 3.2 Holiday challenges (`renewal_type = 'none'`, `is_global = true`)

| Name | Dates | Notes |
|------|-------|-------|
| Jónsmessuchallenge 🌕 | Jun 24 (1 day) | Steps focus |
| Þjóðhátíðarchallenge 🎉 | Aug 1–5 (5 days) | Vestmannaeyjar, workouts |
| Halloween 🎃 | Oct 31 (1 day) | Steps focus |
| Jólahreyfing ⛄ | Dec 23–26 (4 days) | Workouts + days_active |
| Áramótachallenge 🎆 | Dec 30–Jan 2 (4 days) | Steps + workouts |

### 3.3 Daily missions

Generated dynamically by `rotate-daily-mission` edge function every **Monday, Wednesday, Friday** starting June 9, 2026. Template rotates by `week_of_year mod 7`. Approximately 87 missions for the rest of 2026.

---

## 4. UI Changes

### 4.1 Discover screen (`DiscoverChallengesScreen.tsx`)

Current sections:
- Global challenges (is_global=true)
- User-created public challenges (is_public=true, is_global=false)

New sections:
1. **"Dagsverkefni"** — today's daily mission (renewal_type='daily', status='active', is_global=true)
2. **"Þessi vika"** — active weekly challenge
3. **"Þessi mánuður"** — active monthly challenges (named + auto-renewing)
4. **"Helgadagar & Sérstakir"** — holiday challenges (upcoming or active, renewal_type='none', is_global=true, not weekly/monthly)
5. Remove the user-created public challenges section entirely

### 4.2 Challenge creation UI

Remove the `is_public` toggle from the create-challenge flow. All user-created challenges are private by default. No UI text about "public challenges".

---

## 5. Implementation Steps

1. **Migration** — add `daily` to renewal_type enum, create `daily_mission_templates` table with seed data, update RLS insert policy
2. **Edge function** — create `supabase/functions/rotate-daily-mission/index.ts`
3. **GitHub Actions** — create `.github/workflows/challenge-cron.yml`
4. **Monthly + holiday SQL seed** — migration that inserts Jul–Dec monthly challenges and all 5 holiday challenges
5. **UI** — update `DiscoverChallengesScreen.tsx` with new 4-section layout, remove public challenge creation toggle
6. **Deploy** — `supabase db push`, `supabase functions deploy rotate-daily-mission`, add GitHub secrets
