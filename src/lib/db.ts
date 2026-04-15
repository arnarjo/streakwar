import { supabase } from './supabase';

/** Returns the challenge_id of the user's first active challenge, or null. */
export async function getActiveChallengeId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('challenge_participants')
    .select('challenge_id, fitness_challenges!inner(status)')
    .eq('user_id', userId)
    .eq('fitness_challenges.status', 'active')
    .limit(1)
    .maybeSingle();
  return (data as any)?.challenge_id ?? null;
}
