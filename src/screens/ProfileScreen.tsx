import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, Alert, Linking, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useStreaks } from '../hooks/useStreaks';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { useHealthSync } from '../hooks/useHealthSync';
import { useAchievements } from '../hooks/useAchievements';
import { usePremium } from '../hooks/usePremium';
import UpgradeModal from '../components/UpgradeModal';
import { ACHIEVEMENT_META } from '../types/database';
import { scheduleStreakReminder } from '../lib/streakNotification';
import { format, subDays, startOfWeek } from 'date-fns';

const C = {
  bg: '#0C1117', card: '#151C24', border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8', muted: '#4A6070', primary: '#F97316', green: '#22C55E', error: '#EF4444',
};

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const { streak, freezeCredits, frozenToday, freezeStreak } = useStreaks(profile?.id ?? '');
  const { myChallenges } = useFitnessChallenges(profile?.id ?? '');
  const {
    connections, syncing, syncNow, nativeProvider,
    showBatteryWarning, lastSynced
  } = useHealthSync(profile?.id ?? '');
  const { achievements } = useAchievements(profile?.id ?? '');

  const { isPro, loading: premiumLoading, offering, purchase, restore } = usePremium(profile?.id ?? '');
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [notifPrefs, setNotifPrefs] = useState({
    streakReminder: true,
    challengeUpdates: true,
    reactions: true,
  });

  async function fetchStats() {
    if (!profile?.id) return;
    const { count } = await supabase
      .from('workout_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id);
    setTotalWorkouts(count ?? 0);
  }


  const fetchHeatmap = useCallback(async () => {
    if (!profile?.id) return;
    const since = format(subDays(new Date(), 90), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('workout_posts')
      .select('workout_date')
      .eq('user_id', profile.id)
      .gte('workout_date', since);
    const map = new Map<string, number>();
    for (const { workout_date } of (data ?? [])) {
      const key = workout_date.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    setHeatmapData(map);
  }, [profile?.id]);

  async function loadNotifPrefs() {
    if (!profile?.id) return;
    const stored = await AsyncStorage.getItem(`notif_prefs_${profile.id}`);
    if (stored) {
      try { setNotifPrefs(JSON.parse(stored)); } catch {}
    }
  }

  async function toggleNotifPref(key: keyof typeof notifPrefs) {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    await AsyncStorage.setItem(`notif_prefs_${profile!.id}`, JSON.stringify(updated));
    if (key === 'streakReminder') {
      if (!updated.streakReminder) {
        await Notifications.cancelAllScheduledNotificationsAsync();
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
  }

  useEffect(() => { fetchStats(); fetchHeatmap(); loadNotifPrefs(); }, [profile?.id]);

  async function onRefresh() {
    setRefreshing(true);
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
    const count = await syncNow();
    Alert.alert(
      count > 0 ? 'Sync complete' : 'Nothing new',
      count > 0 ? `${count} new workout${count !== 1 ? 's' : ''} imported.` : 'No new activities found.'
    );
  }

  const connectedSources = connections.filter(c => c.is_active);
  const completedChallenges = myChallenges.filter(c => c.status === 'completed').length;
  const wonChallenges = myChallenges.filter(c => c.status === 'completed' && c.my_rank === 1).length;
  const initials = (profile?.full_name ?? profile?.username ?? '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <Text style={s.title}>Profile</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* Avatar */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.fullName}>{profile?.full_name ?? profile?.username}</Text>
          <Text style={s.username}>@{profile?.username}</Text>
          {isPro ? (
            <View style={s.proBadge}>
              <Text style={s.proBadgeText}>⚡ PRO</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.upgradeBtn} onPress={() => setUpgradeVisible(true)}>
              <Text style={s.upgradeBtnText}>Upgrade to Pro →</Text>
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

        {/* Streak */}
        {streak && (
          <View style={s.streakCard}>
            <View style={s.streakRow}>
              <View style={s.streakItem}>
                <Text style={s.streakNum}>{streak.current_streak}</Text>
                <Text style={s.streakLabel}>🔥 Current streak</Text>
              </View>
              <View style={s.streakDivider} />
              <View style={s.streakItem}>
                <Text style={s.streakNum}>{streak.longest_streak}</Text>
                <Text style={s.streakLabel}>⚡ Best streak</Text>
              </View>
            </View>
            {isPro && streak.current_streak > 0 && (
              <TouchableOpacity
                style={[s.freezeBtn, (frozenToday || freezeCredits <= 0) && s.freezeBtnUsed]}
                disabled={frozenToday || freezeCredits <= 0}
                onPress={async () => {
                  const { success, message } = await freezeStreak();
                  Alert.alert(success ? '🛡️ Streak protected!' : 'Could not protect', message);
                }}
              >
                <Text style={s.freezeBtnText}>
                  {frozenToday
                    ? '🛡️ Protected today'
                    : freezeCredits <= 0
                    ? '🛡️ No freezes left this month'
                    : `🛡️ Protect today (${freezeCredits} left)`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Stats */}
        <Text style={s.sectionTitle}>Stats</Text>
        <View style={s.statsGrid}>
          {[
            { label: 'Total points', value: (profile?.total_points ?? 0).toLocaleString(), icon: '⭐' },
            { label: 'Workouts', value: totalWorkouts, icon: '💪' },
            { label: 'Challenges', value: myChallenges.length, icon: '🏆' },
            { label: 'Wins', value: wonChallenges, icon: '🥇' },
          ].map(({ label, value, icon }) => (
            <View key={label} style={s.statCard}>
              <Text style={s.statIcon}>{icon}</Text>
              <Text style={s.statValue}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Activity heatmap — 13 weeks, binary active/inactive per day */}
        {heatmapData.size > 0 && (() => {
          const today = new Date();
          const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
          const startMonday = startOfWeek(subDays(today, 12 * 7), { weekStartsOn: 1 });
          const cols: string[][] = [];
          for (let w = 0; w < 13; w++) {
            const days: string[] = [];
            for (let d = 0; d < 7; d++) {
              const date = subDays(new Date(startMonday), -(w * 7 + d));
              days.push(date > today ? '' : format(date, 'yyyy-MM-dd'));
            }
            cols.push(days);
          }
          return (
            <>
              <Text style={s.sectionTitle}>Activity</Text>
              <View style={s.heatmapCard}>
                <View style={s.heatmapGrid}>
                  {cols.map((days, wi) => (
                    <View key={wi} style={s.heatmapCol}>
                      {days.map((dateStr, di) => {
                        const active = dateStr ? (heatmapData.get(dateStr) ?? 0) > 0 : false;
                        return (
                          <View
                            key={di}
                            style={[s.heatmapCell, active && s.heatmapCellActive]}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
                <View style={s.heatmapLegend}>
                  {DAY_LABELS.map((l, i) => (
                    <Text key={i} style={s.heatmapDayLabel}>{l}</Text>
                  ))}
                </View>
              </View>
            </>
          );
        })()}

        {/* Auto-sync status */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Auto-sync</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ConnectDevices')}>
            <Text style={s.editLink}>Manage →</Text>
          </TouchableOpacity>
        </View>

        {connectedSources.length > 0 ? (
          <View>
            {showBatteryWarning && (
              <TouchableOpacity
                style={s.warningRow}
                onPress={() => {
                  Alert.alert(
                    'Background Sync Stale',
                    'Health Connect has not synced in over 30 minutes. Please disable battery optimization for StreakWar.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Open Settings', onPress: () => Linking.openSettings() }
                    ]
                  );
                }}
              >
                <Text style={s.warningEmoji}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.warningTitle}>Background sync delayed</Text>
                  <Text style={s.warningSub}>Tap to fix battery optimization →</Text>
                </View>
              </TouchableOpacity>
            )}
            <View style={s.syncCard}>
              <View style={s.syncLeft}>
                <View style={s.syncDot} />
                <View>
                  <Text style={s.syncTitle}>
                    {connectedSources.length} source{connectedSources.length !== 1 ? 's' : ''} connected
                  </Text>
                  <Text style={s.syncSub}>
                    Last synced: {lastSynced ? format(lastSynced, 'HH:mm') : 'Recently'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleSyncNow} disabled={syncing} style={s.syncNowBtn}>
                <Text style={s.syncNowText}>{syncing ? '...' : 'Sync'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={s.connectBanner} onPress={() => navigation.navigate('ConnectDevices')}>
            <Text style={s.connectBannerEmoji}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.connectBannerTitle}>Connect your health apps</Text>
              <Text style={s.connectBannerSub}>Get points automatically without opening the app</Text>
            </View>
            <Text style={s.connectBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Recent challenges */}
        {myChallenges.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 16 }]}>Recent challenges</Text>
            {myChallenges.slice(0, 5).map(c => (
              <View key={c.id} style={s.challengeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.challengeName} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.challengeMeta}>
                    {c.status === 'active' ? '🟢 Active' : c.status === 'upcoming' ? '🔵 Upcoming' : '⚫ Completed'}
                    {c.my_rank != null ? `  ·  #${c.my_rank}` : ''}
                  </Text>
                </View>
                <Text style={s.challengeScore}>{c.my_score ?? 0} pts</Text>
              </View>
            ))}
          </>
        )}

        {/* Achievements */}
        {achievements.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 16 }]}>Achievements</Text>
            <View style={s.achievementsGrid}>
              {achievements.map(a => {
                const meta = ACHIEVEMENT_META[a.achievement];
                if (!meta) return null;
                return (
                  <View key={a.id} style={s.achievementCard}>
                    <Text style={s.achievementIcon}>{meta.icon}</Text>
                    <Text style={s.achievementTitle}>{meta.title}</Text>
                    <Text style={s.achievementDesc}>{meta.desc}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Notification settings */}
        <Text style={[s.sectionTitle, { marginTop: 16 }]}>Notifications</Text>
        <View style={s.notifCard}>
          {([
            { key: 'streakReminder' as const, label: 'Streak reminder', desc: 'Daily reminder to keep your streak' },
            { key: 'challengeUpdates' as const, label: 'Challenge updates', desc: 'When challenges start or end' },
            { key: 'reactions' as const, label: 'Reactions & comments', desc: 'When someone reacts to your workout' },
          ]).map(({ key, label, desc }, i, arr) => (
            <View key={key} style={[s.notifRow, i < arr.length - 1 && s.notifRowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.notifLabel}>{label}</Text>
                <Text style={s.notifDesc}>{desc}</Text>
              </View>
              <Switch
                value={notifPrefs[key]}
                onValueChange={() => toggleNotifPref(key)}
                trackColor={{ false: C.border, true: C.primary + '99' }}
                thumbColor={notifPrefs[key] ? C.primary : C.muted}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutBtnText}>Sign out</Text>
        </TouchableOpacity>

        <View style={s.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL('https://arnarjo.github.io/streakwar/privacy-policy.html')}>
            <Text style={s.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={s.legalDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://arnarjo.github.io/streakwar/terms-of-service.html')}>
            <Text style={s.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  signOutText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  profileCard: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary + '20', borderWidth: 2, borderColor: C.primary + '40', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { fontSize: 28, fontWeight: '800', color: C.primary },
  fullName: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  username: { fontSize: 14, color: C.muted },
  proBadge: { backgroundColor: '#FBBF2420', borderWidth: 1, borderColor: '#FBBF2440', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 6 },
  proBadgeText: { fontSize: 11, fontWeight: '800', color: '#FBBF24', letterSpacing: 1.5 },
  upgradeBtn: { backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 6 },
  upgradeBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },
  streakCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 24, gap: 12 },
  streakRow: { flexDirection: 'row' },
  streakItem: { flex: 1, alignItems: 'center', gap: 4 },
  streakNum: { fontSize: 32, fontWeight: '900', color: C.primary },
  streakLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  streakDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 16 },
  freezeBtn: { backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E40', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  freezeBtnUsed: { backgroundColor: 'transparent', borderColor: C.border },
  freezeBtnText: { fontSize: 13, fontWeight: '700', color: '#22C55E' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 10, letterSpacing: -0.2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  editLink: { color: C.primary, fontSize: 13, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  statIcon: { fontSize: 24 },
  statValue: { fontSize: 24, fontWeight: '900', color: C.text },
  statLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  syncCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.green + '10', borderWidth: 1, borderColor: C.green + '30', borderRadius: 12, padding: 14, marginBottom: 8, gap: 10 },
  syncLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  syncTitle: { fontSize: 13, fontWeight: '700', color: C.green },
  syncSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  syncNowBtn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  syncNowText: { color: '#000', fontWeight: '800', fontSize: 12 },

  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.error + '12',
    borderWidth: 1,
    borderColor: C.error + '30',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  warningEmoji: { fontSize: 24 },
  warningTitle: { fontSize: 14, fontWeight: '800', color: C.error },
  warningSub: { fontSize: 12, color: C.muted, marginTop: 2, fontWeight: '600' },
  connectBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.primary + '12', borderWidth: 1, borderColor: C.primary + '30', borderRadius: 12, padding: 14, marginBottom: 8 },
  connectBannerEmoji: { fontSize: 24 },
  connectBannerTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  connectBannerSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  connectBannerArrow: { fontSize: 18, color: C.primary, fontWeight: '700' },
  challengeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 6, gap: 12 },
  challengeName: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  challengeMeta: { fontSize: 12, color: C.muted },
  challengeScore: { fontSize: 16, fontWeight: '800', color: C.primary },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  achievementCard: { width: '47%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  achievementIcon: { fontSize: 28 },
  achievementTitle: { fontSize: 13, fontWeight: '800', color: C.text, textAlign: 'center' },
  achievementDesc: { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 15 },
  signOutBtn: { borderWidth: 1, borderColor: C.error + '40', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  signOutBtnText: { color: C.error, fontSize: 15, fontWeight: '700' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  legalLink: { color: C.muted, fontSize: 11, fontWeight: '600' },
  legalDot: { color: C.muted, fontSize: 11 },

  heatmapCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 24, flexDirection: 'row', gap: 4 },
  heatmapGrid: { flexDirection: 'row', gap: 2, flex: 1 },
  heatmapCol: { flex: 1, gap: 2 },
  heatmapCell: { aspectRatio: 1, borderRadius: 2, backgroundColor: '#1E2A35' },
  heatmapCellActive: { backgroundColor: C.primary },
  heatmapLegend: { justifyContent: 'space-around', paddingLeft: 4 },
  heatmapDayLabel: { fontSize: 8, color: C.muted, fontWeight: '600', textAlign: 'center' },

  notifCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  notifRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  notifLabel: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  notifDesc: { fontSize: 12, color: C.muted },
});
