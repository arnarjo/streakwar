-- supabase/migrations/20260605000000_security_perf_followup.sql
-- Follow-up to 024_security_hardening.sql
-- 1. Optimise profiles UPDATE WITH CHECK: 3 subqueries → 1 EXISTS (saves 2 index lookups)
-- 2. Composite index on challenge_participants for leaderboard ORDER BY

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- Fix 1: profiles WITH CHECK — single EXISTS subquery
-- ──────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users update own profile" ON profiles;

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND EXISTS (
      SELECT 1 FROM profiles p2
      WHERE  p2.id                  = auth.uid()
        AND  p2.is_admin              = profiles.is_admin
        AND  p2.is_pro                = profiles.is_pro
        AND  p2.streak_freeze_credits = profiles.streak_freeze_credits
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- Fix 2: composite index for challenge leaderboard queries
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_score
  ON challenge_participants(challenge_id, score DESC NULLS LAST);

COMMIT;
