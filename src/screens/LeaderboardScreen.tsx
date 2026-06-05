import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, StatusBar, Share, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useStreaks } from '../hooks/useStreaks';
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_TIER_META } from '../types/database';
import type { LeaderboardEntry, LeagueTier } from '../types/database';
import { C, S, R, FS, F } from '../theme';

type Tab = 'league' | 'week' | 'world' | 'friends';

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

const NUDGE_EMOJIS = ['💪', '🔥', '👏', '😤', '⚡'];

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

  const { members: leagueMembers, myTier, myRank: myLeagueRank, loading: leagueLoading, refresh: refreshLeague } = useLeague(userId);
  const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];

  const [tab, setTab] = useState<Tab>('league');
  const [nudgeTarget, setNudgeTarget] = useState<{ id: string; name: string } | null>(null);
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());


  async function sendNudge(receiverId: string, emoji?: string) {
    setNudgeSending(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setNudgeSending(false); return; }

    try {
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-nudge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ receiver_id: receiverId, emoji }),
        },
      );
      const json = await resp.json();
      if (resp.status === 429) {
        Alert.alert('Already sent', 'You have already nudged this person today.');
      } else if (json.success) {
        setNudgedToday(prev => new Set(prev).add(receiverId));
      }
    } catch {
      Alert.alert('Error', 'Could not send nudge.');
    }
    setNudgeSending(false);
    setNudgeTarget(null);
  }

  useEffect(() => {
    fetchWeekly();
    fetchGlobal();
    fetchFriends();
  }, [fetchWeekly, fetchGlobal, fetchFriends]);

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

  const renderRow = useCallback(({ item, index }: { item: LeaderboardEntry; index: number }) => {
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
            accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
          >
            <Text style={[s.followBtnText, isFollowing && s.followingBtnText]}>
              {isFollowing ? '✓' : '+'}
            </Text>
          </TouchableOpacity>
        )}
        {!isMe && (
          <TouchableOpacity
            style={[s.nudgeBtn, nudgedToday.has(item.id) && s.nudgeBtnDone]}
            onPress={() => setNudgeTarget({ id: item.id, name: item.full_name ?? item.username })}
            activeOpacity={0.7}
            accessibilityLabel="Send nudge"
          >
            <Text style={s.nudgeBtnText}>{nudgedToday.has(item.id) ? '✓' : '💪'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [tab, following, userId, nudgedToday, unfollow, follow, setNudgeTarget]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Leaderboard</Text>
          <Text style={s.subtitle}>
            {myRank
              ? `#${myRank} ${tab === 'week' ? 'this week' : 'globally'} · ${myRank === 1 ? 'You\'re leading! 🥇' : `Keep pushing to reach #${myRank - 1}!`}`
              : 'Log workouts to rank up'}
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
        {([
          { key: 'league' as Tab, label: `${tierMeta?.emoji ?? '🥉'} League` },
          { key: 'week' as Tab, label: '📅 Week' },
          { key: 'world' as Tab, label: '🌍 All-time' },
          { key: 'friends' as Tab, label: '👥 Friends' },
        ]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[s.tab, tab === key && s.tabActive]}
            onPress={() => setTab(key)}
            accessibilityLabel={label.replace(/[^\w\s]/g, '').trim() + ' leaderboard'}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'league' && (
        <FlatList
          data={leagueMembers}
          keyExtractor={m => m.user_id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={leagueLoading} onRefresh={refreshLeague} tintColor={C.primary} />}
          ListHeaderComponent={
            <View style={{ paddingBottom: 8 }}>
              <Text style={[{ fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 }, { color: tierMeta?.color ?? '#B45309' }]}>
                {tierMeta?.emoji} {tierMeta?.label} League
              </Text>
              {(() => {
                const dayOfWeek = new Date().getDay(); // 0=Sun
                const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                return (
                  <Text style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                    Top 5 promote · Bottom 5 relegate · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                  </Text>
                );
              })()}
              {leagueMembers.length === 0 && !leagueLoading && (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 }}>
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
            const avatarInitials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <View style={[
                s.leagueRow,
                isMe && s.leagueRowMe,
                isPromotion && s.leagueRowPromotion,
                isRelegation && s.leagueRowRelegation,
                rank === 1 && s.leagueRowGold,
                rank === 2 && s.leagueRowSilver,
                rank === 3 && s.leagueRowBronze,
              ]}>
                <Text style={[s.leagueRankText, { color: rankColor(rank) }]}>{medalOrRank(rank)}</Text>
                <View style={s.leagueAvatar}>
                  <Text style={s.leagueAvatarText}>{avatarInitials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.leagueMemberName} numberOfLines={1}>
                    {name}{isMe ? ' (you)' : ''}
                  </Text>
                  {isPromotion && <Text style={{ fontSize: 10, color: C.green, fontWeight: '700', marginTop: 2 }}>⬆️ Promotion zone</Text>}
                  {isRelegation && <Text style={{ fontSize: 10, color: C.error, fontWeight: '700', marginTop: 2 }}>⬇️ Relegation zone</Text>}
                </View>
                <Text style={s.leaguePts}>{item.weekly_points} pts</Text>
                {!isMe && (
                  <TouchableOpacity
                    style={[s.nudgeBtn, nudgedToday.has(item.user_id) && s.nudgeBtnDone]}
                    onPress={() => setNudgeTarget({ id: item.user_id, name: item.full_name ?? item.username })}
                  >
                    <Text style={s.nudgeBtnText}>{nudgedToday.has(item.user_id) ? '✓' : '💪'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Nudge / emoji picker modal */}
      <Modal visible={!!nudgeTarget} transparent animationType="fade" onRequestClose={() => setNudgeTarget(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setNudgeTarget(null)}>
          <View style={s.nudgeModal}>
            <Text style={s.nudgeModalTitle}>Nudge {nudgeTarget?.name?.split(' ')[0]}</Text>
            <View style={s.nudgeEmojiRow}>
              {NUDGE_EMOJIS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={s.nudgeEmojiBtn}
                  onPress={() => sendNudge(nudgeTarget!.id, emoji)}
                  disabled={nudgeSending}
                >
                  <Text style={s.nudgeEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.nudgeTextBtn, nudgeSending && { opacity: 0.5 }]}
              onPress={() => sendNudge(nudgeTarget!.id)}
              disabled={nudgeSending}
            >
              {nudgeSending
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={s.nudgeTextBtnText}>💪 Get moving!</Text>
              }
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {tab !== 'league' && (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.primary} />}
          renderItem={renderRow}
          getItemLayout={(_, index) => ({ length: 74, offset: 74 * index, index })}
          ListFooterComponent={(() => {
            const userInData = data.some(item => item.id === userId);
            if (userInData || myRank === null || !profile) return null;
            const myPts = tab === 'week'
              ? (weeklyBoard.find(p => p.id === userId)?.weekly_points ?? 0)
              : (profile.total_points ?? 0);
            const myInitials = (profile.full_name ?? profile.username ?? '?')
              .trim().split(/\s+/).map((w: string) => w[0] ?? '').filter(Boolean).join('').slice(0, 2).toUpperCase();
            return (
              <View style={s.pinnedFooter}>
                <Text style={s.pinnedLabel}>YOUR POSITION</Text>
                <View style={[s.row, s.rowMe]}>
                  <Text style={[s.rank, { color: C.primary }]}>#{myRank}</Text>
                  <View style={[s.avatar, s.avatarMe]}>
                    <Text style={[s.avatarText, { color: C.primary }]}>{myInitials}</Text>
                  </View>
                  <View style={s.info}>
                    <Text style={s.name} numberOfLines={1}>
                      {profile.full_name ?? profile.username} (you)
                    </Text>
                    <Text style={s.username}>@{profile.username}</Text>
                  </View>
                  <View style={s.ptsBadge}>
                    <Text style={[s.pts, { color: C.primary }]}>{myPts.toLocaleString()}</Text>
                    <Text style={s.ptsLabel}>pts</Text>
                  </View>
                </View>
              </View>
            );
          })()}
          ListEmptyComponent={
            loading && data.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <ActivityIndicator color={C.primary} size="small" />
              </View>
            ) : !loading ? (
              tab === 'friends' ? (
                <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                  <Text style={{ fontSize: 32 }}>👥</Text>
                  <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>No friends yet</Text>
                  <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>
                    Follow other athletes to see them on your leaderboard
                  </Text>
                </View>
              ) : (
                <View style={s.empty}>
                  <Text style={s.emptyEmoji}>🏆</Text>
                  <Text style={s.emptyTitle}>
                    {tab === 'week' ? 'No workouts this week' : 'No one here yet'}
                  </Text>
                  <Text style={s.emptyText}>Log your first workout to appear here</Text>
                </View>
              )
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: S[5], paddingTop: S[3], paddingBottom: S[2] + 2 },
  title:        { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5, fontFamily: F.uiBold },
  subtitle:     { fontSize: 13, color: C.muted, marginTop: 2, fontFamily: F.ui },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareBtn:     { backgroundColor: '#1E2A35', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: C.text },
  myPtsBadge:   { backgroundColor: C.primary + '18', borderWidth: 1, borderColor: C.primary + '35', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' },
  myPtsNum:     { fontSize: 15, fontWeight: '900', color: C.primary },
  myPtsLabel:   { fontSize: 9, color: C.primary, fontWeight: '600', marginTop: 1 },

  scoringRow:   { flexDirection: 'row', paddingHorizontal: 16, gap: 5, marginBottom: 10 },
  chip:         { flex: 1, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingVertical: 6, alignItems: 'center', gap: 2 },
  chipIcon:     { fontSize: 12 },
  chipLabel:    { fontSize: 10, color: C.muted, fontWeight: '600', textAlign: 'center' },

  tabs:         { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border },
  tab:          { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:    { backgroundColor: C.primary },
  tabText:      { fontSize: 12, fontWeight: '700', color: C.muted },
  tabTextActive:{ color: '#000' },

  list:         { paddingHorizontal: 16, paddingBottom: 100 },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: S[3], marginBottom: S[2], gap: S[2] + 2 },
  rowMe:        { borderColor: C.primary + '50', backgroundColor: C.primary + '08' },
  rowGold:      { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  rowSilver:    { borderLeftWidth: 3, borderLeftColor: '#9CA3AF' },
  rowBronze:    { borderLeftWidth: 3, borderLeftColor: '#B45309' },
  rank:         { width: 30, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  avatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1E2A35', alignItems: 'center', justifyContent: 'center' },
  avatarMe:     { backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40' },
  avatarText:   { fontSize: 13, fontWeight: '800', color: C.muted },
  info:         { flex: 1 },
  name:         { fontSize: 14, fontWeight: '700', color: C.text, fontFamily: F.uiBold },
  username:     { fontSize: 11, color: C.muted, marginTop: 1 },
  ptsBadge:     { alignItems: 'flex-end' },
  pts:          { fontSize: 16, fontWeight: '900', color: C.text, fontFamily: F.uiBold },
  ptsLabel:     { fontSize: 9, color: C.muted, fontWeight: '600' },
  followBtn:    { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  followingBtn: { backgroundColor: C.primary },
  followBtnText:   { fontSize: 15, color: C.primary, fontWeight: '800', lineHeight: 17 },
  followingBtnText:{ color: '#000' },
  empty:        { alignItems: 'center', paddingTop: 64, gap: 12, paddingHorizontal: 32 },
  emptyEmoji:   { fontSize: 48 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.muted },
  emptyText:    { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  leagueRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: S[3], marginBottom: 6, gap: S[2] + 2 },
  leagueRowMe:        { borderColor: C.primary + '60', backgroundColor: C.primary + '10' },
  leagueRowPromotion: { borderLeftWidth: 3, borderLeftColor: C.green },
  leagueRowRelegation: { borderLeftWidth: 3, borderLeftColor: C.error },
  leagueRowGold:       { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  leagueRowSilver:     { borderLeftWidth: 3, borderLeftColor: '#9CA3AF' },
  leagueRowBronze:     { borderLeftWidth: 3, borderLeftColor: '#B45309' },
  leagueRankText:     { fontSize: 14, fontWeight: '800', width: 32, textAlign: 'center' },
  leagueAvatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' },
  leagueAvatarText:   { fontSize: 13, fontWeight: '800', color: C.primary },
  leagueMemberName:   { fontSize: 14, fontWeight: '700', color: C.text },
  leaguePts:          { fontSize: 15, fontWeight: '900', color: C.primary },

  nudgeBtn:     { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: C.primary + '60', alignItems: 'center', justifyContent: 'center' },
  nudgeBtnDone: { backgroundColor: C.primary + '20', borderColor: C.primary },
  nudgeBtnText: { fontSize: 14, lineHeight: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  nudgeModal: { backgroundColor: '#151C24', borderRadius: 20, padding: 24, alignItems: 'center', gap: 16, width: 280, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  nudgeModalTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  nudgeEmojiRow: { flexDirection: 'row', gap: 12 },
  nudgeEmojiBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  nudgeEmoji: { fontSize: 26 },
  nudgeTextBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center', width: '100%' },
  nudgeTextBtnText: { color: '#000', fontWeight: '800', fontSize: 15, fontFamily: F.uiBold },

  pinnedFooter: {
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  pinnedLabel: {
    fontSize: 9, fontWeight: '700', color: '#637C8F',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
  },
});
