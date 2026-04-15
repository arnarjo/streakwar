import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserAchievement } from '../types/database';

export function useAchievements(userId: string) {
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);

  const fetch = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });
    setAchievements((data ?? []) as UserAchievement[]);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { achievements, refresh: fetch };
}
