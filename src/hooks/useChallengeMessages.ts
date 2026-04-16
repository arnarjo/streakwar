import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const TRASH_TALK_MESSAGES: Record<string, string> = {
  see_you_at_top:    'See you at the top 🔥',
  just_giving_up:    'Just giving up already?',
  warming_up:        "I'm just warming up 💪",
  may_best_win:      'May the best win 😤',
  falling_behind:    "You're falling behind 📉",
  gg_better_athlete: 'GG, better athlete won 🏆',
};

export interface ChallengeMessage {
  id: string;
  sender_id: string;
  message_key: string;
  created_at: string;
  sender?: { username: string; full_name: string | null };
}

export function useChallengeMessages(challengeId: string, userId: string) {
  const [messages, setMessages] = useState<ChallengeMessage[]>([]);
  const [sending, setSending] = useState(false);

  const fetch = useCallback(async () => {
    if (!challengeId) return;
    const { data } = await supabase
      .from('challenge_messages')
      .select('*, sender:profiles!challenge_messages_sender_id_fkey(username, full_name)')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setMessages(data as ChallengeMessage[]);
  }, [challengeId]);

  const sendMessage = useCallback(async (messageKey: string) => {
    if (!userId || sending) return;
    setSending(true);
    await supabase.from('challenge_messages').insert({
      challenge_id: challengeId,
      sender_id: userId,
      message_key: messageKey,
    });
    setSending(false);
    await fetch();
  }, [challengeId, userId, sending, fetch]);

  return { messages, sending, fetch, sendMessage };
}
