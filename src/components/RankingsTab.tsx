import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import type { LeaderboardEntry } from '../types/database';
import { getInitials } from '../lib/utils';
import { C, F } from '../theme';
import { medalOrRank, rankColor } from '../lib/rankUtils';

interface Profile {
  full_name: string | null;
  username: string | null;
}

interface Props {
  data: LeaderboardEntry[];
  tab: 'week' | 'world' | 'friends';
  loading: boolean;
  onRefresh: () => void;
  userId: string;
  following: Set<string>;
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
  nudgedToday: Set<string>;
  onNudge: (id: string, name: string) => void;
  myRank: number | null;
  footerUserInData: boolean;
  footerMyPts: number;
  footerMyInitials: string;
  profile: Profile | null;
}

export function RankingsTab({
  data, tab, loading, onRefresh, userId, following, onFollow, onUnfollow,
  nudgedToday, onNudge, myRank, footerUserInData, footerMyPts, footerMyInitials, profile,
}: Props) {
  function renderRow({ item, index }: { item: LeaderboardEntry; index: number }) {
    const rank = index + 1;
    const isMe = item.id === userId;
    const isFollowing = following.has(item.id);
    const pts = tab === 'week' ? (item.weekly_points ?? 0) : item.total_points;

    return (
      <View style={[
        s.row,
        isMe && s.rowMe,
        rank === 1 && s.rowGold,
        rank === 2 && s.rowSilver,
        rank === 3 && s.rowBronze,
      ]}>
        <Text style={[s.rank, { color: rankColor(rank) }]}>{medalOrRank(rank)}</Text>
        <View style={[s.avatar, isMe && s.avatarMe]}>
          <Text style={[s.avatarText, isMe && { color: C.primary }]}>{getInitials(item.full_name ?? item.username)}</Text>
        </View>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>
            {item.full_name ?? item.username}{isMe ? '  (you)' : ''}
          </Text>
          <Text style={s.username}>@{item.username}</Text>
        </View>
        <View style={s.ptsBadge}>
          <Text style={s.pts}>{pts.toLocaleString()}</Text>
          <Text style={s.ptsLabel}>pts</Text>
        </View>
        {tab !== 'friends' && !isMe && (
          <TouchableOpacity
            style={[s.followBtn, isFollowing && s.followingBtn]}
            onPress={() => isFollowing ? onUnfollow(item.id) : onFollow(item.id)}
            activeOpacity={0.7}
            accessibilityLabel={isFollowing ? `Unfollow ${item.full_name ?? item.username}` : `Follow ${item.full_name ?? item.username}`}
            accessibilityRole="button"
          >
            <Text style={[s.followBtnText, isFollowing && s.followingBtnText]}>
              {isFollowing ? '✓' : '+'}
            </Text>
          </TouchableOpacity>
        )}
        {!isMe && (
          <TouchableOpacity
            style={[s.nudgeBtn, nudgedToday.has(item.id) && s.nudgeBtnDone]}
            onPress={() => onNudge(item.id, item.full_name ?? item.username)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={nudgedToday.has(item.id) ? 'Already nudged' : `Nudge ${item.full_name ?? item.username ?? 'this person'}`}
          >
            <Text style={s.nudgeBtnText}>{nudgedToday.has(item.id) ? '✓' : '💪'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={item => item.id}
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.primary} />}
      renderItem={renderRow}
      ListFooterComponent={
        !footerUserInData && myRank !== null && profile ? (
          <View style={s.pinnedFooter}>
            <Text style={s.pinnedLabel}>YOUR POSITION</Text>
            <View style={[s.row, s.rowMe]}>
              <Text style={[s.rank, { color: C.primary }]}>#{myRank}</Text>
              <View style={[s.avatar, s.avatarMe]}>
                <Text style={[s.avatarText, { color: C.primary }]}>{footerMyInitials}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>
                  {profile.full_name ?? profile.username} (you)
                </Text>
                <Text style={s.username}>@{profile.username}</Text>
              </View>
              <View style={s.ptsBadge}>
                <Text style={[s.pts, { color: C.primary }]}>{footerMyPts.toLocaleString()}</Text>
                <Text style={s.ptsLabel}>pts</Text>
              </View>
            </View>
          </View>
        ) : null
      }
      ListEmptyComponent={
        !loading ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>{tab === 'friends' ? '👥' : '🏆'}</Text>
            <Text style={s.emptyTitle}>
              {tab === 'friends' ? 'No friends yet' : tab === 'week' ? 'No workouts this week' : 'No one here yet'}
            </Text>
            <Text style={s.emptyText}>
              {tab === 'friends'
                ? 'Switch to Week or All-time and tap + to follow people'
                : 'Log your first workout to appear here'}
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const s = StyleSheet.create({
  list:             { paddingHorizontal: 16, paddingBottom: 100 },
  row:              { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, gap: 10 },
  rowMe:            { borderColor: C.primary + '50', backgroundColor: C.primary + '08' },
  rowGold:          { borderLeftWidth: 3, borderLeftColor: C.gold },
  rowSilver:        { borderLeftWidth: 3, borderLeftColor: C.silver },
  rowBronze:        { borderLeftWidth: 3, borderLeftColor: C.bronze },
  rank:             { width: 30, fontSize: 13, fontWeight: '800', fontFamily: F.disp, textAlign: 'center' },
  avatar:           { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  avatarMe:         { backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40' },
  avatarText:       { fontSize: 13, fontWeight: '800', fontFamily: F.disp, color: C.muted },
  info:             { flex: 1 },
  name:             { fontSize: 14, fontWeight: '700', fontFamily: F.bold, color: C.text },
  username:         { fontSize: 11, color: C.muted, marginTop: 1 },
  ptsBadge:         { alignItems: 'flex-end' },
  pts:              { fontSize: 16, fontWeight: '900', fontFamily: F.disp, color: C.text },
  ptsLabel:         { fontSize: 9, color: C.muted, fontWeight: '600', fontFamily: F.medium },
  followBtn:        { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  followingBtn:     { backgroundColor: C.primary },
  followBtnText:    { fontSize: 15, color: C.primary, fontWeight: '800', fontFamily: F.disp, lineHeight: 17 },
  followingBtnText: { color: '#000' },
  nudgeBtn:         { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: C.primary + '60', alignItems: 'center', justifyContent: 'center' },
  nudgeBtnDone:     { backgroundColor: C.primary + '20', borderColor: C.primary },
  nudgeBtnText:     { fontSize: 14, lineHeight: 16 },
  empty:            { alignItems: 'center', paddingTop: 64, gap: 12, paddingHorizontal: 32 },
  emptyEmoji:       { fontSize: 48 },
  emptyTitle:       { fontSize: 16, fontWeight: '700', fontFamily: F.bold, color: C.muted },
  emptyText:        { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  pinnedFooter:     { paddingTop: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  pinnedLabel:      { fontSize: 9, fontWeight: '700', fontFamily: F.bold, color: '#637C8F', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
});
