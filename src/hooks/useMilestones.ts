import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MilestoneItem } from '../components/StreakMilestoneCard';

export function useMilestones(userId: string) {
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  const fetchMilestones = useCallback(async () => {
    if (!userId) return;
    setLoadingMilestones(true);
    try {
      const { data: parts } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', userId);
      if (!parts || parts.length === 0) return;

      const { data: peers } = await supabase
        .from('challenge_participants')
        .select('user_id')
        .in('challenge_id', parts.map(p => p.challenge_id))
        .neq('user_id', userId);

      if (!peers || peers.length === 0) return;
      const peerIds = [...new Set(peers.map(p => p.user_id))];

      const { data } = await supabase
        .from('streak_milestones')
        .select('*, profile:profiles(id, username, full_name)')
        .in('user_id', peerIds)
        .gte('achieved_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .order('achieved_at', { ascending: false })
        .limit(5);

      if (!data) return;

      const milestoneIds = data.map((m: any) => m.id);
      const { data: allReactions } = await supabase
        .from('milestone_reactions')
        .select('milestone_id, reaction, user_id')
        .in('milestone_id', milestoneIds);

      const reactionsByMilestone = new Map<string, { counts: Record<string, number>; myReaction: string | null }>();
      for (const r of allReactions ?? []) {
        if (!reactionsByMilestone.has(r.milestone_id)) {
          reactionsByMilestone.set(r.milestone_id, { counts: {}, myReaction: null });
        }
        const entry = reactionsByMilestone.get(r.milestone_id)!;
        entry.counts[r.reaction] = (entry.counts[r.reaction] ?? 0) + 1;
        if (r.user_id === userId) entry.myReaction = r.reaction;
      }

      setMilestones(data.map((m: any) => {
        const r = reactionsByMilestone.get(m.id);
        return { ...m, reaction_counts: r?.counts ?? {}, my_reaction: r?.myReaction ?? null };
      }));
    } finally {
      setLoadingMilestones(false);
    }
  }, [userId]);

  const reactToMilestone = useCallback(async (milestoneId: string, emoji: string) => {
    try {
      await supabase.from('milestone_reactions')
        .upsert(
          { milestone_id: milestoneId, user_id: userId, reaction: emoji },
          { onConflict: 'milestone_id,user_id' },
        );
    } catch (err) {
      console.warn('[useMilestones] react failed:', err);
    }
  }, [userId]);

  const removeReaction = useCallback(async (milestoneId: string, _emoji: string) => {
    try {
      await supabase.from('milestone_reactions')
        .delete()
        .eq('milestone_id', milestoneId)
        .eq('user_id', userId);
    } catch (err) {
      console.warn('[useMilestones] remove react failed:', err);
    }
  }, [userId]);

  return { milestones, loadingMilestones, fetchMilestones, reactToMilestone, removeReaction };
}
