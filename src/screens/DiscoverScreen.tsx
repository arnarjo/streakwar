import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, StatusBar, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import type { FitnessChallenge } from '../types/database';
import { SCORING_MODE_LABELS } from '../types/database';
import { differenceInDays, parseISO } from 'date-fns';
import { C } from '../theme';


export default function DiscoverScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { joinPublic } = useFitnessChallenges(profile?.id ?? '');
  const [challenges, setChallenges] = useState<FitnessChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const fetchPublic = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: fetchError } = await supabase
      .from('fitness_challenges')
      .select(`id, title, description, activity_type, scoring_mode, start_date, end_date, is_public, created_by, creator:profiles!fitness_challenges_created_by_fkey(id, username, full_name), participant_count:challenge_participants(count)`)
      .eq('is_public', true)
      .in('status', ['upcoming', 'active'])
      .order('created_at', { ascending: false })
      .limit(50);
    if (fetchError) {
      setError(true);
    } else if (data) {
      setChallenges(data.map((c: any) => ({ ...c, participant_count: c.participant_count?.[0]?.count ?? 0 })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPublic(); }, [fetchPublic]);

  const filtered = challenges.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  if (error) return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#9CA3AF', fontSize: 16, marginBottom: 16, textAlign: 'center' }}>
          Could not load public challenges. Check your connection and try again.
        </Text>
        <TouchableOpacity onPress={fetchPublic} style={{ backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}>
          <Text style={{ color: '#000', fontWeight: '600' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  async function handleJoin(challengeId: string, name: string) {
    setJoining(challengeId);
    const { error } = await joinPublic(challengeId);
    setJoining(null);
    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Joined! 💪', `You're now in "${name}"`);
      navigation.navigate('ChallengeDetail', { challengeId });
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={s.header}>
        <Text style={s.title}>Discover</Text>
        <Text style={s.subtitle}>Public challenges anyone can join</Text>
      </View>
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          placeholder="🔍  Search challenges..."
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPublic} tintColor={C.primary} />}
        renderItem={({ item }) => {
          const daysLeft = differenceInDays(parseISO(item.end_date), new Date());
          const isActive = item.status === 'active';
          const scoringLabel = (item.scoring_modes ?? []).slice(0, 2).map((m: string) => (SCORING_MODE_LABELS[m as keyof typeof SCORING_MODE_LABELS] ?? m)?.split(' ')[0] ?? '').filter(Boolean).join(' · ');
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={s.cardMeta}>{item.creator?.username} · {scoringLabel}</Text>
                </View>
                <View style={[s.statusBadge, isActive ? { backgroundColor: C.green + '15', borderColor: C.green + '40' } : { backgroundColor: C.muted + '20', borderColor: C.muted + '40' }]}>
                  <Text style={[s.statusText, { color: isActive ? C.green : C.muted }]}>{isActive ? 'Active' : 'Upcoming'}</Text>
                </View>
              </View>
              {item.description ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
              <View style={s.cardFooter}>
                <Text style={s.cardStats}>👥 {item.participant_count ?? 0}  ·  ⏱ {daysLeft} days left</Text>
                <TouchableOpacity
                  style={[s.joinBtn, joining === item.id && { opacity: 0.5 }]}
                  onPress={() => handleJoin(item.id, item.name)}
                  disabled={joining === item.id}
                >
                  <Text style={s.joinBtnText}>{joining === item.id ? '...' : 'Join'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyTitle}>{search ? 'No results' : 'No public challenges'}</Text>
              <Text style={s.emptyText}>{search ? 'Try a different search term' : 'Be the first to create a public challenge!'}</Text>
              {!search && (
                <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('CreateChallenge')}>
                  <Text style={s.createBtnText}>Create a public challenge</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 2 },
  searchRow: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: { backgroundColor: '#151C24', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: C.text, fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: '#151C24', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 16, marginBottom: 10, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardName: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 3 },
  cardMeta: { fontSize: 12, color: C.muted },
  statusBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDesc: { fontSize: 13, color: C.muted, lineHeight: 19 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardStats: { fontSize: 12, color: C.muted },
  joinBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  joinBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 64, gap: 12, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.muted },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  createBtn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  createBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
});
