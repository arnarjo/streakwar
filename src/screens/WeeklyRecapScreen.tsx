import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { toLocalDate } from '../lib/dateUtils';
import { useAuth } from '../hooks/useAuth';
import { useStreaks } from '../hooks/useStreaks';
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_TIER_META } from '../types/database';
import type { LeagueTier } from '../types/database';

const C = {
  bg: '#0C1117', card: '#151C24', border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8', muted: '#637C8F', primary: '#F97316',
};

function getLastMonday(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) - 7);
  return toLocalDate(d);
}

function getCurrentMonday(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toLocalDate(d);
}

export default function WeeklyRecapScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isCurrentWeek = route.params?.week === 'current';

  const weekStart = isCurrentWeek ? getCurrentMonday() : getLastMonday();
  const weekEndStr = (() => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + 6);
    return toLocalDate(d);
  })();

  const { streak } = useStreaks(profile?.id ?? '');
  const { myTier, myRank, members } = useLeague(profile?.id ?? '');
  const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];

  const [workoutCount, setWorkoutCount] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [totalPts, setTotalPts] = useState(0);
  const [prevWorkouts, setPrevWorkouts] = useState(0);
  const [error, setError] = useState(false);

  async function load() {
    if (!profile?.id) return;
    try {
      const { data: workouts, error: workoutsError } = await supabase
        .from('workout_posts')
        .select('steps, duration_minutes, distance_km')
        .eq('user_id', profile!.id)
        .gte('workout_date', weekStart)
        .lte('workout_date', weekEndStr);

      if (workoutsError) { setError(true); return; }

      const count = workouts?.length ?? 0;
      setWorkoutCount(count);

      const steps = (workouts ?? []).reduce((s, w) => s + (w.steps ?? 0), 0);
      setTotalSteps(steps);

      const pts = (workouts ?? []).reduce((s, w) =>
        s + 1
        + Math.floor((w.steps ?? 0) / 1000)
        + Math.floor(w.distance_km ?? 0)
        + Math.floor((w.duration_minutes ?? 0) / 30), 0);
      setTotalPts(pts);

      const prevStart = new Date(weekStart);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(weekStart);
      prevEnd.setDate(prevEnd.getDate() - 1);

      const { count: prevCount, error: prevError } = await supabase
        .from('workout_posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile!.id)
        .gte('workout_date', prevStart.toISOString().slice(0, 10))
        .lte('workout_date', prevEnd.toISOString().slice(0, 10));

      if (prevError) { setError(true); return; }

      setPrevWorkouts(prevCount ?? 0);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    if (!profile?.id) return;
    load();
  }, [profile?.id, weekStart]);

  async function handleShare() {
    const diff = workoutCount - prevWorkouts;
    const diffText = diff > 0 ? `↑ ${diff} more than last week` : diff < 0 ? `↓ ${Math.abs(diff)} less than last week` : 'Same as last week';
    await Share.share({
      message:
        `My week on StreakWar 💪\n` +
        `${workoutCount} workouts · ${totalSteps.toLocaleString()} steps\n` +
        `🔥 ${streak?.current_streak ?? 0}-day streak\n` +
        `${tierMeta?.emoji} #${myRank} in ${tierMeta?.label} League\n` +
        `+${totalPts} pts this week · ${diffText}\n\n` +
        `Join me on StreakWar!`,
    });
  }

  const workoutDiff = workoutCount - prevWorkouts;

  function getWeeklyHeadline(): string {
    const diff = workoutCount - prevWorkouts;
    if (workoutCount === 0) return "Tough week — bounce back! 💪";
    if (workoutCount >= 5) return "Incredible week! 🔥 You're on fire!";
    if (diff >= 2) return "You crushed it this week! 🚀";
    if (diff >= 0) return "Solid week — keep it up! 💪";
    return "Tough week — you'll come back stronger! 💪";
  }

  if (error) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#9CA3AF', fontSize: 16, marginBottom: 16, textAlign: 'center' }}>
        Could not load your weekly recap. Check your connection and try again.
      </Text>
      <TouchableOpacity onPress={() => { setError(false); load(); }} style={{ backgroundColor: '#22C55E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Weekly Recap</Text>
        <TouchableOpacity onPress={handleShare}>
          <Text style={s.shareBtn}>📤 Share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.heroSection}>
          <Text style={s.heroHeadline}>{getWeeklyHeadline()}</Text>
          <Text style={s.heroSub}>
            Week of {new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' — '}{new Date(`${weekEndStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        <View style={[s.leagueCard, { borderColor: (tierMeta?.color ?? '#B45309') + '40' }]}>
          <Text style={[s.leagueTier, { color: tierMeta?.color ?? '#B45309' }]}>
            {tierMeta?.emoji} {tierMeta?.label} League
          </Text>
          <Text style={s.leagueRank}>#{myRank ?? '—'} of {members.length}</Text>
          <Text style={s.leagueSub}>Top 5 get promoted next week</Text>
        </View>

        <View style={s.statsGrid}>
          {[
            { icon: '💪', value: workoutCount, label: 'Workouts',
              sub: workoutDiff > 0 ? `↑ ${workoutDiff} vs last week` : workoutDiff < 0 ? `↓ ${Math.abs(workoutDiff)} vs last week` : '= last week',
              subColor: workoutDiff > 0 ? '#22C55E' : workoutDiff < 0 ? '#EF4444' : C.muted,
            },
            { icon: '👟', value: totalSteps.toLocaleString(), label: 'Steps', sub: '', subColor: C.muted },
            { icon: '⭐', value: `+${totalPts}`, label: 'Points', sub: 'earned this week', subColor: C.muted },
            { icon: '🔥', value: streak?.current_streak ?? 0, label: 'Streak', sub: `${streak?.longest_streak ?? 0} day best`, subColor: C.muted },
          ].map(({ icon, value, label, sub, subColor }) => (
            <View key={label} style={s.statCard}>
              <Text style={s.statIcon}>{icon}</Text>
              <Text style={s.statValue}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
              {sub ? <Text style={[s.statSub, { color: subColor }]}>{sub}</Text> : null}
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.shareCard} onPress={handleShare} activeOpacity={0.85}>
          <Text style={s.shareCardTitle}>Share your week 📤</Text>
          <Text style={s.shareCardSub}>Show your friends what you achieved</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  back: { color: C.muted, fontSize: 14, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '800', color: C.text },
  shareBtn: { color: C.primary, fontSize: 14, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 80, gap: 16 },
  leagueCard: { borderWidth: 2, borderRadius: 16, padding: 20, alignItems: 'center', gap: 6, backgroundColor: C.card },
  leagueTier: { fontSize: 22, fontWeight: '900' },
  leagueRank: { fontSize: 32, fontWeight: '900', color: C.text },
  leagueSub: { fontSize: 12, color: C.muted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  statIcon: { fontSize: 24 },
  statValue: { fontSize: 30, fontWeight: '900', color: C.text },
  statLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  statSub: { fontSize: 10, color: C.muted, textAlign: 'center' },
  heroSection:   { alignItems: 'center', paddingBottom: 4 },
  heroHeadline:  { fontSize: 26, fontWeight: '900', color: C.text, textAlign: 'center', lineHeight: 32 },
  heroSub:       { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'center' },
  shareCard: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 18, alignItems: 'center', gap: 4, marginTop: 8 },
  shareCardTitle: { color: '#000', fontSize: 16, fontWeight: '800' },
  shareCardSub: { color: '#00000080', fontSize: 12 },
});
