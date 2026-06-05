import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Share, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getInitials } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useStreaks } from '../hooks/useStreaks';
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_TIER_META } from '../types/database';
import type { LeagueTier } from '../types/database';
import { C, F } from '../theme';
import { LeagueTab } from '../components/LeagueTab';
import { RankingsTab } from '../components/RankingsTab';

type Tab = 'league' | 'week' | 'world' | 'friends';
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

  const { members: leagueMembers, myTier, loading: leagueLoading, refresh: refreshLeague } = useLeague(userId);
  const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];

  const [tab, setTab] = useState<Tab>('league');
  const [nudgeTarget, setNudgeTarget] = useState<{ id: string; name: string } | null>(null);
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());

  useEffect(() => { fetchWeekly(); fetchGlobal(); fetchFriends(); }, [fetchWeekly, fetchGlobal, fetchFriends]);

  const onRefresh = useCallback(() => {
    fetchWeekly(); fetchGlobal(); fetchFriends();
  }, [fetchWeekly, fetchGlobal, fetchFriends]);

  async function sendNudge(receiverId: string, emoji?: string) {
    setNudgeSending(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setNudgeSending(false); return; }
    try {
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-nudge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
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

  async function handleShare() {
    const rank = tab === 'week' ? myWeeklyRank : myGlobalRank;
    const pts = tab === 'week'
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
  const leagueDayOfWeek = new Date().getDay();
  const leagueDaysLeft = leagueDayOfWeek === 0 ? 7 : 7 - leagueDayOfWeek;
  const footerUserInData = data.some(item => item.id === userId);
  const footerMyPts = tab === 'week'
    ? (weeklyBoard.find(p => p.id === userId)?.weekly_points ?? 0)
    : (profile?.total_points ?? 0);
  const footerMyInitials = getInitials(profile?.full_name ?? profile?.username);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <View>
          <Text style={s.title}>Leaderboard</Text>
          <Text style={s.subtitle}>
            {myRank
              ? `#${myRank} ${tab === 'week' ? 'this week' : 'globally'} · ${myRank === 1 ? "You're leading! 🥇" : `Keep pushing to reach #${myRank - 1}!`}`
              : 'Log workouts to rank up'}
          </Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.7} accessibilityLabel="Share your ranking" accessibilityRole="button">
            <Text style={s.shareBtnText}>Share 📤</Text>
          </TouchableOpacity>
          <View style={s.myPtsBadge}>
            <Text style={s.myPtsNum}>{(profile?.total_points ?? 0).toLocaleString()}</Text>
            <Text style={s.myPtsLabel}>total pts</Text>
          </View>
        </View>
      </View>

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

      <View style={s.tabs}>
        {([
          { key: 'league' as Tab, label: `${tierMeta?.emoji ?? '🥉'} League` },
          { key: 'week' as Tab, label: '📅 Week' },
          { key: 'world' as Tab, label: '🌍 All-time' },
          { key: 'friends' as Tab, label: '👥 Friends' },
        ]).map(({ key, label }) => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)} accessibilityLabel={`Select ${label} tab`} accessibilityRole="tab">
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'league' ? (
        <LeagueTab
          leagueMembers={leagueMembers}
          myTier={myTier as LeagueTier}
          loading={leagueLoading}
          onRefresh={refreshLeague}
          userId={userId}
          nudgedToday={nudgedToday}
          onNudge={(id, name) => setNudgeTarget({ id, name })}
          daysLeft={leagueDaysLeft}
        />
      ) : (
        <RankingsTab
          data={data}
          tab={tab}
          loading={loading}
          onRefresh={onRefresh}
          userId={userId}
          following={following}
          onFollow={follow}
          onUnfollow={unfollow}
          nudgedToday={nudgedToday}
          onNudge={(id, name) => setNudgeTarget({ id, name })}
          myRank={myRank}
          footerUserInData={footerUserInData}
          footerMyPts={footerMyPts}
          footerMyInitials={footerMyInitials}
          profile={profile}
        />
      )}

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
                : <Text style={s.nudgeTextBtnText}>💪 Get moving!</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  title:           { fontSize: 24, fontWeight: '800', fontFamily: F.disp, color: C.text, letterSpacing: -0.5 },
  subtitle:        { fontSize: 13, color: C.muted, marginTop: 2 },
  headerRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareBtn:        { backgroundColor: '#1E2A35', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.border, minHeight: 44, justifyContent: 'center' },
  shareBtnText:    { fontSize: 12, fontWeight: '700', fontFamily: F.bold, color: C.text },
  myPtsBadge:      { backgroundColor: C.primary + '18', borderWidth: 1, borderColor: C.primary + '35', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' },
  myPtsNum:        { fontSize: 15, fontWeight: '900', fontFamily: F.disp, color: C.primary },
  myPtsLabel:      { fontSize: 9, color: C.primary, fontWeight: '600', fontFamily: F.medium, marginTop: 1 },
  scoringRow:      { flexDirection: 'row', paddingHorizontal: 16, gap: 5, marginBottom: 10 },
  chip:            { flex: 1, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingVertical: 6, alignItems: 'center', gap: 2 },
  chipIcon:        { fontSize: 12 },
  chipLabel:       { fontSize: 8, color: C.muted, fontWeight: '600', fontFamily: F.medium, textAlign: 'center' },
  tabs:            { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, backgroundColor: C.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border },
  tab:             { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:       { backgroundColor: C.primary },
  tabText:         { fontSize: 12, fontWeight: '700', fontFamily: F.bold, color: C.muted },
  tabTextActive:   { color: '#000' },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  nudgeModal:      { backgroundColor: '#151C24', borderRadius: 20, padding: 24, alignItems: 'center', gap: 16, width: 280, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  nudgeModalTitle: { fontSize: 16, fontWeight: '800', fontFamily: F.disp, color: C.text },
  nudgeEmojiRow:   { flexDirection: 'row', gap: 12 },
  nudgeEmojiBtn:   { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  nudgeEmoji:      { fontSize: 26 },
  nudgeTextBtn:    { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center', width: '100%' },
  nudgeTextBtnText:{ color: '#000', fontWeight: '800', fontFamily: F.disp, fontSize: 15 },
});
