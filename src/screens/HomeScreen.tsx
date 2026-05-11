import React, { useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useWorkoutFeed } from '../hooks/useWorkoutFeed';
import { useStreaks } from '../hooks/useStreaks';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_TIER_META } from '../types/database';
import type { WorkoutComment, LeagueTier } from '../types/database';
import WorkoutPostCard from '../components/WorkoutPostCard';
import ChallengeCard from '../components/ChallengeCard';
import StreakMilestoneCard from '../components/StreakMilestoneCard';
import type { MilestoneItem } from '../components/StreakMilestoneCard';
import { Share } from 'react-native';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#0C1117', card: '#151C24', border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8', muted: '#4A6070', primary: '#F97316',
};

export default function HomeScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const { feed, loading, fetchFeed, toggleReaction, fetchComments, addComment, deleteWorkout } = useWorkoutFeed(profile?.id ?? '');
  const { myChallenges, refresh: refreshChallenges } = useFitnessChallenges(profile?.id ?? '');
  const { streak } = useStreaks(profile?.id ?? '');
  const { rival, rivalDiff, fetchWeekly } = useLeaderboard(profile?.id ?? '');
  const { myTier, myRank, members: leagueMembers } = useLeague(profile?.id ?? '');
  const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];
  const daysUntilSunday = (() => {
    const d = new Date().getDay(); // 0=Sun
    return d === 0 ? 7 : 7 - d;
  })();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [milestones, setMilestones] = React.useState<MilestoneItem[]>([]);

  async function fetchMilestones() {
    if (!profile?.id) return;
    const { data: parts } = await supabase
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_id', profile.id);
    if (!parts || parts.length === 0) return;

    const { data: peers } = await supabase
      .from('challenge_participants')
      .select('user_id')
      .in('challenge_id', parts.map(p => p.challenge_id))
      .neq('user_id', profile.id);

    if (!peers || peers.length === 0) return;
    const peerIds = [...new Set(peers.map(p => p.user_id))];

    const { data } = await supabase
      .from('streak_milestones')
      .select('*, profile:profiles(id, username, full_name)')
      .in('user_id', peerIds)
      .gte('achieved_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .order('achieved_at', { ascending: false })
      .limit(5);

    if (!data) return;

    const milestoneIds = data.map((m: any) => m.id);
    const { data: allReactions } = await supabase
      .from('milestone_reactions')
      .select('milestone_id, reaction, user_id')
      .in('milestone_id', milestoneIds);

    const reactionsByMilestone = new Map<string, { counts: Record<string, number>; myReaction: string | null }>();
    for (const r of allReactions ?? []) {
      if (!reactionsByMilestone.has(r.milestone_id)) {
        reactionsByMilestone.set(r.milestone_id, { counts: {}, myReaction: null });
      }
      const entry = reactionsByMilestone.get(r.milestone_id)!;
      entry.counts[r.reaction] = (entry.counts[r.reaction] ?? 0) + 1;
      if (r.user_id === profile.id) entry.myReaction = r.reaction;
    }

    setMilestones(data.map((m: any) => {
      const r = reactionsByMilestone.get(m.id);
      return { ...m, reaction_counts: r?.counts ?? {}, my_reaction: r?.myReaction ?? null };
    }));
  }

  async function handleShare() {
    await Share.share({
      message:
        `🔥 ${streak?.current_streak ?? 0}-day streak on StreakWar!\n` +
        `⭐ ${(profile?.total_points ?? 0).toLocaleString()} total points\n` +
        `\nCan you beat me? Download StreakWar 💪`,
    });
  }

  useEffect(() => {
    fetchFeed();
    fetchWeekly();
    fetchMilestones();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const onRefresh = useCallback(async () => {
    await Promise.all([fetchFeed(), refreshChallenges(), fetchWeekly(), fetchMilestones()]);
  }, [fetchFeed, refreshChallenges, fetchWeekly]);

  const activeChallenges = myChallenges.filter(c => c.status === 'active').slice(0, 3);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <View>
          <Text style={s.greeting}>
            Hey{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 👋
          </Text>
          <Text style={s.subGreeting}>What's your workout today?</Text>
        </View>
        <View style={s.headerRight}>
          {(profile?.total_points ?? 0) > 0 && (
            <TouchableOpacity
              style={s.rankBadge}
              onPress={() => navigation.navigate('Leaderboard')}
            >
              <Text style={s.rankPts}>{(profile!.total_points).toLocaleString()}</Text>
              <Text style={s.rankLabel}>pts  ⭐</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.logBtn} onPress={() => navigation.navigate('LogWorkout')}>
            <Text style={s.logBtnText}>+ Log</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={feed}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.primary} />}
          ListHeaderComponent={
            <>
              {streak && streak.current_streak > 0 && (
                <TouchableOpacity style={s.streakBanner} onPress={handleShare} activeOpacity={0.85}>
                  <Text style={s.streakFire}>🔥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.streakCount}>{streak.current_streak}-day streak</Text>
                    <Text style={s.streakSub}>Best streak: {streak.longest_streak} days</Text>
                  </View>
                  <Text style={s.streakShare}>📤</Text>
                </TouchableOpacity>
              )}

              {leagueMembers.length > 0 && myRank !== null && (
                <TouchableOpacity
                  style={s.leagueBanner}
                  onPress={() => navigation.navigate('Leaderboard')}
                  activeOpacity={0.85}
                >
                  <Text style={s.leagueBannerEmoji}>{tierMeta?.emoji ?? '🥉'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.leagueBannerTitle, { color: tierMeta?.color ?? '#B45309' }]}>
                      #{myRank} in {tierMeta?.label} League
                    </Text>
                    <Text style={s.leagueBannerSub}>
                      {daysUntilSunday} day{daysUntilSunday !== 1 ? 's' : ''} left · {leagueMembers.length} competitors
                    </Text>
                  </View>
                  <Text style={s.leagueBannerArrow}>→</Text>
                </TouchableOpacity>
              )}

              {rival && (
                <TouchableOpacity
                  style={s.rivalBanner}
                  onPress={() => navigation.navigate('Leaderboard')}
                  activeOpacity={0.85}
                >
                  <Text style={s.rivalEmoji}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rivalTitle}>
                      {rival.full_name ?? rival.username} er {rivalDiff} {rivalDiff === 1 ? 'stigi' : 'stigum'} á undan þér
                    </Text>
                    <Text style={s.rivalSub}>Sjá leaderboard →</Text>
                  </View>
                </TouchableOpacity>
              )}

              {activeChallenges.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Active challenges</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Challenges')}>
                      <Text style={s.seeAll}>See all →</Text>
                    </TouchableOpacity>
                  </View>
                  {activeChallenges.map(c => (
                    <ChallengeCard
                      key={c.id}
                      challenge={c}
                      onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}
                    />
                  ))}
                </View>
              )}

              {milestones.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>🏅 Streak milestones</Text>
                  {milestones.map(m => (
                    <StreakMilestoneCard key={m.id} item={m} currentUserId={profile?.id ?? ''} />
                  ))}
                </View>
              )}

              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Feed</Text>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <WorkoutPostCard
              post={item}
              currentUserId={profile?.id}
              onReact={toggleReaction}
              onFetchComments={(id: string): Promise<WorkoutComment[]> => fetchComments(id)}
              onAddComment={(id: string, text: string) => addComment(id, text)}
              onEdit={(post) => navigation.navigate('LogWorkout', { editWorkout: post })}
              onDelete={(postId) => deleteWorkout(postId)}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <Text style={s.emptyEmoji}>🏃</Text>
                <Text style={s.emptyTitle}>Feed is empty</Text>
                <Text style={s.emptyText}>
                  Join a challenge and start logging workouts to see what your friends are up to.
                </Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Challenges')}>
                  <Text style={s.emptyBtnText}>Discover challenges</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  greeting: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  subGreeting: { fontSize: 13, color: C.muted, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBadge: { backgroundColor: '#151C24', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  rankPts: { fontSize: 13, fontWeight: '900', color: C.primary },
  rankLabel: { fontSize: 9, color: C.muted, fontWeight: '600' },
  logBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  logBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  streakBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.primary + '15', borderWidth: 1, borderColor: C.primary + '30', borderRadius: 14, padding: 14, marginBottom: 10 },
  streakFire: { fontSize: 32 },
  streakCount: { fontSize: 16, fontWeight: '800', color: C.primary },
  streakSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  streakShare: { fontSize: 18 },
  rivalBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E1428', borderWidth: 1, borderColor: '#7C3AED40', borderRadius: 14, padding: 14, marginBottom: 16 },
  rivalEmoji: { fontSize: 28 },
  rivalTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  rivalSub: { fontSize: 12, color: '#7C3AED', marginTop: 2, fontWeight: '600' },
  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  seeAll: { fontSize: 13, color: C.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  leagueBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1C1828', borderWidth: 1, borderColor: '#7C3AED30', borderRadius: 14, padding: 14, marginBottom: 10 },
  leagueBannerEmoji: { fontSize: 28 },
  leagueBannerTitle: { fontSize: 15, fontWeight: '800' },
  leagueBannerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  leagueBannerArrow: { fontSize: 18, color: '#7C3AED', fontWeight: '700' },
});
