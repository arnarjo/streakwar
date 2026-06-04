import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { LeaderboardEntry } from '../types/database';
import { toLocalDate } from '../lib/dateUtils';

const ALL_COLS = 'id, username, full_name, total_points';

/** ISO Monday for the current week in local time */
function currentWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDate(d);
}

export function useLeaderboard(userId: string) {
  const [globalBoard,  setGlobalBoard]  = useState<LeaderboardEntry[]>([]);
  const [weeklyBoard,  setWeeklyBoard]  = useState<LeaderboardEntry[]>([]);
  const [friendsBoard, setFriendsBoard] = useState<LeaderboardEntry[]>([]);
  const [following,    setFollowing]    = useState<Set<string>>(new Set());
  const [myGlobalRank, setMyGlobalRank] = useState<number | null>(null);
  const [myWeeklyRank, setMyWeeklyRank] = useState<number | null>(null);
  const [rival,        setRival]        = useState<LeaderboardEntry | null>(null);
  const [rivalDiff,    setRivalDiff]    = useState<number>(0);
  const [loading,      setLoading]      = useState(false);

  // ── Who the user follows ─────────────────────────────────────
  const fetchFollowing = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('friendships')
      .select('following_id')
      .eq('follower_id', userId);
    setFollowing(new Set(data?.map((f: { following_id: string }) => f.following_id) ?? []));
  }, [userId]);

  // ── All-time top-100 ─────────────────────────────────────────
  const fetchGlobal = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select(ALL_COLS)
      .order('total_points', { ascending: false })
      .limit(100);
    const board = (data ?? []) as LeaderboardEntry[];
    setGlobalBoard(board);
    const idx = board.findIndex(p => p.id === userId);
    setMyGlobalRank(idx >= 0 ? idx + 1 : null);
    setLoading(false);
  }, [userId]);

  // ── Weekly top-100 (via DB RPC) ──────────────────────────────
  const fetchWeekly = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .rpc('get_weekly_leaderboard', { week_start: currentWeekStart() });
    const board = (data ?? []) as LeaderboardEntry[];
    setWeeklyBoard(board);
    const idx = board.findIndex((p: LeaderboardEntry) => p.id === userId);
    setMyWeeklyRank(idx >= 0 ? idx + 1 : null);

    // Rival = the person ranked just above you on the weekly board
    if (idx > 0) {
      const r = board[idx - 1];
      setRival(r);
      setRivalDiff(Math.max(0, (r.weekly_points ?? 0) - (board[idx]?.weekly_points ?? 0)));
    } else {
      setRival(null);
      setRivalDiff(0);
    }
  }, [userId]);

  // ── Friends board ────────────────────────────────────────────
  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    const { data: follows } = await supabase
      .from('friendships')
      .select('following_id')
      .eq('follower_id', userId);

    const ids = [...(follows?.map((f: { following_id: string }) => f.following_id) ?? []), userId];
    const { data } = await supabase
      .from('profiles')
      .select(ALL_COLS)
      .in('id', ids)
      .order('total_points', { ascending: false });
    setFriendsBoard((data ?? []) as LeaderboardEntry[]);
  }, [userId]);

  // ── Follow / unfollow ────────────────────────────────────────
  const follow = useCallback(async (targetId: string) => {
    await supabase.from('friendships').insert({ follower_id: userId, following_id: targetId });
    setFollowing(prev => new Set([...prev, targetId]));
    fetchFriends();
  }, [userId, fetchFriends]);

  const unfollow = useCallback(async (targetId: string) => {
    await supabase.from('friendships').delete()
      .eq('follower_id', userId).eq('following_id', targetId);
    setFollowing(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    fetchFriends();
  }, [userId, fetchFriends]);

  useEffect(() => { fetchFollowing(); }, [fetchFollowing]);

  return {
    globalBoard, weeklyBoard, friendsBoard,
    following, myGlobalRank, myWeeklyRank,
    rival, rivalDiff,
    loading,
    fetchGlobal, fetchWeekly, fetchFriends,
    follow, unfollow,
  };
}
