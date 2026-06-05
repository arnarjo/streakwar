import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import type { LeagueMember, LeagueTier } from '../types/database';
import { LEAGUE_TIER_META } from '../types/database';
import { getInitials } from '../lib/utils';
import { C } from '../theme';

function medalOrRank(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function rankColor(rank: number) {
  if (rank === 1) return C.gold;
  if (rank === 2) return C.silver;
  if (rank === 3) return C.bronze;
  return C.muted;
}

interface Props {
  leagueMembers: LeagueMember[];
  myTier: LeagueTier;
  loading: boolean;
  onRefresh: () => void;
  userId: string;
  nudgedToday: Set<string>;
  onNudge: (id: string, name: string) => void;
  daysLeft: number;
}

export function LeagueTab({ leagueMembers, myTier, loading, onRefresh, userId, nudgedToday, onNudge, daysLeft }: Props) {
  const tierMeta = LEAGUE_TIER_META[myTier];

  return (
    <FlatList
      data={leagueMembers}
      keyExtractor={m => m.user_id}
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.primary} />}
      ListHeaderComponent={
        <View style={{ paddingBottom: 8 }}>
          <Text style={[s.leagueTitle, { color: tierMeta?.color ?? '#B45309' }]}>
            {tierMeta?.emoji} {tierMeta?.label} League
          </Text>
          <Text style={s.leagueSubtitle}>
            Top 5 promote · Bottom 5 relegate · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
          </Text>
          {leagueMembers.length === 0 && !loading && (
            <View style={s.empty}>
              <Text style={s.emptyText}>
                Your league group is being set up — check back Monday!
              </Text>
            </View>
          )}
        </View>
      }
      renderItem={({ item, index }) => {
        const rank = index + 1;
        const isMe = item.user_id === userId;
        const isPromotion = rank <= 5 && leagueMembers.length >= 10;
        const isRelegation = rank > leagueMembers.length - 5 && leagueMembers.length >= 10;
        const name = item.full_name ?? item.username;
        const avatarInitials = getInitials(name);
        return (
          <View style={[
            s.row,
            isMe && s.rowMe,
            isPromotion && s.rowPromotion,
            isRelegation && s.rowRelegation,
            rank === 1 && s.rowGold,
            rank === 2 && s.rowSilver,
            rank === 3 && s.rowBronze,
          ]}>
            <Text style={[s.rankText, { color: rankColor(rank) }]}>{medalOrRank(rank)}</Text>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{avatarInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.memberName} numberOfLines={1}>{name}{isMe ? ' (you)' : ''}</Text>
              {isPromotion && <Text style={s.promotionLabel}>⬆️ Promotion zone</Text>}
              {isRelegation && <Text style={s.relegationLabel}>⬇️ Relegation zone</Text>}
            </View>
            <Text style={s.pts}>{item.weekly_points} pts</Text>
            {!isMe && (
              <TouchableOpacity
                style={[s.nudgeBtn, nudgedToday.has(item.user_id) && s.nudgeBtnDone]}
                onPress={() => onNudge(item.user_id, item.full_name ?? item.username)}
              >
                <Text style={s.nudgeBtnText}>{nudgedToday.has(item.user_id) ? '✓' : '💪'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  list:           { paddingHorizontal: 16, paddingBottom: 100 },
  leagueTitle:    { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  leagueSubtitle: { fontSize: 12, color: C.muted, marginBottom: 12 },
  empty:          { paddingVertical: 24, alignItems: 'center' },
  emptyText:      { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  row:            { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 6, gap: 10 },
  rowMe:          { borderColor: C.primary + '60', backgroundColor: C.primary + '10' },
  rowPromotion:   { borderLeftWidth: 3, borderLeftColor: '#22C55E' },
  rowRelegation:  { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  rowGold:        { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  rowSilver:      { borderLeftWidth: 3, borderLeftColor: '#9CA3AF' },
  rowBronze:      { borderLeftWidth: 3, borderLeftColor: '#B45309' },
  rankText:       { fontSize: 14, fontWeight: '800', width: 32, textAlign: 'center' },
  avatar:         { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 13, fontWeight: '800', color: C.primary },
  memberName:     { fontSize: 14, fontWeight: '700', color: C.text },
  promotionLabel: { fontSize: 10, color: '#22C55E', fontWeight: '700', marginTop: 2 },
  relegationLabel:{ fontSize: 10, color: '#EF4444', fontWeight: '700', marginTop: 2 },
  pts:            { fontSize: 15, fontWeight: '900', color: C.primary },
  nudgeBtn:       { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: C.primary + '60', alignItems: 'center', justifyContent: 'center' },
  nudgeBtnDone:   { backgroundColor: C.primary + '20', borderColor: C.primary },
  nudgeBtnText:   { fontSize: 14, lineHeight: 16 },
});
