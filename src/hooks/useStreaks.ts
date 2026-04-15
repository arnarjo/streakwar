import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserStreak } from '../types/database';

export function useStreaks(userId: string) {
  const [streak, setStreak] = useState<UserStreak | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => setStreak(data));
  }, [userId]);

  return { streak };
}
