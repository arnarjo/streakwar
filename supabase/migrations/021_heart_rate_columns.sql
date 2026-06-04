-- supabase/migrations/021_heart_rate_columns.sql
ALTER TABLE workout_posts
  ADD COLUMN IF NOT EXISTS heart_rate_avg INTEGER,
  ADD COLUMN IF NOT EXISTS heart_rate_max INTEGER;

COMMENT ON COLUMN workout_posts.heart_rate_avg IS 'Average heart rate BPM during workout (from Health Connect/HealthKit)';
COMMENT ON COLUMN workout_posts.heart_rate_max IS 'Maximum heart rate BPM during workout';
