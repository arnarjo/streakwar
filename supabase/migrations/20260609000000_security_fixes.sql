-- Security fixes: two vulnerabilities flagged in audit
--
-- Fix 1 (HIGH): workout_posts INSERT — add challenge membership check
--   Any authenticated user could post to any challenge_id they knew,
--   allowing them to manipulate another challenge's leaderboard score.
--
-- Fix 2 (MEDIUM): push_token exposure
--   profiles.push_token was readable by all authenticated users via the
--   open SELECT policy. Moved to user_device_tokens with strict own-row RLS.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 1: workout_posts INSERT — require challenge membership
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Old policy only checked auth.uid() = user_id, letting any user insert a row
-- with any challenge_id — even challenges they are not enrolled in — which
-- would increment that challenge's leaderboard score for them.
--
-- New policy keeps the uid guard and adds: if challenge_id is provided, the
-- caller must appear in challenge_participants for that challenge.
--
-- The fan_out_workout_to_challenges trigger is SECURITY DEFINER, so it runs
-- as postgres and bypasses RLS — the fan-out path is unaffected.

DROP POLICY IF EXISTS "Users create posts" ON workout_posts;

CREATE POLICY "Users create posts" ON workout_posts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      challenge_id IS NULL
      OR EXISTS (
        SELECT 1 FROM challenge_participants cp
        WHERE cp.challenge_id = workout_posts.challenge_id
          AND cp.user_id = auth.uid()
      )
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 2: push_token — move to dedicated table with own-row RLS
-- ══════════════════════════════════════════════════════════════════════════════
--
-- profiles has an open SELECT USING (true) policy, which let any authenticated
-- user read every push_token.  With those tokens, a bad actor could send
-- unsolicited Expo push notifications to any user.
--
-- Solution: new user_device_tokens table.
--   - User may SELECT/INSERT/UPDATE only their own row (RLS: uid = user_id).
--   - service_role bypasses RLS and can read all tokens (edge functions).
--   - Existing tokens are migrated from profiles.push_token.
--   - profiles.push_token is left in place for now but app code stops writing
--     to it; the column will be dropped in a future cleanup migration.

CREATE TABLE IF NOT EXISTS user_device_tokens (
  user_id    uuid        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  push_token text        NOT NULL,
  platform   text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;

-- Own row only for authenticated clients; service_role bypasses RLS.
CREATE POLICY "Own device token" ON user_device_tokens
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for service-role bulk reads (edge functions)
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id
  ON user_device_tokens(user_id);

-- Migrate existing tokens
INSERT INTO user_device_tokens (user_id, push_token, updated_at)
SELECT id, push_token, now()
FROM   profiles
WHERE  push_token IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
  SET push_token = EXCLUDED.push_token,
      updated_at = now();

COMMIT;
