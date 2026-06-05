import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, Alert, Linking, Switch, Animated,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useStreaks } from '../hooks/useStreaks';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { useHealthSync } from '../hooks/useHealthSync';
import { useAchievements } from '../hooks/useAchievements';
import { usePremium } from '../hooks/usePremium';
import { useLeague } from '../hooks/useLeague';
import UpgradeModal from '../components/UpgradeModal';
import { ACHIEVEMENT_META, LEAGUE_TIER_META } from '../types/database';
import type { LeagueTier } from '../types/database';
import { scheduleStreakReminder, cancelStreakReminders } from '../lib/streakNotification';
import { format, subDays, startOfWeek } from 'date-fns';
import { C, S, R, F } from '../theme';


function seededRandom(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return Math.abs(s) / 0x7fffffff; }; }
function hashString(str: string) { let h = 0; for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; return Math.abs(h); }

function useCountUp(target: number, duration = 900): number {
  const [display, setDisplay] = React.useState(0);
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const listenerRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (target === 0) { animatedValue.setValue(0); setDisplay(0); return; }
    if (listenerRef.current) animatedValue.removeListener(listenerRef.current);
    animatedValue.setValue(0);
    listenerRef.current = animatedValue.addListener(({ value }) => {
      setDisplay(Math.round(value));
    });
    Animated.timing(animatedValue, {
      toValue: target,
      duration,
      useNativeDriver: false,
    }).start();
    return () => {
      if (listenerRef.current) {
        animatedValue.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [target, duration]);

  return display;
}

function ActivityHeatmap({ userId, heatmapData }: { userId: string; heatmapData: Map<string, number> }) {
  const weeks = 13;
  const days = 7;
  const dayLabels = ['M', '', 'W', '', 'F', '', 'S'];
  const today = new Date();
  const startMonday = startOfWeek(subDays(today, 12 * 7), { weekStartsOn: 1 });
  const cols = useMemo(() => {
    const result: Array<Array<boolean>> = [];
    for (let w = 0; w < weeks; w++) {
      const col: boolean[] = [];
      for (let d = 0; d < days; d++) {
        const date = subDays(new Date(startMonday), -(w * 7 + d));
        const dateStr = date > today ? '' : format(date, 'yyyy-MM-dd');
        col.push(dateStr ? (heatmapData.get(dateStr) ?? 0) > 0 : false);
      }
      result.push(col);
    }
    return result;
  }, [userId, heatmapData]);

  const hasData = heatmapData.size > 0;

  return (
    <View style={heat.container}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ marginRight: 4 }}>
          {dayLabels.map((d, i) => (
            <Text key={i} style={heat.dayLabel}>{d}</Text>
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: weeks }).map((_, wi) => (
            <View key={wi} style={{ flex: 1, gap: 3 }}>
              {Array.from({ length: days }).map((_, di) => (
                <View key={di} style={[heat.cell, { opacity: hasData ? (cols[wi]?.[di] ? 1 : 0.15) : 0.1 }]} />
              ))}
            </View>
          ))}
        </View>
      </View>
      {!hasData && (
        <Text style={heat.emptyText}>Start logging to build your history</Text>
      )}
      {hasData && (
        <View style={heat.legend}>
          <Text style={heat.legendText}>Less</Text>
          {[0.15, 0.35, 0.55, 0.75, 1].map((o, i) => (
            <View key={i} style={[heat.legendDot, { opacity: o }]} />
          ))}
          <Text style={heat.legendText}>More</Text>
        </View>
      )}
    </View>
  );
}

const heat = StyleSheet.create({
  container: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border },
  dayLabel: { height: 14, fontSize: 9, fontWeight: '600', color: C.muted, textAlignVertical: 'center' },
  cell: { aspectRatio: 1, borderRadius: 3, backgroundColor: C.primary },
  emptyText: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10, fontFamily: F.ui },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' },
  legendDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: C.primary },
  legendText: { fontSize: 10, color: C.muted },
});

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { streak, freezeCredits, frozenToday, freezeStreak } = useStreaks(profile?.id ?? '');
  const { myChallenges } = useFitnessChallenges(profile?.id ?? '');
  const { connections, syncing, syncNow, showBatteryWarning, lastSynced } = useHealthSync(profile?.id ?? '');
  const { achievements } = useAchievements(profile?.id ?? '');
  const { isPro, offering, purchase, restore } = usePremium(profile?.id ?? '');
  const { myTier } = useLeague(profile?.id ?? '');

  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [totalWorkouts, setTotalWorkouts] = useState(0);

  const animPoints    = useCountUp(profile?.total_points ?? 0);
  const animWorkouts  = useCountUp(totalWorkouts);
  const animChallenge = useCountUp(myChallenges.length);
  const animStreak    = useCountUp(streak?.current_streak ?? 0);
  const [refreshing, setRefreshing] = useState(false);
  const [heatmapData, setHeatmapData] = useState<Map<string, number>>(new Map());
  const [notifPrefs, setNotifPrefs] = useState({
    streakReminder: true,
    challengeUpdates: true,
    reactions: true,
    leagueAlerts: true,
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
    const stored = await SecureStore.getItemAsync(`notif_prefs_${profile.id}`);
    if (stored) {
      try { setNotifPrefs(p => ({ ...p, ...JSON.parse(stored) })); } catch {}
    }
  }

  async function toggleNotifPref(key: keyof typeof notifPrefs) {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    await SecureStore.setItemAsync(`notif_prefs_${profile!.id}`, JSON.stringify(updated));
    if (key === 'streakReminder') {
      if (!updated.streakReminder) {
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
  const initials = (profile?.full_name ?? profile?.username ?? '?')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];
  const leagueTierLabel = tierMeta?.label ?? (isPro ? 'Gold' : 'Bronze');

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <Text style={s.title}>Profile</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={s.settingsBtn}
          accessibilityLabel="Settings"
          accessibilityRole="button"
        >
          <Text style={s.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        <View style={s.identitySection}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={s.fullName}>{profile?.full_name ?? profile?.username}</Text>
          <Text style={s.username}>@{profile?.username}</Text>
          <View style={s.tagRow}>
            <View style={s.tierBadge}>
              <Text style={s.tierBadgeText}>{leagueTierLabel} League</Text>
            </View>
            {isPro && (
              <View style={s.proBadge}>
                <Text style={s.proBadgeText}>⚡ PRO</Text>
              </View>
            )}
          </View>
          {!isPro && (
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

        <Text style={s.sectionLabel}>Stats</Text>
        <View style={s.statsGrid}>
          {[
            { label: 'Total points',      value: animPoints.toLocaleString(),  icon: '⭐', color: C.primary },
            { label: 'Workouts logged',   value: animWorkouts,                  icon: '💪', color: C.text },
            { label: 'Challenges joined', value: animChallenge,                 icon: '🏆', color: C.text },
            { label: 'Streak days',       value: animStreak,                    icon: '🔥', color: C.text },
          ].map(({ label, value, icon, color }) => (
            <View
              key={label}
              style={s.statCard}
              accessible
              accessibilityLabel={`${value} ${label}`}
            >
              <Text style={s.statIcon}>{icon}</Text>
              <Text style={[s.statValue, { color }]}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionLabel}>Activity</Text>
        <ActivityHeatmap userId={profile?.id ?? 'anon'} heatmapData={heatmapData} />

        {streak && streak.current_streak > 0 && (
          <>
            <Text style={s.sectionLabel}>Streak</Text>
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
              {isPro ? (
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
              ) : (
                <TouchableOpacity style={s.freezeBtn} onPress={() => setUpgradeVisible(true)}>
                  <Text style={s.freezeBtnText}>⚡ Upgrade for streak freeze</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>Auto-sync</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ConnectDevices')}>
            <Text style={s.editLink}>Manage →</Text>
          </TouchableOpacity>
        </View>

        {connectedSources.length > 0 ? (
          <View style={{ marginBottom: 24 }}>
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
          <TouchableOpacity
            style={[s.connectBanner, { marginBottom: 24 }]}
            onPress={() => navigation.navigate('ConnectDevices')}
            accessibilityLabel="Connect health devices"
            accessibilityRole="button"
          >
            <Text style={s.connectBannerEmoji}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.connectBannerTitle}>Connect your health apps</Text>
              <Text style={s.connectBannerSub}>Get points automatically without opening the app</Text>
            </View>
            <Text style={s.connectBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        <Text style={s.sectionLabel}>Recent challenges</Text>
        {myChallenges.length > 0 ? (
          <>
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
            <View style={{ marginBottom: 24 }} />
          </>
        ) : (
          <TouchableOpacity onPress={() => (navigation as any).navigate('Challenges')}>
            <Text style={s.emptyStateText}>Join a challenge to get started</Text>
          </TouchableOpacity>
        )}

        <Text style={s.sectionLabel}>Achievements</Text>
        {achievements.length > 0 ? (
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
        ) : (
          <Text style={s.emptyStateText}>Complete challenges to earn achievements</Text>
        )}

        <Text style={s.sectionLabel}>Notifications</Text>
        <View style={s.notifCard}>
          {([
            { key: 'streakReminder' as const, icon: '🔥', label: 'Streak reminder', desc: 'Daily reminder to keep your streak' },
            { key: 'challengeUpdates' as const, icon: '🏆', label: 'Challenge updates', desc: 'When challenges start or end' },
            { key: 'reactions' as const, icon: '💬', label: 'Reactions & comments', desc: 'When someone reacts to your workout' },
            { key: 'leagueAlerts' as const, icon: '🏅', label: 'League alerts', desc: 'Rank changes and league events' },
          ]).map(({ key, icon, label, desc }, i, arr) => (
            <View key={key} style={[s.notifRow, i < arr.length - 1 && s.notifRowBorder]}>
              <View style={s.notifIconBox}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
              </View>
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

        <TouchableOpacity
          style={s.signOutBtn}
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
        >
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S[5], paddingTop: S[3], paddingBottom: S[4] },
  title: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  settingsBtn: { padding: 4 },
  settingsIcon: { fontSize: 22 },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },

  identitySection: { alignItems: 'center', paddingVertical: S[6], gap: 6 },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primary + '20', borderWidth: 2, borderColor: C.primary + '40', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '900', color: C.primary },
  editAvatarBtn: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0C1117' },
  fullName: { fontSize: 26, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  username: { fontSize: 14, fontWeight: '500', color: C.muted },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tierBadge: { backgroundColor: '#FBBF2420', borderWidth: 1, borderColor: '#FBBF2440', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  tierBadgeText: { fontSize: 11, fontWeight: '700', color: '#FBBF24', letterSpacing: 0.5 },
  proBadge: { backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  proBadgeText: { fontSize: 11, fontWeight: '800', color: C.primary, letterSpacing: 1 },
  upgradeBtn: { backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 2 },
  upgradeBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },
  editProfileBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 8, marginTop: 4 },
  editProfileBtnText: { fontSize: 13, fontWeight: '600', color: C.text },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 11 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  editLink: { color: C.primary, fontSize: 13, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: S[3] + 2 },
  statIcon: { fontSize: 18, marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2 },

  streakCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: S[4], marginBottom: S[6], gap: S[3] },
  streakRow: { flexDirection: 'row' },
  streakItem: { flex: 1, alignItems: 'center', gap: 4 },
  streakNum: { fontSize: 32, fontWeight: '900', color: C.primary },
  streakLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  streakDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 16 },
  freezeBtn: { backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E40', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  freezeBtnUsed: { backgroundColor: 'transparent', borderColor: C.border },
  freezeBtnText: { fontSize: 13, fontWeight: '700', color: '#22C55E' },

  syncCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.green + '10', borderWidth: 1, borderColor: C.green + '30', borderRadius: 12, padding: 14, marginBottom: 8, gap: 10 },
  syncLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  syncTitle: { fontSize: 13, fontWeight: '700', color: C.green },
  syncSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  syncNowBtn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  syncNowText: { color: '#000', fontWeight: '800', fontSize: 12 },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.error + '12', borderWidth: 1, borderColor: C.error + '30', borderRadius: 14, padding: 14, marginBottom: 10 },
  warningEmoji: { fontSize: 24 },
  warningTitle: { fontSize: 14, fontWeight: '800', color: C.error },
  warningSub: { fontSize: 12, color: C.muted, marginTop: 2, fontWeight: '600' },
  connectBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.primary + '12', borderWidth: 1, borderColor: C.primary + '30', borderRadius: 12, padding: 14 },
  connectBannerEmoji: { fontSize: 24 },
  connectBannerTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  connectBannerSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  connectBannerArrow: { fontSize: 18, color: C.primary, fontWeight: '700' },

  challengeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 6, gap: 12 },
  challengeName: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  challengeMeta: { fontSize: 12, color: C.muted },
  challengeScore: { fontSize: 16, fontWeight: '800', color: C.primary },

  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  achievementCard: { width: '47%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: S[3] + 2, alignItems: 'center', gap: 4 },
  achievementIcon: { fontSize: 28 },
  achievementTitle: { fontSize: 13, fontWeight: '800', color: C.text, textAlign: 'center' },
  achievementDesc: { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 15 },

  notifCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, marginBottom: S[4], overflow: 'hidden' },
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S[4], paddingVertical: S[3] + 2, gap: S[3] },
  notifRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  notifIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  notifLabel: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  notifDesc: { fontSize: 12, color: C.muted },

  signOutBtn: { borderWidth: 1, borderColor: C.error + '40', borderRadius: R.md, paddingVertical: S[3] + 2, alignItems: 'center', marginTop: S[5] },
  signOutBtnText: { color: C.error, fontSize: 15, fontWeight: '700' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  legalLink: { color: C.muted, fontSize: 11, fontWeight: '600' },
  legalDot: { color: C.muted, fontSize: 11 },
  emptyStateText: { fontSize: 13, color: C.muted, marginBottom: S[6], fontFamily: F.ui },
});
