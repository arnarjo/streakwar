-- Server-side streak decay so streaks reset even when users never open the app.
-- Also activates the monthly freeze credit grant for Pro users (was commented out in 013).

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── Daily streak decay at 02:00 UTC (midnight Iceland time) ──────────────────

SELECT cron.unschedule('daily-streak-decay')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-streak-decay');

SELECT cron.schedule(
  'daily-streak-decay',
  '0 2 * * *',
  $$
  UPDATE user_streaks
  SET current_streak = 0, updated_at = now()
  WHERE current_streak > 0
    AND last_active_date < current_date - interval '1 day'
    AND NOT EXISTS (
      SELECT 1 FROM streak_freeze_uses
      WHERE user_id = user_streaks.user_id
        AND freeze_date = current_date - interval '1 day'
    );
  $$
);

-- ── Monthly freeze credits for Pro users (1st of each month, 00:00 UTC) ──────

SELECT cron.unschedule('monthly-freeze-credits')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-freeze-credits');

SELECT cron.schedule(
  'monthly-freeze-credits',
  '0 0 1 * *',
  $$
  UPDATE profiles
  SET streak_freeze_credits = LEAST(streak_freeze_credits + 1, 3)
  WHERE is_pro = true
    AND (pro_expires_at IS NULL OR pro_expires_at > now());
  $$
);
