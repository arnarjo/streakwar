import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { scheduleStreakReminder } from '../lib/streakNotification';
import { toLocalDate } from '../lib/dateUtils';
import type { UserStreak } from '../types/database';

/**
 * If last_active_date is 2+ days ago the streak would be broken.
 * First checks if a streak freeze is available and unused today.
 * If so, consumes the freeze instead of resetting the streak.
 * Otherwise, resets current_streak to 0 and persists the change.
 */
export async function applyStreakDecay(data: UserStreak): Promise<UserStreak> {
  if (!data.last_active_date || data.current_streak === 0) return data;

  const today = toLocalDate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toLocalDate(yesterdayDate);

  if (data.last_active_date >= yesterday) return data; // still active

  // Streak would decay — check for available freeze first
  const { data: freezeData } = await supabase
    .from('streak_freeze_uses')
    .select('id')
    .eq('user_id', data.user_id)
    .eq('freeze_date', today)
    .maybeSingle();

  // Already used a freeze today, can't use another
  if (freezeData) {
    // Streak is broken — reset in DB and update notification
    const { error } = await supabase
      .from('user_streaks')
      .update({ current_streak: 0, updated_at: new Date().toISOString() })
      .eq('user_id', data.user_id);

    if (error) {
      console.warn('[streak] decay DB update failed:', error.message);
    }

    scheduleStreakReminder(0).catch(() => {});

    return { ...data, current_streak: 0 };
  }

  // Check if user has freeze credits available (via RPC)
  const { data: freezeResult, error: freezeError } = await supabase.rpc('use_streak_freeze', {
    p_user_id: data.user_id,
  });

  if (freezeError || !freezeResult) {
    // No freeze available or RPC failed — reset streak
    const { error } = await supabase
      .from('user_streaks')
      .update({ current_streak: 0, updated_at: new Date().toISOString() })
      .eq('user_id', data.user_id);

    if (error) {
      console.warn('[streak] decay DB update failed:', error.message);
    }

    scheduleStreakReminder(0).catch(() => {});

    return { ...data, current_streak: 0 };
  }

  // Freeze was successfully consumed — streak preserved
  return data;
}

const MILESTONE_THRESHOLDS = [7, 14, 30, 50, 100, 365];

async function recordMilestone(userId: string, count: number) {
  await supabase
    .from('streak_milestones')
    .upsert({ user_id: userId, streak_count: count }, { onConflict: 'user_id,streak_count', ignoreDuplicates: true });
}

export function useStreaks(userId: string) {
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [freezeCredits, setFreezeCredits] = useState(0);
  const [frozenToday, setFrozenToday] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchFreezeState = useCallback(async () => {
    if (!userId) return;
    const today = toLocalDate(new Date());
    const [{ data: profile }, { data: freeze }] = await Promise.all([
      supabase.from('profiles').select('streak_freeze_credits').eq('id', userId).single(),
      supabase.from('streak_freeze_uses').select('id').eq('user_id', userId).eq('freeze_date', today).maybeSingle(),
    ]);
    setFreezeCredits(profile?.streak_freeze_credits ?? 0);
    setFrozenToday(!!freeze);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(async ({ data }) => {
        if (!active) return;
        const effective = data ? await applyStreakDecay(data) : null;
        if (active) setStreak(effective);
      });

    fetchFreezeState();

    // Unique name per subscription so Supabase always creates a fresh channel
    // instead of reusing an already-subscribed one (which would throw).
    const channelName = `user_streaks:${userId}:${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_streaks', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!active) return;
          if (payload.eventType === 'DELETE') { setStreak(null); return; }
          const next = payload.new as UserStreak;
          const prev = payload.old as Partial<UserStreak>;
          setStreak(next);
          if (next.current_streak > (prev.current_streak ?? 0)) {
            for (const t of MILESTONE_THRESHOLDS) {
              if (next.current_streak >= t && (prev.current_streak ?? 0) < t) {
                recordMilestone(userId, t).catch(console.warn);
              }
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      active = false;
      supabase.removeChannel(channel).catch(() => {});
      channelRef.current = null;
    };
  }, [userId, fetchFreezeState]);

  async function freezeStreak(): Promise<{ success: boolean; message: string }> {
    if (!userId) return { success: false, message: 'Not logged in' };
    const { data, error } = await supabase.rpc('use_streak_freeze', { p_user_id: userId });
    if (error || !data) return { success: false, message: 'Could not protect streak. Try again.' };
    await fetchFreezeState();
    const { data: updated } = await supabase.from('user_streaks').select('*').eq('user_id', userId).single();
    if (updated) setStreak(updated);
    return { success: true, message: 'Streak protected for today!' };
  }

  return { streak, freezeCredits, frozenToday, freezeStreak };
}
