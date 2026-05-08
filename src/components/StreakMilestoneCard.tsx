import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#0C1117', card: '#1A1208', border: '#F97316',
  text: '#EEF4F8', muted: '#4A6070', primary: '#F97316',
};

const REACTIONS = ['🔥', '💪', '⚡', '👏', '🏆'];

function milestoneEmoji(count: number) {
  if (count >= 365) return '👑';
  if (count >= 100) return '💎';
  if (count >= 50)  return '⚡';
  if (count >= 30)  return '🔥';
  if (count >= 14)  return '💪';
  return '🎉';
}

export interface MilestoneItem {
  id: string;
  user_id: string;
  streak_count: number;
  achieved_at: string;
  profile?: { id: string; username: string; full_name: string | null };
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
}

interface Props {
  item: MilestoneItem;
  currentUserId: string;
}

export default function StreakMilestoneCard({ item, currentUserId }: Props) {
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(item.reaction_counts ?? {});
  const [myReaction, setMyReaction] = useState<string | null>(item.my_reaction ?? null);

  const name = item.profile?.full_name ?? item.profile?.username ?? 'Someone';
  const timeAgo = formatDistanceToNow(new Date(item.achieved_at), { addSuffix: true });

  async function handleReact(emoji: string) {
    const prev = myReaction;
    const counts = { ...reactionCounts };

    if (prev) counts[prev] = Math.max(0, (counts[prev] ?? 1) - 1);

    if (prev === emoji) {
      setMyReaction(null);
      setReactionCounts(counts);
      await supabase.from('milestone_reactions')
        .delete()
        .eq('milestone_id', item.id)
        .eq('user_id', currentUserId);
    } else {
      counts[emoji] = (counts[emoji] ?? 0) + 1;
      setMyReaction(emoji);
      setReactionCounts(counts);
      await supabase.from('milestone_reactions')
        .upsert({ milestone_id: item.id, user_id: currentUserId, reaction: emoji },
          { onConflict: 'milestone_id,user_id' });
    }
  }

  return (
    <View style={s.card}>
      <View style={s.inner}>
        <Text style={s.bigEmoji}>{milestoneEmoji(item.streak_count)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>
            <Text style={s.name}>{name}</Text>
            {' '}reached a{' '}
            <Text style={s.count}>{item.streak_count}-day streak!</Text>
          </Text>
          <Text style={s.time}>{timeAgo}</Text>
        </View>
      </View>

      <View style={s.reactRow}>
        {REACTIONS.map(emoji => {
          const count = reactionCounts[emoji] ?? 0;
          const active = myReaction === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              style={[s.reactBtn, active && s.reactBtnActive]}
              onPress={() => handleReact(emoji)}
              activeOpacity={0.7}
            >
              <Text style={s.reactEmoji}>{emoji}</Text>
              {count > 0 && <Text style={[s.reactCount, active && { color: C.primary }]}>{count}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.primary + '40',
    marginBottom: 12,
    overflow: 'hidden',
    padding: 14,
    gap: 12,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigEmoji: { fontSize: 32 },
  title: { fontSize: 14, color: C.text, lineHeight: 20, flex: 1 },
  name: { fontWeight: '800', color: C.primary },
  count: { fontWeight: '800', color: '#FBBF24' },
  time: { fontSize: 11, color: C.muted, marginTop: 3 },
  reactRow: { flexDirection: 'row', gap: 6 },
  reactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  reactBtnActive: { backgroundColor: '#F9731615', borderColor: '#F9731640' },
  reactEmoji: { fontSize: 15 },
  reactCount: { fontSize: 12, fontWeight: '700', color: '#4A6070' },
});
