import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, Alert, Linking, Switch, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useStreaks } from '../hooks/useStreaks';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { useHealthSync } from '../hooks/useHealthSync';
import {
  formatSyncSuccess, formatSyncError, STALE_SYNC_ALERT, STALE_SYNC_ROW, LAST_FULL_SYNC_LABEL,
} from '../lib/healthSyncFeedback';
import { useAchievements } from '../hooks/useAchievements';
import { usePremium } from '../hooks/usePremium';
import { useLeague } from '../hooks/useLeague';
import UpgradeModal from '../components/UpgradeModal';
import { LEAGUE_TIER_META } from '../types/database';
import type { LeagueTier } from '../types/database';
import { scheduleStreakReminder, cancelStreakReminders } from '../lib/streakNotification';
import { format, subDays } from 'date-fns';
import { C, HIT, R } from '../theme';
import ActivityHeatmap from '../components/profile/ActivityHeatmap';
import AchievementsGrid from '../components/profile/AchievementsGrid';
import type { AppNavigationProp } from '../navigation/types';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const { streak, freezeCredits, frozenToday, freezeStreak } = useStreaks(profile?.id ?? '');
  const { myChallenges } = useFitnessChallenges(profile?.id ?? '');
  const { connections, syncing, syncNow, showBatteryWarning, lastSynced } = useHealthSync(profile?.id ?? '');
  const { achievements } = useAchievements(profile?.id ?? '');
  const { isPro, offering, purchase, restore } = usePremium(profile?.id ?? '');
  const { myTier } = useLeague(profile?.id ?? '');

  // Account generation for manual-sync Alerts: bumped synchronously (layout
  // effect) on account change and on unmount, so a result that resolves after
  // A -> B, A -> B -> A or unmount is never shown. Captured per invocation.
  const syncGeneration = useRef(0);
  useLayoutEffect(() => {
    syncGeneration.current += 1;
    return () => { syncGeneration.current += 1; };
  }, [profile?.id]);

  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [totalWorkouts, setTotalWorkouts] = useState(0);

  const [refreshing, setRefreshing] = useState(false);
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [statsError, setStatsError] = useState(false);
  const [streakReminderOn, setStreakReminderOn] = useState(true);

  async function fetchStats() {
    if (!profile?.id) return;
    const { count, error } = await supabase
      .from('workout_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id);
    if (error) { setStatsError(true); return; }
    setTotalWorkouts(count ?? 0);
  }

  const fetchHeatmap = useCallback(async () => {
    if (!profile?.id) return;
    const since = format(subDays(new Date(), 90), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('workout_posts')
      .select('workout_date')
      .eq('user_id', profile.id)
      .gte('workout_date', since);
    if (error) { setStatsError(true); return; }
    const map = new Map<string, number>();
    for (const { workout_date } of (data ?? [])) {
      const key = workout_date.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    setHeatmapData(map);
  }, [profile?.id]);

  function retryStats() {
    setStatsError(false);
    fetchStats();
    fetchHeatmap();
  }

  async function loadNotifPrefs() {
    if (!profile?.id) return;
    const stored = await AsyncStorage.getItem(`notif_prefs_${profile.id}`);
    if (stored) {
      try { setStreakReminderOn(JSON.parse(stored).streakReminder ?? true); } catch {}
    }
  }

  async function toggleStreakReminder() {
    const next = !streakReminderOn;
    setStreakReminderOn(next);
    await AsyncStorage.setItem(`notif_prefs_${profile!.id}`, JSON.stringify({ streakReminder: next }));
    if (!next) {
      await cancelStreakReminders();
    } else {
      const { data: streakData } = await supabase
        .from('user_streaks')
        .select('current_streak, last_active_date')
        .eq('user_id', profile!.id)
        .single();
      const firstName = profile?.full_name?.split(' ')[0] ?? profile?.username;
      scheduleStreakReminder(
        streakData?.current_streak ?? 0,
        streakData?.last_active_date,
        firstName
      ).catch(() => {});
    }
  }

  useEffect(() => { fetchStats(); fetchHeatmap(); loadNotifPrefs(); }, [profile?.id]);

  async function onRefresh() {
    setRefreshing(true);
    setStatsError(false);
    await Promise.all([fetchStats(), fetchHeatmap()]);
    setRefreshing(false);
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  async function handleSyncNow() {
    const generation = syncGeneration.current;
    try {
      const count = await syncNow();
      if (generation !== syncGeneration.current) return;
      const feedback = formatSyncSuccess(count);
      Alert.alert(feedback.title, feedback.message);
    } catch (error) {
      if (generation !== syncGeneration.current) return;
      const feedback = formatSyncError(error);
      Alert.alert(feedback.title, feedback.message);
    }
  }

  const connectedSources = connections.filter(c => c.is_active);
  const initials = (profile?.full_name ?? profile?.username ?? '?')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];
  const leagueTierLabel = tierMeta?.label ?? (isPro ? 'Gold' : 'Bronze');

  const statCells = [
    { label: 'Competition points', value: (profile?.total_points ?? 0).toLocaleString() },
    { label: 'Workouts logged',    value: totalWorkouts.toLocaleString() },
    { label: 'Challenges joined',  value: myChallenges.length.toLocaleString() },
    { label: 'Competition streak', value: (streak?.current_streak ?? 0).toLocaleString() },
  ];
  const statusLabel = (status: string) => (status === 'active' ? 'Active' : status === 'upcoming' ? 'Upcoming' : 'Completed');

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        <View style={s.identity}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.identityText}>
            <Text style={s.fullName} numberOfLines={2} accessibilityRole="header">{profile?.full_name ?? profile?.username}</Text>
            <Text style={s.username}>@{profile?.username}</Text>
            <View style={s.tagRow}>
              <View style={s.tag}>
                <Text style={s.tagText}>{leagueTierLabel} League</Text>
              </View>
              {isPro && (
                <View style={s.tag}>
                  <Text style={s.tagText}>Pro</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => Alert.alert('Edit profile', 'Profile editing is not available yet.')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            accessibilityHint="Not available yet"
          >
            <Text style={s.secondaryBtnText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => Alert.alert('Edit photo', 'Photo upload is not available yet.')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile photo"
            accessibilityHint="Not available yet"
          >
            <Text style={s.secondaryBtnText}>Photo</Text>
          </TouchableOpacity>
          {!isPro && (
            <TouchableOpacity
              style={s.linkBtn}
              onPress={() => setUpgradeVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Pro"
            >
              <Text style={s.linkBtnText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          )}
        </View>

        <UpgradeModal
          visible={upgradeVisible}
          onClose={() => setUpgradeVisible(false)}
          offering={offering}
          onPurchase={purchase}
          onRestore={restore}
        />

        <Text style={s.sectionLabel} accessibilityRole="header">Competition stats</Text>
        <Text style={s.sectionCaption}>
          Based on workouts you log and share in challenges. Private Health Connect activity is separate and not included here.
        </Text>
        {statsError && (
          <TouchableOpacity style={s.inlineError} onPress={retryStats} accessibilityRole="button">
            <Text style={s.inlineErrorText}>Couldn't load your stats — tap to retry</Text>
          </TouchableOpacity>
        )}
        <View style={s.statsGrid}>
          {statCells.map(({ label, value }) => (
            <View key={label} style={s.statCard} accessible accessibilityLabel={`${label}: ${value}`}>
              <Text style={s.statValue}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionLabel} accessibilityRole="header">Competition activity · last 90 days</Text>
        <ActivityHeatmap heatmapData={heatmapData} />

        {streak && streak.current_streak > 0 && (
          <>
            <Text style={s.sectionLabel} accessibilityRole="header">Competition streak</Text>
            <View style={s.card}>
              <View style={s.streakRow}>
                <View style={s.streakItem}>
                  <Text style={s.streakNum}>{streak.current_streak}</Text>
                  <Text style={s.statLabel}>Current streak</Text>
                </View>
                <View style={s.streakDivider} />
                <View style={s.streakItem}>
                  <Text style={s.streakNum}>{streak.longest_streak}</Text>
                  <Text style={s.statLabel}>Best streak</Text>
                </View>
              </View>
              {isPro ? (
                <TouchableOpacity
                  style={[s.secondaryBtn, s.fullWidthBtn, (frozenToday || freezeCredits <= 0) && s.btnUsed]}
                  disabled={frozenToday || freezeCredits <= 0}
                  onPress={async () => {
                    const { success, message } = await freezeStreak();
                    Alert.alert(success ? 'Streak protected' : 'Could not protect', message);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={s.secondaryBtnText}>
                    {frozenToday
                      ? 'Protected today'
                      : freezeCredits <= 0
                      ? 'No freezes left this month'
                      : `Protect today (${freezeCredits} left)`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.secondaryBtn, s.fullWidthBtn]}
                  onPress={() => setUpgradeVisible(true)}
                  accessibilityRole="button"
                >
                  <Text style={s.secondaryBtnText}>Upgrade for streak freeze</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        <View style={s.sectionHeader}>
          <Text style={s.sectionLabelInline} accessibilityRole="header">Auto-sync</Text>
          <TouchableOpacity
            style={s.manageBtn}
            onPress={() => navigation.navigate('ConnectDevices')}
            accessibilityRole="button"
            accessibilityLabel="Manage connected devices"
          >
            <Text style={s.manageText}>Manage →</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.sectionCaption}>
          Imported Health Connect activity stays private and is not added to the competition stats above.
        </Text>

        {connectedSources.length > 0 ? (
          <View style={{ marginBottom: 24 }}>
            {showBatteryWarning && (
              <TouchableOpacity
                style={s.warningRow}
                onPress={() => {
                  Alert.alert(
                    STALE_SYNC_ALERT.title,
                    STALE_SYNC_ALERT.message,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Open Settings', onPress: () => Linking.openSettings() }
                    ]
                  );
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.warningTitle}>{STALE_SYNC_ROW.title}</Text>
                  <Text style={s.warningSub}>{STALE_SYNC_ROW.subtitle}</Text>
                </View>
              </TouchableOpacity>
            )}
            <View style={s.card}>
              <View style={s.syncLeft}>
                <View style={s.syncDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.syncTitle}>
                    {connectedSources.length} source{connectedSources.length !== 1 ? 's' : ''} connected
                  </Text>
                  <Text style={s.syncSub}>
                    {Platform.OS === 'android' ? LAST_FULL_SYNC_LABEL : 'Last synced'}: {lastSynced ? format(lastSynced, 'HH:mm') : 'Not verified this session'}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleSyncNow} disabled={syncing} style={s.syncNowBtn}>
                  <Text style={s.syncNowText}>{syncing ? '...' : 'Sync'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[s.card, s.connectBanner, { marginBottom: 24 }]} onPress={() => navigation.navigate('ConnectDevices')}>
            <View style={{ flex: 1 }}>
              <Text style={s.connectBannerTitle}>Connect your health apps</Text>
              <Text style={s.connectBannerSub}>Import activity automatically. It stays private to you.</Text>
            </View>
            <Text style={s.connectBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {myChallenges.length > 0 && (
          <>
            <Text style={s.sectionLabel} accessibilityRole="header">Recent challenges</Text>
            {myChallenges.slice(0, 5).map(c => (
              <View key={c.id} style={s.challengeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.challengeName} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.challengeMeta}>
                    {statusLabel(c.status)}
                    {c.my_rank != null ? `  ·  #${c.my_rank}` : ''}
                  </Text>
                </View>
                <Text style={s.challengeScore}>{c.my_score ?? 0} pts</Text>
              </View>
            ))}
            <View style={{ marginBottom: 24 }} />
          </>
        )}

        <AchievementsGrid achievements={achievements} />

        <Text style={s.sectionLabel} accessibilityRole="header">Notifications</Text>
        <View style={s.card}>
          <View style={s.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.notifLabel}>Streak reminder</Text>
              <Text style={s.notifDesc}>Daily reminder to keep your streak</Text>
            </View>
            <Switch
              value={streakReminderOn}
              onValueChange={toggleStreakReminder}
              accessibilityLabel="Streak reminder"
              trackColor={{ false: C.dimmed, true: C.primary + '99' }}
              thumbColor={streakReminderOn ? C.primary : C.muted}
            />
          </View>
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} accessibilityRole="button">
          <Text style={s.signOutBtnText}>Sign out</Text>
        </TouchableOpacity>

        <View style={s.legalRow}>
          <TouchableOpacity style={s.legalBtn} onPress={() => Linking.openURL('https://arnarjo.github.io/streakwar/privacy-policy.html')} accessibilityRole="link">
            <Text style={s.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.legalBtn} onPress={() => Linking.openURL('https://arnarjo.github.io/streakwar/terms-of-service.html')} accessibilityRole="link">
            <Text style={s.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 },
  inlineError: { backgroundColor: C.error + '1F', borderWidth: 1, borderColor: C.error + '4D', borderRadius: R.md, padding: 12, marginBottom: 10, alignItems: 'center', minHeight: HIT, justifyContent: 'center' },
  inlineErrorText: { color: C.error, fontSize: 13, fontWeight: '600' },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.dimmed, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: C.text },
  identityText: { flex: 1, gap: 2 },
  fullName: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  username: { fontSize: 14, fontWeight: '500', color: C.muted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { backgroundColor: C.dimmed, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '700', color: C.text, letterSpacing: 0.3 },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 20 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: HIT, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border, borderRadius: R.sm },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: C.text },
  fullWidthBtn: { alignSelf: 'stretch' },
  btnUsed: { opacity: 0.6 },
  linkBtn: { minHeight: HIT, justifyContent: 'center', paddingHorizontal: 8 },
  linkBtnText: { fontSize: 13, fontWeight: '700', color: C.primary },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  sectionLabelInline: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionCaption: { fontSize: 12, color: C.muted, lineHeight: 17, marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: HIT },
  manageBtn: { minHeight: HIT, justifyContent: 'center', paddingHorizontal: 4 },
  manageText: { color: C.text, fontSize: 13, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  statCard: { flexGrow: 1, flexBasis: '45%', backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: 14, gap: 2 },
  statValue: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: C.muted, fontWeight: '500' },

  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 14, marginBottom: 16, gap: 12 },
  streakRow: { flexDirection: 'row' },
  streakItem: { flex: 1, gap: 2 },
  streakNum: { fontSize: 32, fontWeight: '800', color: C.text },
  streakDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 16 },

  syncLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  syncTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  syncSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  syncNowBtn: { backgroundColor: C.primary, borderRadius: R.sm, paddingHorizontal: 16, minHeight: HIT, justifyContent: 'center' },
  syncNowText: { color: C.onPrimary, fontWeight: '800', fontSize: 13 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.error + '1F', borderWidth: 1, borderColor: C.error + '4D', borderRadius: R.md, padding: 14, marginBottom: 10, minHeight: HIT },
  warningTitle: { fontSize: 14, fontWeight: '700', color: C.error },
  warningSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  connectBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  connectBannerTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  connectBannerSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  connectBannerArrow: { fontSize: 18, color: C.text, fontWeight: '700' },

  challengeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 14, marginBottom: 6, gap: 12 },
  challengeName: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  challengeMeta: { fontSize: 12, color: C.muted },
  challengeScore: { fontSize: 16, fontWeight: '800', color: C.text },

  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT },
  notifLabel: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  notifDesc: { fontSize: 12, color: C.muted },

  signOutBtn: { borderWidth: 1, borderColor: C.error + '66', borderRadius: R.md, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  signOutBtnText: { color: C.error, fontSize: 15, fontWeight: '700' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 },
  legalBtn: { minHeight: HIT, justifyContent: 'center', paddingHorizontal: 8 },
  legalLink: { color: C.muted, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
});
