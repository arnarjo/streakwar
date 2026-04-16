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

      const ids = challenges.map((c: any) => c.id);
      if (ids.length > 0) {
        const { data: rows } = await supabase
          .from('challenge_participants')
          .select('challenge_id')
          .in('challenge_id', ids);
        const countMap: Record<string, number> = {};
        for (const row of rows ?? []) {
          countMap[row.challenge_id] = (countMap[row.challenge_id] ?? 0) + 1;
        }
        setMyChallenges(challenges.map((c: any) => ({ ...c, participant_count: countMap[c.id] ?? 0 })));
      } else {
        setMyChallenges(challenges);
      }
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

    // Check if challenge is full
    if (challenge.max_participants) {
      const { count } = await supabase
        .from('challenge_participants')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challenge.id);
      if ((count ?? 0) >= challenge.max_participants) {
        return { error: 'Challenge is full', challenge: null };
      }
    }

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
    // Check fullness
    const { data: challenge } = await supabase
      .from('fitness_challenges')
      .select('max_participants')
      .eq('id', challengeId)
      .single();

    if (challenge?.max_participants) {
      const { count } = await supabase
        .from('challenge_participants')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challengeId);
      if ((count ?? 0) >= challenge.max_participants) {
        return { error: 'Challenge is full' };
      }
    }

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
    max_participants?: number | null;
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
