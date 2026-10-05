import React, { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useWorkoutFeed } from '../hooks/useWorkoutFeed';
import { useStreaks } from '../hooks/useStreaks';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLeague } from '../hooks/useLeague';
import { LEAGUE_TIER_META } from '../types/database';
import type { WorkoutComment, LeagueTier } from '../types/database';
import WorkoutPostCard from '../components/WorkoutPostCard';
import PrivateActivitySummaryCard from '../components/PrivateActivitySummaryCard';
import ChallengeCard from '../components/ChallengeCard';
import StreakMilestoneCard from '../components/StreakMilestoneCard';
import type { MilestoneItem } from '../components/StreakMilestoneCard';
import { WorkoutPostSkeleton } from '../components/SkeletonPulse';
import { Share } from 'react-native';
import { supabase } from '../lib/supabase';
import InterfaceIcon from '../components/InterfaceIcon';
import { C, HIT, R } from '../theme';
import type { AppNavigationProp } from '../navigation/types';

export default function HomeScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const isFocused = useIsFocused();
  const { feed, loading, fetchFeed, toggleReaction, fetchComments, addComment, deleteWorkout } = useWorkoutFeed(profile?.id ?? '');
  const { myChallenges, refresh: refreshChallenges } = useFitnessChallenges(profile?.id ?? '');
  const { streak } = useStreaks(profile?.id ?? '');
  const { rival, rivalDiff, fetchWeekly } = useLeaderboard(profile?.id ?? '');
  const { myTier, myRank, members: leagueMembers } = useLeague(profile?.id ?? '');
  const tierMeta = LEAGUE_TIER_META[myTier as LeagueTier];
  const daysUntilSunday = (() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : 7 - d;
  })();
  const [milestones, setMilestones] = React.useState<MilestoneItem[]>([]);
  const [milestonesError, setMilestonesError] = React.useState(false);

  const fetchMilestones = useCallback(async () => {
    if (!profile?.id) return;
    const { data: parts, error: partsError } = await supabase
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_id', profile.id);
    if (partsError) { setMilestonesError(true); return; }
    setMilestonesError(false);
    if (!parts || parts.length === 0) return;

    const { data: peers, error: peersError } = await supabase
      .from('challenge_participants')
      .select('user_id')
      .in('challenge_id', parts.map(p => p.challenge_id))
      .neq('user_id', profile.id);

    if (peersError) { setMilestonesError(true); return; }
    if (!peers || peers.length === 0) return;
    const peerIds = [...new Set(peers.map(p => p.user_id))];

    const { data, error: milestonesFetchError } = await supabase
      .from('streak_milestones')
      .select('*, profile:profiles(id, username, full_name)')
      .in('user_id', peerIds)
      .gte('achieved_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .order('achieved_at', { ascending: false })
      .limit(5);

    if (milestonesFetchError) { setMilestonesError(true); return; }
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

  async function handleShare() {
    await Share.share({
      message:
        `${streak?.current_streak ?? 0}-day streak on StreakWar.\n` +
        `${(profile?.total_points ?? 0).toLocaleString()} competition points\n` +
        `\nCan you beat me? Download StreakWar.`,
    });
  }

  useEffect(() => {
    fetchFeed();
    fetchWeekly();
    fetchMilestones();
  }, [fetchMilestones, fetchFeed, fetchWeekly]);

  const onRefresh = useCallback(async () => {
    await Promise.all([fetchFeed(), refreshChallenges(), fetchWeekly(), fetchMilestones()]);
  }, [fetchFeed, refreshChallenges, fetchWeekly, fetchMilestones]);

  const activeChallenges = myChallenges.filter(c => c.status === 'active').slice(0, 3);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const initialsText = profile?.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const currentStreak = streak?.current_streak ?? 0;
  const nextMilestone = (Math.floor(currentStreak / 10) + 1) * 10;
  const daysToMilestone = 10 - (currentStreak % 10);
  const milestoneProgress = (currentStreak % 10) * 10;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity
          style={s.avatar}
          onPress={() => navigation.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Text style={s.avatarText}>{initialsText}</Text>
        </TouchableOpacity>

        <Text style={s.greeting} numberOfLines={1}>Hi, {firstName}</Text>

        <TouchableOpacity
          style={s.logBtn}
          onPress={() => navigation.navigate('LogWorkout')}
          accessibilityRole="button"
          accessibilityLabel="Log a workout"
        >
          <InterfaceIcon name="add" size={20} color={C.onPrimary} />
          <Text style={s.logBtnText}>Log</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={feed}
        keyExtractor={item => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.primary} />}
        ListHeaderComponent={
          <>
            {Platform.OS === 'android' && (
              <PrivateActivitySummaryCard userId={profile?.id ?? ''} refreshToken={`${isFocused}:${loading}`} />
            )}

            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel} accessibilityRole="header">Competition</Text>
            </View>
            <Text style={s.sectionCaption}>
              Based on workouts you log and share in challenges. Kept separate from your private activity.
            </Text>
            <View style={s.competitionCard}>
              <View style={s.competitionRow}>
                <TouchableOpacity
                  style={s.competitionCell}
                  onPress={() => navigation.navigate('Leaderboard')}
                  accessibilityRole="button"
                  accessibilityLabel={`Competition points ${(profile?.total_points ?? 0).toLocaleString()}. Open leaderboard`}
                >
                  <Text style={s.bigValue}>{(profile?.total_points ?? 0).toLocaleString()}</Text>
                  <Text style={s.cellLabel}>Competition points</Text>
                </TouchableOpacity>
                <View style={s.competitionDivider} />
                <View style={s.competitionCell} accessible accessibilityLabel={streak ? `Competition streak ${currentStreak} days` : 'Competition streak unavailable'}>
                  <Text style={s.bigValue}>{streak ? currentStreak : '–'}</Text>
                  <Text style={s.cellLabel}>
                    {streak && streak.longest_streak > 0 ? `Competition streak · best ${streak.longest_streak}` : 'Competition streak'}
                  </Text>
                </View>
              </View>

              {streak && currentStreak > 0 ? (
                <>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${Math.min(100, milestoneProgress)}%` }]} />
                  </View>
                  <View style={s.progressRow}>
                    <Text style={s.cellLabel}>
                      {`${daysToMilestone} day${daysToMilestone === 1 ? '' : 's'} to the ${nextMilestone}-day milestone`}
                    </Text>
                    <TouchableOpacity
                      style={s.textBtn}
                      onPress={handleShare}
                      accessibilityRole="button"
                      accessibilityLabel="Share your streak"
                    >
                      <InterfaceIcon name="share-outline" size={18} color={C.text} />
                      <Text style={s.textBtnLabel}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : streak ? (
                <View style={s.zeroStreak}>
                  <Text style={s.cellLabel}>
                    A competition streak counts workouts you log in the app. Imported Health Connect activity isn't counted yet.
                  </Text>
                  <TouchableOpacity
                    style={s.textBtn}
                    onPress={() => navigation.navigate('LogWorkout')}
                    accessibilityRole="button"
                    accessibilityLabel="Log a workout"
                  >
                    <Text style={s.textBtnLabel}>Log a workout</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {leagueMembers.length > 0 && myRank !== null && (
              <TouchableOpacity
                style={s.banner}
                onPress={() => navigation.navigate('Leaderboard')}
                accessibilityRole="button"
                accessibilityLabel={`Rank ${myRank} in the ${tierMeta?.label} league. Open leaderboard`}
              >
                <View style={[s.bannerMark, { backgroundColor: tierMeta?.color ?? C.bronze }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.bannerTitle}>#{myRank} in the {tierMeta?.label} League</Text>
                  <Text style={s.bannerSub}>{daysUntilSunday} days left · {leagueMembers.length} competitors</Text>
                </View>
                <InterfaceIcon name="chevron-forward" size={18} />
              </TouchableOpacity>
            )}

            {rival && (
              <TouchableOpacity
                style={s.banner}
                onPress={() => navigation.navigate('Leaderboard')}
                accessibilityRole="button"
                accessibilityLabel={`${rival.full_name ?? rival.username} is ${rivalDiff} points ahead. Open leaderboard`}
              >
                <InterfaceIcon name="trending-up" size={20} color={C.text} />
                <View style={{ flex: 1 }}>
                  <Text style={s.bannerTitle}>{rival.full_name ?? rival.username} is {rivalDiff} pts ahead</Text>
                  <Text style={s.bannerSub}>Your rival this week</Text>
                </View>
                <InterfaceIcon name="chevron-forward" size={18} />
              </TouchableOpacity>
            )}

            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel} accessibilityRole="header">Challenges</Text>
              {activeChallenges.length > 0 && (
                <TouchableOpacity
                  style={s.linkBtn}
                  onPress={() => navigation.navigate('Challenges')}
                  accessibilityRole="button"
                  accessibilityLabel="See all challenges"
                >
                  <Text style={s.seeAll}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            {activeChallenges.length > 0 ? (
              activeChallenges.map(c => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  compact
                  onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}
                />
              ))
            ) : (
              <View style={s.discoverCard}>
                <Text style={s.discoverTitle}>Find a challenge to join</Text>
                <Text style={s.discoverText}>
                  Browse open public challenges, or start one with a friend from the Challenges tab.
                </Text>
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={() => navigation.navigate('Challenges')}
                  accessibilityRole="button"
                  accessibilityLabel="Browse open challenges"
                >
                  <Text style={s.primaryBtnText}>Browse open challenges</Text>
                </TouchableOpacity>
              </View>
            )}

            {milestonesError && (
              <TouchableOpacity style={s.inlineError} onPress={fetchMilestones} accessibilityRole="button">
                <Text style={s.inlineErrorText}>Couldn't load streak milestones — tap to retry</Text>
              </TouchableOpacity>
            )}

            {milestones.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel} accessibilityRole="header">Streak milestones</Text>
                {milestones.map(m => (
                  <StreakMilestoneCard key={m.id} item={m} currentUserId={profile?.id ?? ''} />
                ))}
              </View>
            )}

            {!loading && feed.length > 0 && (
              <View style={s.sectionHeader}>
                <Text style={s.sectionLabel} accessibilityRole="header">Challenge feed</Text>
              </View>
            )}
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
          loading ? (
            <View style={{ paddingHorizontal: 16 }}>
              {[1, 2, 3].map(k => <WorkoutPostSkeleton key={k} />)}
            </View>
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Nothing in your feed yet</Text>
              <Text style={s.emptyText}>
                Posts from people in your challenges appear here.
              </Text>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => navigation.navigate('Challenges')}
                accessibilityRole="button"
                accessibilityLabel="Browse open challenges"
              >
                <Text style={s.primaryBtnText}>Browse open challenges</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  avatar: { width: HIT, height: HIT, borderRadius: HIT / 2, backgroundColor: C.dimmed, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: C.text },
  greeting: { flex: 1, fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  logBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, borderRadius: R.sm, paddingHorizontal: 14, minHeight: HIT, justifyContent: 'center' },
  logBtnText: { color: C.onPrimary, fontWeight: '800', fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },

  competitionCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 16, marginBottom: 12, gap: 12 },
  competitionRow: { flexDirection: 'row' },
  competitionCell: { flex: 1, minHeight: HIT, justifyContent: 'center', gap: 2 },
  competitionDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 16 },
  bigValue: { fontSize: 36, fontWeight: '800', color: C.text, letterSpacing: -1 },
  cellLabel: { fontSize: 12, color: C.muted, lineHeight: 17, flexShrink: 1 },
  progressTrack: { height: 4, backgroundColor: C.dimmed, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  zeroStreak: { gap: 4 },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: HIT, justifyContent: 'center', paddingHorizontal: 4, alignSelf: 'flex-start' },
  textBtnLabel: { fontSize: 13, fontWeight: '700', color: C.text },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  bannerMark: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  bannerSub: { fontSize: 12, color: C.muted, marginTop: 2 },

  section: { marginBottom: 8 },
  inlineError: { backgroundColor: C.error + '1F', borderWidth: 1, borderColor: C.error + '4D', borderRadius: R.md, padding: 12, marginBottom: 10, alignItems: 'center', minHeight: HIT, justifyContent: 'center' },
  inlineErrorText: { color: C.error, fontSize: 13, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32, marginTop: 8, marginBottom: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionCaption: { fontSize: 12, color: C.muted, lineHeight: 17, marginBottom: 10 },
  linkBtn: { minHeight: HIT, justifyContent: 'center', paddingHorizontal: 4 },
  seeAll: { fontSize: 13, color: C.text, fontWeight: '700' },

  discoverCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 16, gap: 8, marginBottom: 8 },
  discoverTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  discoverText: { fontSize: 13, color: C.muted, lineHeight: 18 },
  primaryBtn: { alignSelf: 'flex-start', backgroundColor: C.primary, borderRadius: R.sm, paddingHorizontal: 16, minHeight: HIT, justifyContent: 'center', marginTop: 4 },
  primaryBtnText: { color: C.onPrimary, fontWeight: '800', fontSize: 14 },

  empty: { paddingTop: 24, paddingHorizontal: 4, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  emptyText: { fontSize: 13, color: C.muted, lineHeight: 18 },
});
