# StreakWar Viral Features — Design Spec
Date: 2026-04-15
Focus: Android first

## Goal
Make StreakWar a viral fitness competition app that connects people in a healthy lifestyle. Auto-sync from all major devices so users never need to manually log. League competition and social mechanics create daily habit loops and word-of-mouth growth.

---

## Feature 1: League System

### How it works
- 5 tiers: 🥉 Bronze → 🥈 Silver → 🥇 Gold → 💎 Platinum → 👑 Diamond
- Each week (Monday–Sunday) users are grouped into leagues of ~20 users at similar skill level
- End of week: top 5 promoted ⬆️, bottom 5 relegated ⬇️
- New users always start in Bronze

### What users see
- League tab on Leaderboard screen — shows 20 competitors, own rank, points needed for promotion zone
- Home screen banner: "3 days left in your league — you're #6, need 50 pts to promote"
- Friday evening push notification: "Your league ends tomorrow!"
- Monday morning push notification: "You were promoted to Gold! 🎉" or "Keep pushing — you stay in Bronze this week"

### Database
- `user_leagues` table: user_id, tier (bronze/silver/gold/platinum/diamond), week_start
- `league_groups` table: group_id, week_start, tier
- `league_memberships` table: user_id, group_id, week_start, final_rank, promoted, relegated
- Supabase Edge Function (cron, Monday 00:01): calculate final ranks, award promotion/relegation, create new groups for the week

### Promotion logic
```
- Group users by tier each Monday
- Bucket into groups of ~20 (random within tier)
- New users → Bronze group
- End of week: rank by weekly_points
  - Rank 1-5: promoted to next tier
  - Rank 16-20: relegated to previous tier
  - Rank 6-15: stay
- Diamond: no promotion, bottom 5 relegated only
- Bronze: no relegation, top 5 promoted only
```

---

## Feature 2: Reactions + Trash Talk

### Reactions on workouts
- 4 reaction types: 🔥 💪 👏 😂
- Tap to react on any workout post in the feed
- Push notification to post owner: "Jón reacted to your workout 🔥"
- Builds on existing `toggleReaction` in `useWorkoutFeed`
- Update DB to support multiple reaction types (currently single reaction)

### Trash Talk in challenges
- Pre-written messages only — no open-ended chat
- Available in Challenge Detail screen
- 6 messages:
  - "See you at the top 🔥"
  - "Just giving up already?"
  - "I'm just warming up 💪"
  - "May the best win 😤"
  - "You're falling behind 📉"
  - "GG, better athlete won 🏆"
- Shown as a message stream in challenge (sender name + message)
- Push notification when you receive trash talk

### Database
- `challenge_messages` table: id, challenge_id, sender_id, message_key, created_at
- RLS: readable by challenge participants only

---

## Feature 3: Weekly Recap

### Trigger
- Supabase Edge Function cron: every Monday 08:00 local time
- Sends push notification: "Your week in fitness is ready 📊"
- Deep link opens Recap screen in app

### Content
- Workouts this week (count)
- Total steps
- Current streak 🔥
- League rank: "#3 in your Gold league"
- Points earned this week
- Week-over-week comparison: "↑ 2 more workouts than last week"

### Shareable card
- "Share your week 📤" button
- Native Share sheet with pre-formatted text
- Card color matches league tier (bronze/silver/gold/platinum/diamond)
- Main viral mechanic — shared to Instagram stories, WhatsApp groups

### Implementation
- No extra DB table needed — all data computed at render time
- Recap screen reads from existing `workout_posts`, `user_streaks`, `user_leagues`
- Edge Function only needs to send push notification with user_id as deep link param

---

## Feature 4: Device Integrations

### Priority order (Android first)
1. **Health Connect** (already built, fixing permissions flow) — covers Garmin via bridge
2. **Strava OAuth** (Edge Functions already coded, needs deploy + secrets) — covers Garmin/Polar/Wahoo/Suunto users
3. **Fitbit OAuth** (2-3 days to build) — large market
4. **Garmin direct** (apply for API access now, build later)

### Onboarding connect screen
- Shown after signup/login if no devices connected
- Shows icons: Health Connect, Strava, Fitbit
- One tap per source → OAuth flow or permission request
- Skip option available

### Strava deployment steps
- `npx supabase functions deploy oauth-init`
- `npx supabase functions deploy oauth-callback`
- Add secrets: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
- Test full OAuth flow

---

## Build Order (Android first)

1. League system DB migrations + Edge Function
2. League UI (Leaderboard tab + Home banner + notifications)
3. Reactions (multi-type) + Trash talk DB + UI
4. Weekly Recap screen + Edge Function cron
5. Deploy Strava OAuth
6. Build Fitbit OAuth
7. Onboarding connect screen

---

## Out of scope (this phase)
- Group chat
- GPS route tracking
- Detailed gym logging (sets/reps)
- Garmin direct API (apply in parallel)
- iOS build
