import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, StatusBar, Animated as RNAnimated,
} from 'react-native';
import ReAnimated, {
  useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle, cancelAnimation,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useWorkoutFeed } from '../hooks/useWorkoutFeed';
import { useStreaks } from '../hooks/useStreaks';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_TIER_META } from '../types/database';
import type { WorkoutComment, WorkoutPost, LeagueTier } from '../types/database';
import WorkoutPostCard from '../components/WorkoutPostCard';
import ChallengeCard from '../components/ChallengeCard';
import StreakMilestoneCard from '../components/StreakMilestoneCard';
import type { MilestoneItem } from '../components/StreakMilestoneCard';
import { WorkoutPostSkeleton } from '../components/SkeletonPulse';
import { Share } from 'react-native';
import { supabase } from '../lib/supabase';
import { C, S, R, FS } from '../theme';

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
    const d = new Date().getDay();
    return d === 0 ? 0 : 7 - d;
  })();
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const [milestones, setMilestones] = React.useState<MilestoneItem[]>([]);

  const streakGlowOpacity = useSharedValue(0.06);
  useFocusEffect(useCallback(() => {
    streakGlowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.18, { duration: 1800 }),
        withTiming(0.06, { duration: 1800 }),
      ),
      -1,
      false,
    );
    return () => { cancelAnimation(streakGlowOpacity); };
  }, [streakGlowOpacity]));
  const streakGlowStyle = useAnimatedStyle(() => ({
    opacity: streakGlowOpacity.value,
  }));

  const fetchMilestones = useCallback(async () => {
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
  }, [profile?.id]);

  const handleShare = useCallback(async () => {
    await Share.share({
      message:
        `🔥 ${streak?.current_streak ?? 0}-day streak on StreakWar!\n` +
        `⭐ ${(profile?.total_points ?? 0).toLocaleString()} total points\n` +
        `\nCan you beat me? Download StreakWar 💪`,
    });
  }, [streak, profile]);

  useEffect(() => {
    fetchFeed();
    fetchWeekly();
    fetchMilestones();
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fetchMilestones, fetchFeed, fetchWeekly]);

  const handleMilestoneReact = useCallback(async (milestoneId: string, emoji: string) => {
    try {
      await supabase.from('milestone_reactions')
        .upsert({ milestone_id: milestoneId, user_id: profile?.id, reaction: emoji },
          { onConflict: 'milestone_id,user_id' });
    } catch (err) {
      console.warn('[HomeScreen] react failed:', err);
    }
  }, [profile?.id]);

  const handleMilestoneRemoveReact = useCallback(async (milestoneId: string, _emoji: string) => {
    try {
      await supabase.from('milestone_reactions')
        .delete()
        .eq('milestone_id', milestoneId)
        .eq('user_id', profile?.id);
    } catch (err) {
      console.warn('[HomeScreen] remove react failed:', err);
    }
  }, [profile?.id]);

  const onRefresh = useCallback(async () => {
    await Promise.all([fetchFeed(), refreshChallenges(), fetchWeekly(), fetchMilestones()]);
  }, [fetchFeed, refreshChallenges, fetchWeekly, fetchMilestones]);

  const activeChallenges = myChallenges.filter(c => c.status === 'active').slice(0, 3);

  const renderFeedItem = useCallback(({ item }: { item: WorkoutPost }) => (
    <WorkoutPostCard
      post={item}
      currentUserId={profile?.id}
      onReact={toggleReaction}
      onFetchComments={(id: string): Promise<WorkoutComment[]> => fetchComments(id)}
      onAddComment={(id: string, text: string) => addComment(id, text)}
      onEdit={(post) => navigation.navigate('LogWorkout', { editWorkout: post })}
      onDelete={(postId) => deleteWorkout(postId)}
    />
  ), [profile?.id, toggleReaction, fetchComments, addComment, navigation, deleteWorkout]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Profile' as never)}>
          <View style={s.headerAvatar}>
            <Text style={s.headerAvatarText}>
              {profile?.full_name?.split(' ').filter(Boolean).map((w: string) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() ?? '?'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.greeting}>
            Hey, {profile?.full_name?.split(' ')[0] ?? 'there'}!
          </Text>
          <Text style={s.subGreeting}>Ready to move today?</Text>
        </View>

        <View style={s.headerRight}>
          {(profile?.total_points ?? 0) > 0 && (
            <TouchableOpacity style={s.rankBadge} onPress={() => navigation.navigate('Leaderboard' as never)}>
              <Text style={s.rankPts}>⭐ {(profile?.total_points ?? 0).toLocaleString()}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.logBtn} onPress={() => navigation.navigate('LogWorkout' as never)} accessibilityLabel="Log a workout" accessibilityRole="button">
            <Text style={s.logBtnText}>+ Log</Text>
          </TouchableOpacity>
        </View>
      </View>

      <RNAnimated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={feed}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.primary} />}
          ListHeaderComponent={useMemo(() => (
            <>
              {streak && streak.current_streak > 0 && (() => {
                const remainder = streak.current_streak % 10;
                const toNext = remainder === 0 ? 10 : 10 - remainder;
                const milestone = remainder === 0 ? streak.current_streak + 10 : Math.ceil(streak.current_streak / 10) * 10;
                const progress = remainder === 0 ? 0 : remainder / 10 * 100;
                return (
                  <View style={{ position: 'relative', marginBottom: 14 }}>
                    <ReAnimated.View style={[
                      {
                        position: 'absolute',
                        top: -6, left: -6, right: -6, bottom: -6,
                        borderRadius: 28,
                        backgroundColor: '#F97316',
                      },
                      streakGlowStyle,
                    ]} />
                    <View style={[s.streakHero, { marginBottom: 0 }]}>
                      <View style={s.streakHeroTop}>
                        <View style={s.streakHeroLeft}>
                          <Text style={s.streakHeroNumber}>{streak.current_streak}</Text>
                          <Text style={s.streakHeroUnit}>day streak</Text>
                          {streak.longest_streak > 0 && (
                            <Text style={s.streakHeroBest}>Personal best · {streak.longest_streak} days</Text>
                          )}
                        </View>
                        <TouchableOpacity style={s.streakShareBtn} onPress={handleShare} accessibilityLabel="Share your streak" accessibilityRole="button">
                          <Text style={s.streakShareText}>📤  Share</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={s.streakProgress}>
                        <View style={[s.streakProgressFill, { width: `${Math.min(100, progress)}%` as any }]} />
                      </View>
                      <View style={s.streakProgressRow}>
                        <Text style={s.streakProgressLabel}>
                          <Text style={s.streakProgressToNext}>{toNext}</Text>
                          {` days to ${milestone}-day milestone`}
                        </Text>
                        <Text style={s.streakMilestoneRight}>{milestone} 🔥</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {streak && streak.current_streak === 0 && (
                <TouchableOpacity style={s.streakStart} onPress={() => navigation.navigate('LogWorkout')} activeOpacity={0.85}>
                  <Text style={s.streakStartTitle}>Start your streak today! 🔥</Text>
                  <Text style={s.streakStartSub}>Log one workout to begin your journey.</Text>
                </TouchableOpacity>
              )}

              {leagueMembers.length > 0 && myRank !== null && (
                <TouchableOpacity style={[s.banner, { borderColor: (tierMeta?.color ?? '#B45309') + '30' }]} onPress={() => navigation.navigate('Leaderboard' as never)} activeOpacity={0.85}>
                  <View style={[s.bannerIcon, { backgroundColor: (tierMeta?.color ?? '#B45309') + '18' }]}>
                    <Text style={{ fontSize: 22 }}>{tierMeta?.emoji ?? '🥉'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.bannerTitle, { color: tierMeta?.color ?? '#B45309' }]}>#{myRank} in {tierMeta?.label} League</Text>
                    <Text style={s.bannerSub}>{daysUntilSunday} days left · {leagueMembers.length} competitors</Text>
                  </View>
                  <Text style={s.bannerChev}>›</Text>
                </TouchableOpacity>
              )}

              {rival && (
                <TouchableOpacity style={[s.banner, { borderColor: C.primary + '25' }]} onPress={() => navigation.navigate('Leaderboard' as never)} activeOpacity={0.85}>
                  <View style={[s.bannerIcon, { backgroundColor: C.primary + '14' }]}>
                    <Text style={{ fontSize: 22 }}>🎯</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.bannerTitle}>{rival.full_name ?? rival.username} is {rivalDiff} pts ahead</Text>
                    <Text style={s.bannerSub}>Your rival this week · catch up</Text>
                  </View>
                  <Text style={s.bannerChev}>›</Text>
                </TouchableOpacity>
              )}

              {activeChallenges.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionLabel}>Active challenges</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Challenges')}>
                      <Text style={s.seeAll}>See all →</Text>
                    </TouchableOpacity>
                  </View>
                  {activeChallenges.map(c => (
                    <ChallengeCard
                      key={c.id}
                      challenge={c}
                      compact
                      onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}
                    />
                  ))}
                </View>
              )}

              {milestones.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Streak milestones</Text>
                  {milestones.map(m => (
                    <StreakMilestoneCard
                      key={m.id}
                      item={m}
                      currentUserId={profile?.id ?? ''}
                      onReact={async (milestoneId, emoji) => {
                        try {
                          await supabase.from('milestone_reactions')
                            .upsert({ milestone_id: milestoneId, user_id: profile?.id, reaction: emoji },
                              { onConflict: 'milestone_id,user_id' });
                        } catch (err) {
                          console.warn('[HomeScreen] react failed:', err);
                        }
                      }}
                      onRemoveReact={async (milestoneId, emoji) => {
                        try {
                          await supabase.from('milestone_reactions')
                            .delete()
                            .eq('milestone_id', milestoneId)
                            .eq('user_id', profile?.id);
                        } catch (err) {
                          console.warn('[HomeScreen] remove react failed:', err);
                        }
                      }}
                    />
                  ))}
                </View>
              )}

              {!loading && feed.length > 0 && (
                <View style={s.sectionHeader}>
                  <Text style={s.sectionLabel}>Friends feed</Text>
                </View>
              )}
            </>
          }
          renderItem={renderFeedItem}
          ListEmptyComponent={
            loading ? (
              <View style={{ paddingHorizontal: 16 }}>
                {[1, 2, 3].map(k => <WorkoutPostSkeleton key={k} />)}
              </View>
            ) : (
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
            )
          }
        />
      </RNAnimated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary + '20', borderWidth: 1.5, borderColor: C.primary + '40', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 15, fontWeight: '800', color: C.primary },
  greeting: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  subGreeting: { fontSize: 13, color: C.muted, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBadge: { backgroundColor: '#151C24', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  rankPts: { fontSize: 13, fontWeight: '900', color: C.primary },
  logBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 44, justifyContent: 'center' },
  logBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  streakHero: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.primary + '30',
    borderRadius: 22,
    padding: 20,
    marginBottom: 0,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 12,
  },
  streakHeroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  streakHeroLeft: { gap: 2 },
  streakHeroNumber: { fontSize: 64, fontWeight: '800', color: C.primary, letterSpacing: -2, lineHeight: 60 },
  streakHeroUnit: { fontSize: 17, fontWeight: '700', color: C.text },
  streakHeroBest: { fontSize: 12.5, fontWeight: '500', color: C.muted },
  streakShareBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  streakShareText: { fontSize: 12, fontWeight: '700', color: C.text },
  streakProgress: { height: 7, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  streakProgressFill: { height: '100%' as any, backgroundColor: C.primary, borderRadius: 4 },
  streakProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakProgressLabel: { fontSize: 12, fontWeight: '500', color: C.muted },
  streakProgressToNext: { fontSize: 12, fontWeight: '700', color: C.text },
  streakMilestoneRight: { fontSize: 12, fontWeight: '700', color: C.primary },
  streakStart: {
    backgroundColor: C.primary + '12',
    borderWidth: 1.5,
    borderColor: C.primary + '30',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    alignItems: 'center',
    gap: 4,
  },
  streakStartTitle: { fontSize: 16, fontWeight: '800', color: C.primary },
  streakStartSub: { fontSize: 13, color: C.muted },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 15, marginBottom: 10, borderRadius: 16, backgroundColor: C.card, borderWidth: 1 },
  bannerIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  bannerSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  bannerChev: { fontSize: 22, color: C.muted },
  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.4, textTransform: 'uppercase' },
  seeAll: { fontSize: 13, color: C.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
});
