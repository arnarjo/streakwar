import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import type { LeagueMember, LeagueTier } from '../types/database';
import { LEAGUE_TIER_META } from '../types/database';
import { getInitials } from '../lib/utils';
import { C, F } from '../theme';
import { medalOrRank, rankColor } from '../lib/rankUtils';

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
          <Text style={[s.leagueTitle, { color: tierMeta?.color ?? C.bronze }]}>
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
                accessibilityLabel={nudgedToday.has(item.user_id) ? 'Already nudged' : `Nudge ${item.full_name ?? item.username ?? 'this person'}`}
                accessibilityRole="button"
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
  leagueTitle:    { fontSize: 20, fontWeight: '900', fontFamily: F.disp, letterSpacing: -0.5, marginBottom: 4 },
  leagueSubtitle: { fontSize: 12, color: C.muted, marginBottom: 12 },
  empty:          { paddingVertical: 24, alignItems: 'center' },
  emptyText:      { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  row:            { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 6, gap: 10 },
  rowMe:          { borderColor: C.primary + '60', backgroundColor: C.primary + '10' },
  rowPromotion:   { borderLeftWidth: 3, borderLeftColor: C.success },
  rowRelegation:  { borderLeftWidth: 3, borderLeftColor: C.error },
  rowGold:        { borderLeftWidth: 3, borderLeftColor: C.gold },
  rowSilver:      { borderLeftWidth: 3, borderLeftColor: C.silver },
  rowBronze:      { borderLeftWidth: 3, borderLeftColor: C.bronze },
  rankText:       { fontSize: 14, fontWeight: '800', fontFamily: F.disp, width: 32, textAlign: 'center' },
  avatar:         { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 13, fontWeight: '800', fontFamily: F.disp, color: C.primary },
  memberName:     { fontSize: 14, fontWeight: '700', fontFamily: F.bold, color: C.text },
  promotionLabel: { fontSize: 10, color: C.success, fontWeight: '700', fontFamily: F.bold, marginTop: 2 },
  relegationLabel:{ fontSize: 10, color: C.error, fontWeight: '700', fontFamily: F.bold, marginTop: 2 },
  pts:            { fontSize: 15, fontWeight: '900', fontFamily: F.disp, color: C.primary },
  nudgeBtn:       { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: C.primary + '60', alignItems: 'center', justifyContent: 'center' },
  nudgeBtnDone:   { backgroundColor: C.primary + '20', borderColor: C.primary },
  nudgeBtnText:   { fontSize: 14, lineHeight: 16 },
});
