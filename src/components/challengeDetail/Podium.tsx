import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { ChallengeParticipant } from '../../types/database';
import { C } from '../../theme';

function initialsOf(p: ChallengeParticipant): string {
  return (p.profile?.full_name ?? p.profile?.username ?? '?')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Top-3 podium for a challenge leaderboard. `podium[0]` is 1st place. */
export default function Podium({ podium }: { podium: ChallengeParticipant[] }) {
  if (podium.length === 0) return null;

  // Visual order: 2nd, 1st, 3rd
  return (
    <View style={s.podium}>
      {[podium[1], podium[0], podium[2]].map((p, visualIdx) => {
        if (!p) return <View key={visualIdx} style={{ flex: 1 }} />;
        const rank = visualIdx === 1 ? 1 : visualIdx === 0 ? 2 : 3;
        const heights = [70, 90, 60];
        const colors = ['#C0C0C0', '#FFD700', '#CD7F32'];
        const initials = initialsOf(p);
        return (
          <View key={p.id} style={[s.podiumSlot, { flex: 1 }]}>
            <Text style={s.podiumScore}>{p.score}</Text>
            <View style={[s.podiumAvatar, { borderColor: colors[rank - 1] }]}>
              {p.profile?.avatar_url
                ? <Image source={{ uri: p.profile.avatar_url }} style={s.podiumAvatarImg} />
                : <Text style={[s.podiumAvatarText, { color: colors[rank - 1] }]}>{initials}</Text>
              }
            </View>
            <View style={[s.podiumBar, { height: heights[rank - 1], backgroundColor: colors[rank - 1] + '30', borderColor: colors[rank - 1] + '60' }]}>
              <Text style={[s.podiumRankNum, { color: colors[rank - 1] }]}>#{rank}</Text>
            </View>
            <Text style={s.podiumName} numberOfLines={1}>{p.profile?.username}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
    gap: 4,
  },
  podiumSlot: { alignItems: 'center', gap: 4 },
  podiumScore: { fontSize: 11, color: C.muted, fontWeight: '600' },
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  podiumAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  podiumAvatarText: { fontSize: 16, fontWeight: '800' },
  podiumBar: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  podiumRankNum: { fontSize: 16, fontWeight: '900', paddingVertical: 4 },
  podiumName: { fontSize: 11, color: C.muted, fontWeight: '600', textAlign: 'center' },
});
