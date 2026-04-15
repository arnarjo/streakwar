import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { FitnessChallenge, ChallengeParticipant, ScoringMode, TieBreakRule } from '../types/database';

export function useFitnessChallenges(userId: string) {
  const [myChallenges, setMyChallenges] = useState<FitnessChallenge[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('challenge_participants')
      .select(`
        challenge_id,
        score,
        rank,
        fitness_challenges (
          *,
          creator:profiles!fitness_challenges_created_by_fkey (id, username, full_name, avatar_url)
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

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
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  async function getParticipants(challengeId: string): Promise<ChallengeParticipant[]> {
    const { data } = await supabase
      .from('challenge_participants')
      .select('*, profile:profiles(*)')
      .eq('challenge_id', challengeId)
      .order('score', { ascending: false });
    return data ?? [];
  }

  async function joinByCode(code: string): Promise<{ error: string | null; challenge: FitnessChallenge | null }> {
    const { data: challenge } = await supabase
      .from('fitness_challenges')
      .select('*')
      .eq('invite_code', code.toUpperCase())
      .single();

    if (!challenge) return { error: 'Invalid invite code', challenge: null };

    const { error } = await supabase
      .from('challenge_participants')
      .insert({ challenge_id: challenge.id, user_id: userId });

    if (error) {
      if (error.code === '23505') return { error: 'You are already in this challenge', challenge: null };
      return { error: 'Could not join challenge', challenge: null };
    }

    await fetch();
    return { error: null, challenge };
  }

  async function joinPublic(challengeId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('challenge_participants')
      .insert({ challenge_id: challengeId, user_id: userId });

    if (error) {
      if (error.code === '23505') return { error: 'You are already in this challenge' };
      return { error: 'Could not join challenge' };
    }
    await fetch();
    return { error: null };
  }

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
  }): Promise<{ error: string | null; challenge: FitnessChallenge | null }> {
    const { data: challenge, error } = await supabase
      .from('fitness_challenges')
      .insert({ ...params, created_by: userId })
      .select()
      .single();

    if (error) return { error: 'Could not create challenge', challenge: null };

    // Auto-join creator
    await supabase
      .from('challenge_participants')
      .insert({ challenge_id: challenge.id, user_id: userId });

    await fetch();
    return { error: null, challenge };
  }

  return { myChallenges, loading, refresh: fetch, getParticipants, joinByCode, joinPublic, createChallenge };
}
