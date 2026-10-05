import React, { useEffect, useState, useCallback } from 'react';
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
import InterfaceIcon from '../components/InterfaceIcon';
import { C, HIT, R } from '../theme';
import { rankColor, initials } from '../lib/leaderboardFormat';

type Tab = 'league' | 'week' | 'world' | 'friends';

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
  const [refreshing, setRefreshing] = useState(false);
  const [nudgeTarget, setNudgeTarget] = useState<{ id: string; name: string } | null>(null);
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());

  const NUDGE_EMOJIS = ['💪', '🔥', '👏', '😤', '⚡'];

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
      } else {
        Alert.alert('Could not send nudge', json.error ?? 'Something went wrong. Please try again.');
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
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchWeekly(), fetchGlobal(), fetchFriends()]);
    setRefreshing(false);
  }, [fetchWeekly, fetchGlobal, fetchFriends]);

  const onRefreshLeague = useCallback(async () => {
    setRefreshing(true);
    await refreshLeague();
    setRefreshing(false);
  }, [refreshLeague]);

  async function handleShare() {
    const rank  = tab === 'week' ? myWeeklyRank : myGlobalRank;
    const pts   = tab === 'week'
      ? (weeklyBoard.find(p => p.id === userId)?.weekly_points ?? 0)
      : (profile?.total_points ?? 0);
    const label = tab === 'week' ? 'this week' : 'all-time';
    await Share.share({
      message:
        `${streak?.current_streak ?? 0}-day streak on StreakWar.\n` +
        `${pts.toLocaleString()} competition points ${label}\n` +
        (rank ? `Ranked #${rank} ${tab === 'week' ? 'this week' : 'globally'}\n` : '') +
        `\nCan you beat me? Download StreakWar and compete.`,
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
      <View style={[
        s.row,
        isMe && s.rowMe,
        rank === 1 && s.rowGold,
        rank === 2 && s.rowSilver,
        rank === 3 && s.rowBronze,
      ]}>
        <Text style={[s.rank, { color: rankColor(rank) }]}>{rank}</Text>

        <View style={[s.avatar, isMe && s.avatarMe]}>
          <Text style={[s.avatarText, isMe && { color: C.text }]}>{initials(item)}</Text>
        </View>

        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>
            {item.full_name ?? item.username}{isMe ? '  (you)' : ''}
          </Text>
          <Text style={s.username} numberOfLines={1}>@{item.username}</Text>
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
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityState={{ selected: isFollowing }}
            accessibilityLabel={isFollowing ? `Unfollow ${item.username}` : `Follow ${item.username}`}
          >
            <InterfaceIcon name={isFollowing ? 'checkmark' : 'add'} size={18} color={isFollowing ? C.onPrimary : C.text} />
          </TouchableOpacity>
        )}
        {!isMe && (
          <TouchableOpacity
            style={[s.nudgeBtn, nudgedToday.has(item.id) && s.nudgeBtnDone]}
            onPress={() => setNudgeTarget({ id: item.id, name: item.full_name ?? item.username })}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Nudge ${item.full_name ?? item.username}`}
          >
            <InterfaceIcon name={nudgedToday.has(item.id) ? 'checkmark' : 'flash-outline'} size={18} color={C.text} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const TABS: { key: Tab; label: string; icon: React.ComponentProps<typeof InterfaceIcon>['name'] }[] = [
    { key: 'league', label: 'League', icon: 'shield-outline' },
    { key: 'week', label: 'Week', icon: 'calendar-outline' },
    { key: 'world', label: 'All-time', icon: 'globe-outline' },
    { key: 'friends', label: 'Friends', icon: 'people-outline' },
  ];
  const shownRank = tab === 'week' || tab === 'world' ? myRank : null;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <Text style={s.title} accessibilityRole="header">Leaderboard</Text>
        <TouchableOpacity
          style={s.shareBtn}
          onPress={handleShare}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Share your ranking"
        >
          <InterfaceIcon name="share-outline" size={18} color={C.text} />
          <Text style={s.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.scopeNote}>
        Competition rankings only. Private Health Connect activity is not included.
      </Text>

      <View style={s.summary}>
        <View>
          <Text style={s.summaryValue}>{(profile?.total_points ?? 0).toLocaleString()}</Text>
          <Text style={s.summaryLabel}>Your competition points</Text>
        </View>
        {shownRank !== null && (
          <Text style={s.summaryRank}>#{shownRank} {tab === 'week' ? 'this week' : 'globally'}</Text>
        )}
      </View>

      <Text style={s.scoringNote}>Points: 1 per workout · 1 per 1k steps · 1 per km · 1 per 30 min</Text>

      {/* Tabs */}
      <View style={s.tabs} accessibilityRole="tablist">
        {TABS.map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={[s.tab, tab === key && s.tabActive]}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            accessibilityLabel={key === 'league' ? `${tierMeta?.label ?? ''} league`.trim() : label}
          >
            <InterfaceIcon name={icon} size={18} color={tab === key ? C.primary : C.muted} />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshLeague} tintColor={C.primary} />}
          ListHeaderComponent={
            <View style={{ paddingBottom: 8 }}>
              <View style={s.leagueTitleRow}>
                <View style={[s.leagueMark, { backgroundColor: tierMeta?.color ?? C.bronze }]} />
                <Text style={s.leagueTitle} accessibilityRole="header">{tierMeta?.label} League</Text>
              </View>
              {(() => {
                const dayOfWeek = new Date().getDay(); // 0=Sun
                const daysLeft = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
                return (
                  <Text style={s.leagueCaption}>
                    Top 5 promote · Bottom 5 relegate · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                  </Text>
                );
              })()}
              {leagueMembers.length === 0 && leagueLoading && (
                <ActivityIndicator style={{ paddingVertical: 24 }} color={C.primary} />
              )}
              {leagueMembers.length === 0 && !leagueLoading && (
                <View style={s.leagueEmpty}>
                  <Text style={s.emptyTitle}>No league group yet</Text>
                  <Text style={s.emptyText}>No league group was found for your account. Weekly league rankings appear here once you are in a group.</Text>
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
                <Text style={[s.leagueRankText, { color: rankColor(rank) }]}>{rank}</Text>
                <View style={s.leagueAvatar}>
                  <Text style={s.leagueAvatarText}>{avatarInitials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.leagueMemberName} numberOfLines={1}>
                    {name}{isMe ? ' (you)' : ''}
                  </Text>
                  {isPromotion && <Text style={[s.zoneText, { color: C.green }]}>Promotion zone</Text>}
                  {isRelegation && <Text style={[s.zoneText, { color: C.error }]}>Relegation zone</Text>}
                </View>
                <Text style={s.leaguePts}>{item.weekly_points} pts</Text>
                {!isMe && (
                  <TouchableOpacity
                    style={[s.nudgeBtn, nudgedToday.has(item.user_id) && s.nudgeBtnDone]}
                    onPress={() => setNudgeTarget({ id: item.user_id, name: item.full_name ?? item.username })}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Nudge ${name}`}
                  >
                    <InterfaceIcon name={nudgedToday.has(item.user_id) ? 'checkmark' : 'flash-outline'} size={18} color={C.text} />
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
                  accessibilityRole="button"
                  accessibilityLabel={`Send ${emoji} nudge`}
                >
                  <Text style={s.nudgeEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.nudgeTextBtn, nudgeSending && { opacity: 0.5 }]}
              onPress={() => sendNudge(nudgeTarget!.id)}
              disabled={nudgeSending}
              accessibilityRole="button"
              accessibilityLabel="Send nudge"
            >
              {nudgeSending
                ? <ActivityIndicator color={C.onPrimary} size="small" />
                : <Text style={s.nudgeTextBtnText}>Send nudge</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          renderItem={renderRow}
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
            !loading ? (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>
                  {tab === 'friends' ? 'No friends yet' : tab === 'week' ? 'No workouts this week' : 'No one here yet'}
                </Text>
                <Text style={s.emptyText}>
                  {tab === 'friends'
                    ? 'Switch to Week or All-time and tap + to follow people.'
                    : 'Log a workout to appear here.'}
                </Text>
              </View>
            ) : (
              <ActivityIndicator style={{ marginTop: 48 }} color={C.primary} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 },
  title:        { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  shareBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: HIT, paddingHorizontal: 12, borderRadius: R.sm, borderWidth: 1, borderColor: C.border },
  shareBtnText: { fontSize: 13, fontWeight: '700', color: C.text },
  scopeNote:    { fontSize: 12, color: C.muted, lineHeight: 17, paddingHorizontal: 16, marginBottom: 10 },
  summary:      { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, marginBottom: 6 },
  summaryValue: { fontSize: 36, fontWeight: '800', color: C.text, letterSpacing: -1 },
  summaryLabel: { fontSize: 12, color: C.muted },
  summaryRank:  { fontSize: 14, fontWeight: '700', color: C.text, paddingBottom: 4 },
  scoringNote:  { fontSize: 12, color: C.muted, paddingHorizontal: 16, marginBottom: 10 },

  tabs:         { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, gap: 6 },
  tab:          { flex: 1, minHeight: 52, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: R.sm, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tabActive:    { backgroundColor: C.dimmed, borderColor: C.primary },
  tabText:      { fontSize: 12, fontWeight: '600', color: C.muted, textAlign: 'center' },
  tabTextActive:{ color: C.text, fontWeight: '800' },

  list:         { paddingHorizontal: 16, paddingBottom: 100 },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, gap: 10, minHeight: 60 },
  rowMe:        { borderColor: C.primary, backgroundColor: C.dimmed },
  rowGold:      { borderLeftWidth: 3, borderLeftColor: C.gold },
  rowSilver:    { borderLeftWidth: 3, borderLeftColor: C.silver },
  rowBronze:    { borderLeftWidth: 3, borderLeftColor: C.bronze },
  rank:         { width: 26, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  avatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: C.dimmed, alignItems: 'center', justifyContent: 'center' },
  avatarMe:     { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  avatarText:   { fontSize: 13, fontWeight: '800', color: C.muted },
  info:         { flex: 1 },
  name:         { fontSize: 14, fontWeight: '700', color: C.text },
  username:     { fontSize: 12, color: C.muted, marginTop: 1 },
  ptsBadge:     { alignItems: 'flex-end' },
  pts:          { fontSize: 16, fontWeight: '800', color: C.text },
  ptsLabel:     { fontSize: 11, color: C.muted, fontWeight: '600' },
  followBtn:    { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  followingBtn: { backgroundColor: C.primary, borderColor: C.primary },
  empty:        { paddingTop: 32, gap: 8, paddingHorizontal: 4 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
  emptyText:    { fontSize: 13, color: C.muted, lineHeight: 18 },

  leagueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  leagueMark:    { width: 4, height: 22, borderRadius: 2 },
  leagueTitle:   { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  leagueCaption: { fontSize: 12, color: C.muted, marginBottom: 12 },
  leagueEmpty:   { paddingVertical: 16, gap: 8 },
  zoneText:      { fontSize: 11, fontWeight: '700', marginTop: 2 },
  leagueRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12, marginBottom: 6, gap: 10, minHeight: 60 },
  leagueRowMe:        { borderColor: C.primary, backgroundColor: C.dimmed },
  leagueRowPromotion: { borderLeftWidth: 3, borderLeftColor: C.green },
  leagueRowRelegation: { borderLeftWidth: 3, borderLeftColor: C.error },
  leagueRowGold:       { borderLeftWidth: 3, borderLeftColor: C.gold },
  leagueRowSilver:     { borderLeftWidth: 3, borderLeftColor: C.silver },
  leagueRowBronze:     { borderLeftWidth: 3, borderLeftColor: C.bronze },
  leagueRankText:     { fontSize: 15, fontWeight: '800', width: 28, textAlign: 'center' },
  leagueAvatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.dimmed, alignItems: 'center', justifyContent: 'center' },
  leagueAvatarText:   { fontSize: 13, fontWeight: '800', color: C.text },
  leagueMemberName:   { fontSize: 14, fontWeight: '700', color: C.text },
  leaguePts:          { fontSize: 15, fontWeight: '800', color: C.text },

  nudgeBtn:     { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  nudgeBtnDone: { backgroundColor: C.dimmed },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  nudgeModal: { backgroundColor: C.card, borderRadius: R.md, padding: 24, alignItems: 'center', gap: 16, width: 280, maxWidth: '90%', borderWidth: 1, borderColor: C.border },
  nudgeModalTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  nudgeEmojiRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  nudgeEmojiBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.dimmed, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  nudgeEmoji: { fontSize: 24 },
  nudgeTextBtn: { backgroundColor: C.primary, borderRadius: R.sm, minHeight: 48, justifyContent: 'center', alignItems: 'center', width: '100%' },
  nudgeTextBtnText: { color: C.onPrimary, fontWeight: '800', fontSize: 15 },

  pinnedFooter: {
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  pinnedLabel: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4,
  },
});
