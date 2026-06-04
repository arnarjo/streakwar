import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, Share, Image, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkoutFeed } from '../hooks/useWorkoutFeed';
import { useChallengeMessages, TRASH_TALK_MESSAGES } from '../hooks/useChallengeMessages';
import WorkoutPostCard from '../components/WorkoutPostCard';
import ShareCard from '../components/ShareCard';
import type { FitnessChallenge, ChallengeParticipant, WorkoutComment } from '../types/database';
import { SCORING_MODE_LABELS, TIE_BREAK_LABELS } from '../types/database';
import { format, parseISO } from 'date-fns';
import { C } from '../theme';


type Tab = 'leaderboard' | 'feed' | 'banter' | 'info';

export default function ChallengeDetailScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const challengeId = route.params?.challengeId as string;

  const [challenge, setChallenge] = useState<FitnessChallenge | null>(null);
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [refreshing, setRefreshing] = useState(false);
  const [sharingCard, setSharingCard] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const shareCardRef = useRef<ViewShot>(null);

  const { feed, loading: feedLoading, fetchFeed, toggleReaction, fetchComments, addComment, deleteWorkout } = useWorkoutFeed(profile?.id ?? '');
  const { messages: banterMessages, sendMessage, fetch: fetchBanter } = useChallengeMessages(challengeId, profile?.id ?? '');

  const loadChallenge = useCallback(async () => {
    const { data, error } = await supabase
      .from('fitness_challenges')
      .select('*, creator:profiles!fitness_challenges_created_by_fkey(*)')
      .eq('id', challengeId)
      .single();
    if (data) { setChallenge(data); setLoadError(null); }
    else if (error) setLoadError('Could not load challenge. Tap to retry.');
  }, [challengeId]);

  const loadParticipants = useCallback(async () => {
    const { data } = await supabase
      .from('challenge_participants')
      .select('*, profile:profiles(*)')
      .eq('challenge_id', challengeId)
      .order('score', { ascending: false });
    if (data) setParticipants(data);
  }, [challengeId]);

  useEffect(() => {
    loadChallenge();
    loadParticipants();
    fetchFeed(challengeId);
    fetchBanter();

    const channel = supabase
      .channel(`challenge_${challengeId}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_participants', filter: `challenge_id=eq.${challengeId}` }, loadParticipants)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workout_posts', filter: `challenge_id=eq.${challengeId}` }, () => fetchFeed(challengeId))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [challengeId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadChallenge(), loadParticipants(), fetchFeed(challengeId)]);
    setRefreshing(false);
  }, [challengeId]);

  async function shareInvite() {
    if (!challenge) return;
    const msg = `Let's compete together on StreakWar! 🔥\n\nJoin "${challenge.name}" — run, move, and rack up points.\n\nCode: ${challenge.invite_code}\n\nDownload StreakWar: https://streakwar.is`;
    await Share.share({ message: msg, title: `Invite to ${challenge.name}` });
  }

  async function shareMyRank() {
    if (!challenge || !myParticipant || !profile) return;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      // Fallback to text share if image sharing not available
      await Share.share({
        message: `I'm #${myParticipant.rank ?? '?'} in "${challenge.name}" with ${myParticipant.score} points on StreakWar! 💪\n\nCode: ${challenge.invite_code}`,
      });
      return;
    }
    setSharingCard(true);
    try {
      const uri = await shareCardRef.current?.capture?.();
      if (!uri) throw new Error('Capture failed');
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Share your rank in ${challenge.name}`,
      });
    } catch {
      Alert.alert('Error', 'Could not capture screenshot. Please try again.');
    } finally {
      setSharingCard(false);
    }
  }

  if (!challenge) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      {loadError ? (
        <>
          <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>{loadError}</Text>
          <TouchableOpacity onPress={loadChallenge} style={{ backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }} accessibilityLabel="Retry loading challenge">
            <Text style={{ color: '#000', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Text style={{ color: C.muted, fontSize: 13 }}>Go back</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator color={C.green ?? '#22C55E'} size="large" />
      )}
    </View>
  );

  const myParticipant = participants.find(p => p.user_id === profile?.id);
  const podium = participants.slice(0, 3);
  const rest = participants.slice(3);

  function handleFetchComments(postId: string): Promise<WorkoutComment[]> {
    return fetchComments(postId);
  }
  function handleAddComment(postId: string, content: string): Promise<{ error: string | null }> {
    return addComment(postId, content);
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Nav bar */}
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.navTitle} numberOfLines={1}>{challenge.name}</Text>
        <TouchableOpacity onPress={shareInvite} style={s.shareBtn}>
          <Text style={s.shareText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['leaderboard', 'feed', 'banter', 'info'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'leaderboard' ? '🏆 Leaderboard' : t === 'feed' ? '📸 Feed' : t === 'banter' ? '💬 Banter' : 'ℹ️ Info'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        <FlatList
          data={rest}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          ListHeaderComponent={
            <>
              {/* My rank card */}
              {myParticipant && (
                <View style={s.myRankCard}>
                  <Text style={s.myRankLabel}>YOUR RANK</Text>
                  <View style={s.myRankRow}>
                    <Text style={s.myRankNum}>#{myParticipant.rank ?? '–'}</Text>
                    <Text style={s.myRankScore}>{myParticipant.score} pts</Text>
                    <TouchableOpacity style={s.logWorkoutBtn} onPress={() => navigation.navigate('LogWorkout', { challengeId })}>
                      <Text style={s.logWorkoutBtnText}>+ Log Workout</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[s.shareRankBtn, sharingCard && s.shareRankBtnBusy]}
                    onPress={shareMyRank}
                    disabled={sharingCard}
                    activeOpacity={0.8}
                  >
                    <Text style={s.shareRankBtnText}>
                      {sharingCard ? '...' : '📤 Share my rank'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Podium */}
              {podium.length > 0 && (
                <View style={s.podium}>
                  {[podium[1], podium[0], podium[2]].map((p, visualIdx) => {
                    if (!p) return <View key={visualIdx} style={{ flex: 1 }} />;
                    const rank = visualIdx === 1 ? 1 : visualIdx === 0 ? 2 : 3;
                    const heights = [70, 90, 60];
                    const colors = ['#C0C0C0', '#FFD700', '#CD7F32'];
                    const initials = (p.profile?.full_name ?? p.profile?.username ?? '?')
                      .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <View key={p.id} style={[s.podiumSlot, { flex: 1 }]}>
                        <Text style={s.podiumScore}>{p.score}</Text>
                        <View style={[s.podiumAvatar, { borderColor: colors[rank - 1] }]}>
                          {p.profile?.avatar_url
                            ? <Image source={{ uri: p.profile.avatar_url }} style={s.podiumAvatarImg} />
                            : <Text style={[s.podiumAvatarText, { color: colors[rank - 1] }]}>{initials}</Text>
                          }
                        </View>
                        <View style={[s.podiumBar, { height: heights[rank - 1], backgroundColor: colors[rank - 1] + '30', borderColor: colors[rank - 1] + '60' }]}>
                          <Text style={[s.podiumRankNum, { color: colors[rank - 1] }]}>#{rank}</Text>
                        </View>
                        <Text style={s.podiumName} numberOfLines={1}>{p.profile?.username}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {rest.length > 0 && (
                <Text style={s.restLabel}>Full leaderboard</Text>
              )}
            </>
          }
          renderItem={({ item, index }) => {
            const rank = index + 4;
            const initials = (item.profile?.full_name ?? item.profile?.username ?? '?')
              .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            const isMe = item.user_id === profile?.id;
            return (
              <View style={[s.rankRow, isMe && s.rankRowMe]}>
                <Text style={s.rankNum}>#{rank}</Text>
                <View style={[s.rankAvatar, isMe && { borderColor: C.primary }]}>
                  <Text style={[s.rankAvatarText, isMe && { color: C.primary }]}>{initials}</Text>
                </View>
                <Text style={[s.rankName, isMe && { color: C.primary }]} numberOfLines={1}>
                  {item.profile?.username}
                  {isMe ? ' (you)' : ''}
                </Text>
                <Text style={s.rankScore}>{item.score} pts</Text>
              </View>
            );
          }}
        />
      )}

      {/* Feed tab */}
      {tab === 'feed' && (
        <FlatList
          data={feed}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={feedLoading} onRefresh={() => fetchFeed(challengeId)} tintColor={C.primary} />}
          renderItem={({ item }) => (
            <WorkoutPostCard
              post={item}
              currentUserId={profile?.id}
              onReact={toggleReaction}
              onFetchComments={handleFetchComments}
              onAddComment={handleAddComment}
              onEdit={(post) => navigation.navigate('LogWorkout', { editWorkout: post })}
              onDelete={(postId) => deleteWorkout(postId)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>No workouts logged yet</Text>
            </View>
          }
        />
      )}

      {/* Banter tab */}
      {tab === 'banter' && (
        <View style={{ flex: 1 }}>
          <View style={s.trashGrid}>
            {Object.entries(TRASH_TALK_MESSAGES).map(([key, text]) => (
              <TouchableOpacity
                key={key}
                style={s.trashBtn}
                onPress={() => sendMessage(key)}
                activeOpacity={0.75}
              >
                <Text style={s.trashBtnText}>{text}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlatList
            data={banterMessages}
            keyExtractor={m => m.id}
            contentContainerStyle={s.messageList}
            renderItem={({ item }) => (
              <View style={s.messageRow}>
                <Text style={s.messageSender}>
                  {item.sender?.full_name ?? item.sender?.username ?? 'Unknown'}
                </Text>
                <Text style={s.messageText}>{TRASH_TALK_MESSAGES[item.message_key]}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={s.emptyBanter}>
                <Text style={s.emptyBanterText}>No trash talk yet — send the first shot 💬</Text>
              </View>
            }
          />
        </View>
      )}

      {/* Info tab */}
      {tab === 'info' && (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={null}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              {challenge.description ? (
                <View style={s.infoCard}>
                  <Text style={s.infoLabel}>DESCRIPTION</Text>
                  <Text style={s.infoValue}>{challenge.description}</Text>
                </View>
              ) : null}

              <View style={s.infoCard}>
                <Text style={s.infoLabel}>DURATION</Text>
                <Text style={s.infoValue}>
                  {format(parseISO(challenge.start_date), 'MMM d')} –{' '}
                  {format(parseISO(challenge.end_date), 'MMM d, yyyy')}
                </Text>
              </View>

              <View style={s.infoCard}>
                <Text style={s.infoLabel}>SCORING</Text>
                {challenge.scoring_modes.map(m => (
                  <Text key={m} style={s.infoValue}>{SCORING_MODE_LABELS[m]}</Text>
                ))}
              </View>

              <View style={s.infoCard}>
                <Text style={s.infoLabel}>TIEBREAKER</Text>
                <Text style={s.infoValue}>{TIE_BREAK_LABELS[challenge.tie_break_rule]}</Text>
              </View>

              <View style={s.infoCard}>
                <Text style={s.infoLabel}>BACKLOG</Text>
                <Text style={s.infoValue}>Up to {challenge.backlog_days_allowed} days back</Text>
              </View>

              <View style={s.infoCard}>
                <Text style={s.infoLabel}>PHOTO PROOF</Text>
                <Text style={s.infoValue}>{challenge.require_photo_proof ? 'Required' : 'Optional'}</Text>
              </View>

              <View style={s.infoCard}>
                <Text style={s.infoLabel}>INVITE CODE</Text>
                <Text style={[s.infoValue, { fontSize: 20, fontWeight: '800', letterSpacing: 4, color: C.primary }]}>
                  {challenge.invite_code}
                </Text>
              </View>

              <TouchableOpacity style={s.shareCardBtn} onPress={shareInvite}>
                <Text style={s.shareCardBtnText}>📤 Share invite code</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Off-screen ShareCard captured by ViewShot — not visible to user */}
      {myParticipant && profile && (
        <ViewShot
          ref={shareCardRef}
          options={{ format: 'png', quality: 1.0 }}
          style={s.offScreen}
        >
          <ShareCard
            challengeName={challenge.name}
            renewalType={challenge.renewal_type ?? 'none'}
            rank={myParticipant.rank}
            score={myParticipant.score}
            username={profile.username}
            inviteCode={challenge.invite_code}
          />
        </ViewShot>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: C.text },
  navTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: C.text },
  shareBtn: { padding: 4 },
  shareText: { color: C.primary, fontWeight: '700', fontSize: 14 },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabActive: { backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40' },
  tabText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  tabTextActive: { color: C.primary },

  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 48 },
  emptyText: { color: C.muted, fontSize: 14 },

  myRankCard: {
    backgroundColor: C.primary + '12',
    borderWidth: 1,
    borderColor: C.primary + '30',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 6,
  },
  myRankLabel: { fontSize: 11, fontWeight: '700', color: C.primary, letterSpacing: 1 },
  myRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  myRankNum: { fontSize: 24, fontWeight: '900', color: C.primary },
  myRankScore: { fontSize: 16, fontWeight: '600', color: C.text, flex: 1 },
  logWorkoutBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logWorkoutBtnText: { color: '#000', fontWeight: '800', fontSize: 12 },

  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
    gap: 4,
  },
  podiumSlot: { alignItems: 'center', gap: 4 },
  podiumScore: { fontSize: 11, color: C.muted, fontWeight: '600' },
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  podiumAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  podiumAvatarText: { fontSize: 16, fontWeight: '800' },
  podiumBar: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  podiumRankNum: { fontSize: 16, fontWeight: '900', paddingVertical: 4 },
  podiumName: { fontSize: 11, color: C.muted, fontWeight: '600', textAlign: 'center' },
  restLabel: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },

  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  rankRowMe: { borderColor: C.primary + '40', backgroundColor: C.primary + '08' },
  rankNum: { fontSize: 14, fontWeight: '700', color: C.muted, width: 28 },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  rankAvatarText: { fontSize: 13, fontWeight: '700', color: C.muted },
  rankName: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  rankScore: { fontSize: 14, fontWeight: '800', color: C.text },

  infoCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 4,
  },
  infoLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5 },
  infoValue: { fontSize: 14, color: C.text, lineHeight: 20 },
  shareCardBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareCardBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },

  trashGrid: { padding: 16, gap: 8 },
  trashBtn: { backgroundColor: '#151C24', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  trashBtnText: { fontSize: 14, color: '#EEF4F8', fontWeight: '600' },
  messageList: { paddingHorizontal: 16, paddingBottom: 40 },
  messageRow: { backgroundColor: '#1E2A35', borderRadius: 10, padding: 12, marginBottom: 6 },
  messageSender: { fontSize: 11, color: '#F97316', fontWeight: '700', marginBottom: 2 },
  messageText: { fontSize: 14, color: '#EEF4F8' },
  emptyBanter: { alignItems: 'center', paddingTop: 32 },
  emptyBanterText: { fontSize: 14, color: '#4A6070', textAlign: 'center' },

  shareRankBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: 10, paddingVertical: 10,
    alignItems: 'center',
  },
  shareRankBtnBusy: { opacity: 0.5 },
  shareRankBtnText: { color: C.primary, fontWeight: '700', fontSize: 13 },

  offScreen: { position: 'absolute', top: -1000, left: -1000, opacity: 0 },
});
