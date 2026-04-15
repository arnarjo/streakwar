import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, StatusBar, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useStreaks } from '../hooks/useStreaks';
import type { LeaderboardEntry } from '../types/database';

const C = {
  bg: '#0C1117', card: '#151C24', border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8', muted: '#4A6070', primary: '#F97316',
  gold: '#F59E0B', silver: '#9CA3AF', bronze: '#B45309',
};

type Tab = 'week' | 'world' | 'friends';

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

function initials(entry: LeaderboardEntry) {
  const name = entry.full_name ?? entry.username;
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function LeaderboardScreen() {
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const { streak } = useStreaks(userId);

  const {
    globalBoard, weeklyBoard, friendsBoard,
    following, myGlobalRank, myWeeklyRank,
    loading, fetchGlobal, fetchWeekly, fetchFriends,
    follow, unfollow,
  } = useLeaderboard(userId);

  const [tab, setTab] = useState<Tab>('week');

  useEffect(() => {
    fetchWeekly();
    fetchGlobal();
    fetchFriends();
  }, []);

  const onRefresh = useCallback(() => {
    fetchWeekly();
    fetchGlobal();
    fetchFriends();
  }, [fetchWeekly, fetchGlobal, fetchFriends]);

  async function handleShare() {
    const rank  = tab === 'week' ? myWeeklyRank : myGlobalRank;
    const pts   = tab === 'week'
      ? (weeklyBoard.find(p => p.id === userId)?.weekly_points ?? 0)
      : (profile?.total_points ?? 0);
    const label = tab === 'week' ? 'this week' : 'all-time';
    await Share.share({
      message:
        `🔥 ${streak?.current_streak ?? 0}-day streak on StreakWar!\n` +
        `⭐ ${pts.toLocaleString()} points ${label}\n` +
        (rank ? `🌍 Ranked #${rank} ${tab === 'week' ? 'this week' : 'globally'}\n` : '') +
        `\nCan you beat me? Download StreakWar and compete! 💪`,
    });
  }

  const data = tab === 'week' ? weeklyBoard : tab === 'world' ? globalBoard : friendsBoard;
  const myRank = tab === 'week' ? myWeeklyRank : tab === 'world' ? myGlobalRank : null;

  function renderRow({ item, index }: { item: LeaderboardEntry; index: number }) {
    const rank = index + 1;
    const isMe = item.id === userId;
    const isFollowing = following.has(item.id);
    const pts = tab === 'week' ? (item.weekly_points ?? 0) : item.total_points;

    return (
      <View style={[s.row, isMe && s.rowMe]}>
        <Text style={[s.rank, { color: rankColor(rank) }]}>{medalOrRank(rank)}</Text>

        <View style={[s.avatar, isMe && s.avatarMe]}>
          <Text style={[s.avatarText, isMe && { color: C.primary }]}>{initials(item)}</Text>
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
            onPress={() => isFollowing ? unfollow(item.id) : follow(item.id)}
            activeOpacity={0.7}
          >
            <Text style={[s.followBtnText, isFollowing && s.followingBtnText]}>
              {isFollowing ? '✓' : '+'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Leaderboard</Text>
          <Text style={s.subtitle}>
            {myRank ? `#${myRank} ${tab === 'week' ? 'this week' : 'globally'}` : 'Log workouts to rank up'}
          </Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.7}>
            <Text style={s.shareBtnText}>Share 📤</Text>
          </TouchableOpacity>
          <View style={s.myPtsBadge}>
            <Text style={s.myPtsNum}>{(profile?.total_points ?? 0).toLocaleString()}</Text>
            <Text style={s.myPtsLabel}>total pts</Text>
          </View>
        </View>
      </View>

      {/* Scoring chips */}
      <View style={s.scoringRow}>
        {[
          { icon: '💪', label: '1pt / workout' },
          { icon: '👟', label: '1pt / 1k steps' },
          { icon: '📍', label: '1pt / km' },
          { icon: '⏱', label: '1pt / 30min' },
        ].map(({ icon, label }) => (
          <View key={label} style={s.chip}>
            <Text style={s.chipIcon}>{icon}</Text>
            <Text style={s.chipLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {([['week', '📅 Week'], ['world', '🌍 All-time'], ['friends', '👥 Friends']] as [Tab, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[s.tab, tab === key && s.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.primary} />}
        renderItem={renderRow}
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  title:        { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  subtitle:     { fontSize: 13, color: C.muted, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareBtn:     { backgroundColor: '#1E2A35', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: C.text },
  myPtsBadge:   { backgroundColor: C.primary + '18', borderWidth: 1, borderColor: C.primary + '35', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' },
  myPtsNum:     { fontSize: 15, fontWeight: '900', color: C.primary },
  myPtsLabel:   { fontSize: 9, color: C.primary, fontWeight: '600', marginTop: 1 },

  scoringRow:   { flexDirection: 'row', paddingHorizontal: 16, gap: 5, marginBottom: 10 },
  chip:         { flex: 1, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingVertical: 6, alignItems: 'center', gap: 2 },
  chipIcon:     { fontSize: 12 },
  chipLabel:    { fontSize: 8, color: C.muted, fontWeight: '600', textAlign: 'center' },

  tabs:         { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border },
  tab:          { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:    { backgroundColor: C.primary },
  tabText:      { fontSize: 12, fontWeight: '700', color: C.muted },
  tabTextActive:{ color: '#000' },

  list:         { paddingHorizontal: 16, paddingBottom: 100 },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, gap: 10 },
  rowMe:        { borderColor: C.primary + '50', backgroundColor: C.primary + '08' },
  rank:         { width: 30, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  avatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1E2A35', alignItems: 'center', justifyContent: 'center' },
  avatarMe:     { backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40' },
  avatarText:   { fontSize: 13, fontWeight: '800', color: C.muted },
  info:         { flex: 1 },
  name:         { fontSize: 14, fontWeight: '700', color: C.text },
  username:     { fontSize: 11, color: C.muted, marginTop: 1 },
  ptsBadge:     { alignItems: 'flex-end' },
  pts:          { fontSize: 15, fontWeight: '900', color: C.text },
  ptsLabel:     { fontSize: 9, color: C.muted, fontWeight: '600' },
  followBtn:    { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  followingBtn: { backgroundColor: C.primary },
  followBtnText:   { fontSize: 15, color: C.primary, fontWeight: '800', lineHeight: 17 },
  followingBtnText:{ color: '#000' },
  empty:        { alignItems: 'center', paddingTop: 64, gap: 12, paddingHorizontal: 32 },
  emptyEmoji:   { fontSize: 48 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.muted },
  emptyText:    { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
});
