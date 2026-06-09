import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { UserAchievement } from '../types/database';

export function useAchievements(userId: string) {
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetch = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });
    if (!mountedRef.current) return;
    setAchievements((data ?? []) as UserAchievement[]);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { achievements, refresh: fetch };
}
