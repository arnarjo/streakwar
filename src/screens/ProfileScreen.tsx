import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useStreaks } from '../hooks/useStreaks';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { useHealthSync } from '../hooks/useHealthSync';
import { useAchievements } from '../hooks/useAchievements';
import { ACHIEVEMENT_META } from '../types/database';

const C = {
  bg: '#0C1117', card: '#151C24', border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8', muted: '#4A6070', primary: '#F97316', green: '#22C55E', error: '#EF4444',
};

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const { streak } = useStreaks(profile?.id ?? '');
  const { myChallenges } = useFitnessChallenges(profile?.id ?? '');
  const { connections, syncing, syncNow, nativeProvider } = useHealthSync(profile?.id ?? '');
  const { achievements } = useAchievements(profile?.id ?? '');

  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchStats() {
    if (!profile?.id) return;
    const { count } = await supabase
      .from('workout_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id);
    setTotalWorkouts(count ?? 0);
  }

  useEffect(() => { fetchStats(); }, [profile?.id]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchStats();
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
        </View>

        {/* Streak */}
        {streak && (
          <View style={s.streakCard}>
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

        {/* Auto-sync status */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Auto-sync</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ConnectDevices')}>
            <Text style={s.editLink}>Manage →</Text>
          </TouchableOpacity>
        </View>

        {connectedSources.length > 0 ? (
          <View style={s.syncCard}>
            <View style={s.syncLeft}>
              <View style={s.syncDot} />
              <View>
                <Text style={s.syncTitle}>
                  {connectedSources.length} source{connectedSources.length !== 1 ? 's' : ''} connected
                </Text>
                <Text style={s.syncSub}>Workouts sync automatically in the background</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleSyncNow} disabled={syncing} style={s.syncNowBtn}>
              <Text style={s.syncNowText}>{syncing ? '...' : 'Sync'}</Text>
            </TouchableOpacity>
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

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutBtnText}>Sign out</Text>
        </TouchableOpacity>
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
  streakCard: { flexDirection: 'row', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 24 },
  streakItem: { flex: 1, alignItems: 'center', gap: 4 },
  streakNum: { fontSize: 32, fontWeight: '900', color: C.primary },
  streakLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  streakDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 16 },
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
});
