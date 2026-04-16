import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { SCORING_MODE_LABELS } from '../types/database';
import type { FitnessChallenge, ScoringMode } from '../types/database';

const C = {
  bg: '#0C1117', card: '#151C24', border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8', muted: '#4A6070', primary: '#F97316',
};

type Filter = 'all' | ScoringMode;
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all',         label: 'All' },
  { key: 'days_active', label: '📅 Days Active' },
  { key: 'workouts',    label: '💪 Workouts' },
  { key: 'steps',       label: '👟 Steps' },
  { key: 'distance_km', label: '📍 Distance' },
];

export default function DiscoverChallengesScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const { myChallenges, joinPublic, refresh: refreshMine } = useFitnessChallenges(profile?.id ?? '');

  const [challenges, setChallenges] = useState<FitnessChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fitness_challenges')
      .select('*, challenge_participants(count)')
      .eq('is_public', true)
      .in('status', ['active', 'upcoming'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      Alert.alert('Failed to load challenges', error.message);
    } else if (data) {
      const withCounts = data.map((c: any) => ({
        ...c,
        participant_count: Number(c.challenge_participants?.[0]?.count ?? 0),
      }));
      setChallenges(withCounts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all'
    ? challenges
    : challenges.filter(c => c.scoring_modes.includes(filter as ScoringMode));

  async function handleJoin(challenge: FitnessChallenge) {
    if (!profile?.id) return;
    setJoining(challenge.id);
    const { error } = await joinPublic(challenge.id);
    setJoining(null);
    if (error) {
      Alert.alert('Could not join', error);
    } else {
      await Promise.all([load(), refreshMine()]);
      navigation.navigate('ChallengeDetail', { challengeId: challenge.id });
    }
  }

  function isJoined(challengeId: string) {
    return myChallenges.some(c => c.id === challengeId);
  }

  function isFull(challenge: FitnessChallenge) {
    return !!(challenge.max_participants && (challenge.participant_count ?? 0) >= challenge.max_participants);
  }

  return (
    <View style={s.container}>
      {/* Filter bar */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => f.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.filterBtn, filter === item.key && s.filterBtnActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[s.filterBtnText, filter === item.key && s.filterBtnTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Challenge list */}
      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
        renderItem={({ item }) => {
          const joined = isJoined(item.id);
          const full = isFull(item);
          const daysLeft = differenceInDays(parseISO(item.end_date), new Date());
          const modeEmoji = SCORING_MODE_LABELS[item.scoring_modes[0]]?.split(' ')[0] ?? '💪';

          return (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.cardMeta}>
                  {modeEmoji} {SCORING_MODE_LABELS[item.scoring_modes[0]]} · 👥 {item.participant_count ?? 0}
                  {item.max_participants ? `/${item.max_participants}` : ''} · {daysLeft > 0 ? `${daysLeft}d left` : 'Ending soon'}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  s.joinBtn,
                  (joined || full) && s.joinBtnDisabled,
                ]}
                onPress={() => !joined && !full && handleJoin(item)}
                disabled={joined || full || joining === item.id}
              >
                <Text style={[s.joinBtnText, (joined || full) && s.joinBtnTextDisabled]}>
                  {joining === item.id ? '...' : joined ? 'Joined' : full ? 'Full' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyTitle}>No public challenges yet</Text>
              <Text style={s.emptySub}>Create a challenge and make it public to show up here</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  filterBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  filterBtnActive: { backgroundColor: C.primary + '20', borderColor: C.primary + '60' },
  filterBtnText: { fontSize: 13, color: C.muted, fontWeight: '600' },
  filterBtnTextActive: { color: C.primary },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  cardName: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: C.muted },
  joinBtn: { backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  joinBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border },
  joinBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  joinBtnTextDisabled: { color: C.muted },
  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  emptySub: { fontSize: 13, color: C.muted, textAlign: 'center', paddingHorizontal: 32 },
});
