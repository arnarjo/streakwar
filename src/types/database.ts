// src/types/database.ts

export type ActivityType =
  | 'run'
  | 'walk'
  | 'cycle'
  | 'swim'
  | 'lift'
  | 'yoga'
  | 'hiit'
  | 'sport'
  | 'other'
  | 'ganga'; // step-based walking from Health Connect / HealthKit

export type ScoringMode =
  | 'workouts'
  | 'days_active'
  | 'steps'
  | 'distance_km'
  | 'duration_min'
  | 'calories'
  | 'custom';

export type TieBreakRule =
  | 'first_to_score'
  | 'most_recent_activity'
  | 'most_workouts';

export type WorkoutSource =
  | 'manual'
  | 'apple_health'
  | 'health_connect'
  | 'strava'
  | 'garmin'
  | 'fitbit'
  | 'samsung_health';

export type ChallengeStatus = 'upcoming' | 'active' | 'completed';

export type NotificationType =
  | 'workout_reaction'
  | 'workout_comment'
  | 'rank_change'
  | 'challenge_starting'
  | 'challenge_ending'
  | 'challenge_completed'
  | 'friend_request'
  | 'friend_accepted'
  | 'workout_synced'
  | 'streak_milestone';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean;
  push_token?: string | null;
  total_points: number;
  created_at: string;
}

export interface Friendship {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  full_name: string | null;
  total_points: number;
  weekly_points?: number;
}

export type AchievementKey =
  | 'first_workout'
  | 'workouts_10' | 'workouts_50' | 'workouts_100'
  | 'pts_100' | 'pts_500' | 'pts_1000' | 'pts_5000'
  | 'streak_3' | 'streak_7' | 'streak_14' | 'streak_30' | 'streak_100'
  | 'steps_100k';

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement: AchievementKey;
  earned_at: string;
}

export const ACHIEVEMENT_META: Record<AchievementKey, { icon: string; title: string; desc: string }> = {
  first_workout: { icon: '🎉', title: 'First Step',       desc: 'Logged your first workout'        },
  workouts_10:   { icon: '💪', title: 'Getting Going',    desc: '10 workouts logged'               },
  workouts_50:   { icon: '🏃', title: 'Half Century',     desc: '50 workouts logged'               },
  workouts_100:  { icon: '🔱', title: 'Century Club',     desc: '100 workouts logged'              },
  pts_100:       { icon: '⭐', title: 'Point Scorer',     desc: 'Earned 100 total points'          },
  pts_500:       { icon: '🌟', title: 'Rising Star',      desc: 'Earned 500 total points'          },
  pts_1000:      { icon: '💫', title: 'Point Machine',    desc: 'Earned 1 000 total points'        },
  pts_5000:      { icon: '🚀', title: 'Unstoppable',      desc: 'Earned 5 000 total points'        },
  streak_3:      { icon: '🔥', title: 'On Fire',          desc: '3-day streak'                     },
  streak_7:      { icon: '🔥', title: 'Week Warrior',     desc: '7-day streak'                     },
  streak_14:     { icon: '⚡', title: 'Two Weeks Strong', desc: '14-day streak'                    },
  streak_30:     { icon: '💎', title: 'Diamond Streak',   desc: '30-day streak'                    },
  streak_100:    { icon: '👑', title: 'Legendary',        desc: '100-day streak'                   },
  steps_100k:    { icon: '👟', title: 'Step Legend',      desc: '100 000 total steps logged'       },
};

export type RenewalType = 'none' | 'weekly' | 'monthly';

export interface FitnessChallenge {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_by: string | null;
  start_date: string;
  end_date: string;
  status: ChallengeStatus;
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
  invite_code: string;
  renewal_type: RenewalType;
  is_global: boolean;
  parent_challenge_id: string | null;
  created_at: string;
  participant_count?: number;
  my_score?: number;
  my_rank?: number;
  creator?: Profile;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  team_id: string | null;
  score: number;
  rank: number | null;
  joined_at: string;
  profile?: Profile;
}

export interface ChallengeTeam {
  id: string;
  challenge_id: string;
  name: string;
  score: number;
}

export interface WorkoutPost {
  id: string;
  user_id: string;
  challenge_id: string | null;
  activity_type: ActivityType;
  duration_minutes: number | null;
  distance_km: number | null;
  calories: number | null;
  steps: number | null;
  source: WorkoutSource;
  external_activity_id: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: 'photo' | 'video' | null;
  points_awarded: number;
  workout_date: string;
  posted_at: string;
  profile?: Profile;
  reactions?: WorkoutReaction[];
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  comment_count?: number;
  challenge?: Pick<FitnessChallenge, 'id' | 'name'>;
}

export interface WorkoutReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
  profile?: Profile;
}

export interface WorkoutComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface UserStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

// ── UI helpers ─────────────────────────────────────────────

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run:   '🏃 Run',
  walk:  '🚶 Walk',
  cycle: '🚴 Cycle',
  swim:  '🏊 Swim',
  lift:  '🏋️ Lift',
  yoga:  '🧘 Yoga',
  hiit:  '🔥 HIIT',
  sport: '⚽ Sport',
  other: '💪 Other',
  ganga: '👟 Steps',
};

export const ACTIVITY_OPTIONS: ActivityType[] = [
  'run', 'walk', 'cycle', 'swim', 'lift', 'yoga', 'hiit', 'sport', 'other',
];

export const SCORING_MODE_LABELS: Record<ScoringMode, string> = {
  workouts:    '💪 Workouts',
  days_active: '📅 Days Active',
  steps:       '👟 Steps',
  distance_km: '📍 Distance (km)',
  duration_min:'⏱ Duration (min)',
  calories:    '🔥 Calories',
  custom:      '⭐ Custom points',
};

export const TIE_BREAK_LABELS: Record<TieBreakRule, string> = {
  first_to_score:        'First to reach the score',
  most_recent_activity:  'Most recent activity',
  most_workouts:         'Most workout sessions',
};

export const SOURCE_LABELS: Record<WorkoutSource, string> = {
  manual:         'Manual',
  apple_health:   'Apple Health',
  health_connect: 'Health Connect',
  strava:         'Strava',
  garmin:         'Garmin',
  fitbit:         'Fitbit',
  samsung_health: 'Samsung Health',
};

export const REACTIONS = ['🔥', '💪', '👏', '😂'] as const;
export type Reaction = typeof REACTIONS[number];

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
