import { supabase } from './supabase';

/** Fail closed at async boundaries. Server-side ownership checks remain required. */
export async function assertHealthSyncUser(userId: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (!userId || error || data.session?.user.id !== userId) {
    throw new Error('Health sync account changed or signed out. Please retry.');
  }
}
