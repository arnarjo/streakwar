import { supabase } from './supabase';

/** Returns the challenge_id of the user's first active challenge, or null. */
export async function getActiveChallengeId(userId: string): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('challenge_participants')
    .select('challenge_id, fitness_challenges!inner(status)')
    .eq('user_id', userId)
    .eq('fitness_challenges.status', 'active')
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.warn('[db] getActiveChallengeId failed:', error.message);
  }

  // PostgREST join returns nested object — extract the scalar field
  return (data as { challenge_id: string } | null)?.challenge_id ?? null;
}
