import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ChallengeParticipant } from '../../types/database';
import { C } from '../../theme';

interface Props {
  item: ChallengeParticipant;
  rank: number;
  isMe: boolean;
}

/** A single below-the-podium leaderboard row (rank 4+). */
export default function LeaderboardRow({ item, rank, isMe }: Props) {
  const initials = (item.profile?.full_name ?? item.profile?.username ?? '?')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={[s.rankRow, isMe && s.rankRowMe]}>
      <Text style={s.rankNum}>#{rank}</Text>
      <View style={[s.rankAvatar, isMe && { borderColor: C.primary }]}>
        <Text style={[s.rankAvatarText, isMe && { color: C.primary }]}>{initials}</Text>
      </View>
      <Text style={[s.rankName, isMe && { color: C.primary }]} numberOfLines={1}>
        {item.profile?.username}
        {isMe ? ' (you)' : ''}
      </Text>
      <Text style={s.rankScore}>{item.score} pts</Text>
    </View>
  );
}

const s = StyleSheet.create({
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  rankRowMe: { borderColor: C.primary + '40', backgroundColor: C.primary + '08' },
  rankNum: { fontSize: 14, fontWeight: '700', color: C.muted, width: 28 },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  rankAvatarText: { fontSize: 13, fontWeight: '700', color: C.muted },
  rankName: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  rankScore: { fontSize: 14, fontWeight: '800', color: C.text },
});
