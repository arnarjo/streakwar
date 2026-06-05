import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { LeagueTier, LeagueMember } from '../types/database';

export function currentMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff)
    .toISOString().slice(0, 10);
}

export function useLeague(userId: string) {
  const [members, setMembers]   = useState<LeagueMember[]>([]);
  const [myTier, setMyTier]     = useState<LeagueTier>('bronze');
  const [myRank, setMyRank]     = useState<number | null>(null);
  const [groupId, setGroupId]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const weekStart = currentMonday();

    const [{ data: tierRow }, { data: membership }] = await Promise.all([
      supabase
        .from('user_league_tier')
        .select('tier')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('league_memberships')
        .select('group_id')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle(),
    ]);

    if (tierRow) {
      setMyTier(tierRow.tier as LeagueTier);
    } else {
      // No league tier yet — use default; row creation happens server-side on signup
      setMyTier('bronze');
    }

    if (!membership) {
      setLoading(false);
      return;
    }

    setGroupId(membership.group_id);

    const { data: rows } = await supabase
      .rpc('get_league_group_leaderboard', {
        p_group_id: membership.group_id,
        p_week_start: weekStart,
      });

    if (rows) {
      setMembers(rows as LeagueMember[]);
      const idx = (rows as LeagueMember[]).findIndex(m => m.user_id === userId);
      setMyRank(idx >= 0 ? idx + 1 : null);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { members, myTier, myRank, groupId, loading, refresh: fetch };
}
