import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { C } from '../theme';

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
  onReact?: (emoji: string) => Promise<void>;
}

export default function StreakMilestoneCard({ item, onReact }: Props) {
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(item.reaction_counts ?? {});
  const [myReaction, setMyReaction] = useState<string | null>(item.my_reaction ?? null);
  const [reacting, setReacting] = useState(false);

  const reactionScales = useRef(new Map<string, Animated.Value>()).current;
  function getReactionScale(key: string) {
    if (!reactionScales.has(key)) reactionScales.set(key, new Animated.Value(1));
    return reactionScales.get(key)!;
  }
  function animateReaction(key: string) {
    const scale = getReactionScale(key);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.4, useNativeDriver: true, tension: 200, friction: 6 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 6 }),
    ]).start();
  }

  const name = item.profile?.full_name ?? item.profile?.username ?? 'Someone';
  const achievedAt = item.achieved_at ? new Date(item.achieved_at) : null;
  const timeAgo = achievedAt && !isNaN(achievedAt.getTime())
    ? formatDistanceToNow(achievedAt, { addSuffix: true })
    : '';

  async function handleReact(emoji: string) {
    if (reacting || !onReact) return;
    setReacting(true);
    const prev = myReaction;
    const counts = { ...reactionCounts };

    // Optimistic update
    if (prev) counts[prev] = Math.max(0, (counts[prev] ?? 0) - 1);
    if (prev === emoji) {
      setMyReaction(null);
      setReactionCounts(counts);
    } else {
      counts[emoji] = (counts[emoji] ?? 0) + 1;
      setMyReaction(emoji);
      setReactionCounts(counts);
    }

    try {
      await onReact(emoji);
    } catch {
      // Roll back optimistic update
      setMyReaction(prev);
      setReactionCounts({ ...reactionCounts });
      Alert.alert('Error', 'Could not save your reaction. Please try again.');
    } finally {
      setReacting(false);
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
              onPress={() => { animateReaction(emoji); handleReact(emoji); }}
              activeOpacity={0.7}
              disabled={reacting}
              accessibilityRole="button"
              accessibilityLabel={`React with ${emoji}`}
            >
              <Animated.View style={{ transform: [{ scale: getReactionScale(emoji) }] }}>
                <Text style={s.reactEmoji}>{emoji}</Text>
                {count > 0 && <Text style={[s.reactCount, active && { color: C.primary }]}>{count}</Text>}
              </Animated.View>
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
  count: { fontSize: 22, fontWeight: '800', color: C.warning },
  time: { fontSize: 11, color: C.muted, marginTop: 3 },
  reactRow: { flexDirection: 'row', gap: 6 },
  reactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    minHeight: 44,
  },
  reactBtnActive: { backgroundColor: C.primary + '15', borderColor: C.primary + '40' },
  reactEmoji: { fontSize: 15 },
  reactCount: { fontSize: 12, fontWeight: '700', color: C.muted },
});
