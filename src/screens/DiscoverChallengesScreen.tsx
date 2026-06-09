import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { SCORING_MODE_LABELS } from '../types/database';
import type { FitnessChallenge } from '../types/database';
import { C } from '../theme';

type Props = {
  myChallenges: FitnessChallenge[];
  joinPublic: (challengeId: string) => Promise<{ error: string | null }>;
  onRefreshMyChallenges: () => Promise<void>;
};

type JoinButtonProps = {
  item: FitnessChallenge;
  joined: boolean;
  full: boolean;
  busy: boolean;
  onJoin: (item: FitnessChallenge) => void;
};

function JoinButton({ item, joined, full, busy, onJoin }: JoinButtonProps) {
  return (
    <TouchableOpacity
      style={[s.joinBtn, (joined || full) && s.joinBtnDisabled]}
      onPress={() => !joined && !full && onJoin(item)}
      disabled={joined || full || busy}
      accessibilityRole="button"
      accessibilityLabel={joined ? 'Þegar í challenge' : full ? 'Fullt' : `Taka þátt í ${item.name}`}
    >
      <Text style={[s.joinBtnText, (joined || full) && s.joinBtnTextDisabled]}>
        {busy ? '...' : joined ? 'Joined' : full ? 'Full' : 'Join'}
      </Text>
    </TouchableOpacity>
  );
}

const BADGE_STYLE: Record<string, { border: string; badge: string; label: string }> = {
  daily:   { border: '#10B981', badge: '#10B98120', label: '⚡ DAGLEG' },
  weekly:  { border: C.primary, badge: '#F9731620', label: '🔥 WEEKLY' },
  monthly: { border: C.gold,    badge: '#F59E0B20', label: '🏆 MONTHLY' },
  none:    { border: C.muted2,  badge: 'rgba(255,255,255,0.04)', label: '🎉 SÉRSTAKUR' },
};

export default function DiscoverChallengesScreen({ myChallenges, joinPublic, onRefreshMyChallenges }: Props) {
  const navigation = useNavigation<any>();

  const [dailyMissions, setDailyMissions] = useState<FitnessChallenge[]>([]);
  const [recurringChallenges, setRecurringChallenges] = useState<FitnessChallenge[]>([]);
  const [specialChallenges, setSpecialChallenges] = useState<FitnessChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    const { data, error } = await supabase
      .from('fitness_challenges')
      .select('*, challenge_participants(count)')
      .eq('is_global', true)
      .in('status', ['active', 'upcoming'])
      .order('start_date', { ascending: true });

    if (error) {
      setLoadError(true);
    } else {
      const withCount = (data ?? []).map((c) => ({
        ...c,
        participant_count: Number(c.challenge_participants?.[0]?.count ?? 0),
      }));
      setDailyMissions(withCount.filter((c: FitnessChallenge) => c.renewal_type === 'daily'));
      setRecurringChallenges(withCount.filter((c: FitnessChallenge) =>
        c.renewal_type === 'weekly' || c.renewal_type === 'monthly'
      ));
      setSpecialChallenges(withCount.filter((c: FitnessChallenge) =>
        c.renewal_type === 'none'
      ));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleJoin(challenge: FitnessChallenge) {
    setJoining(challenge.id);
    const { error } = await joinPublic(challenge.id);
    setJoining(null);
    if (error) {
      Alert.alert('Could not join', error);
    } else {
      await Promise.all([load(), onRefreshMyChallenges()]);
      navigation.navigate('ChallengeDetail', { challengeId: challenge.id });
    }
  }

  function isJoined(challengeId: string) {
    return myChallenges.some(c => c.id === challengeId);
  }

  function isFull(challenge: FitnessChallenge) {
    return !!(challenge.max_participants && (challenge.participant_count ?? 0) >= challenge.max_participants);
  }

  function daysLeftLabel(endDate: string) {
    const d = differenceInDays(parseISO(endDate), new Date());
    if (d < 0) return 'Ending soon';
    if (d === 0) return 'Í dag!';
    return `${d}d left`;
  }

  function ChallengeCard({ item }: { item: FitnessChallenge }) {
    const style = BADGE_STYLE[item.renewal_type ?? 'none'] ?? BADGE_STYLE.none;
    const modes = item.scoring_modes ?? [];
    const modeEmoji = SCORING_MODE_LABELS[modes[0]]?.split(' ')[0] ?? '💪';
    return (
      <View style={[s.card, { borderColor: style.border + '80' }]}>
        <View style={[s.badge, { backgroundColor: style.badge }]}>
          <Text style={[s.badgeText, { color: style.border }]}>{style.label}</Text>
        </View>
        <View style={s.cardContent}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.cardMeta}>
            {modeEmoji} {modes.map(m => SCORING_MODE_LABELS[m]).join(' · ')}
          </Text>
          <Text style={[s.cardMeta, { marginTop: 2 }]}>
            👥 {item.participant_count ?? 0} þátttakendur · {daysLeftLabel(item.end_date)}
          </Text>
        </View>
        <JoinButton
          item={item}
          joined={isJoined(item.id)}
          full={isFull(item)}
          busy={joining === item.id}
          onJoin={handleJoin}
        />
      </View>
    );
  }

  function Section({ title, sub, items }: { title: string; sub: string; items: FitnessChallenge[] }) {
    if (items.length === 0) return null;
    return (
      <View style={s.section}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionSub}>{sub}</Text>
        {items.map(item => <ChallengeCard key={item.id} item={item} />)}
      </View>
    );
  }

  const hasAnything = dailyMissions.length > 0 || recurringChallenges.length > 0 || specialChallenges.length > 0;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.primary} />}
    >
      {!hasAnything && !loading && (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>{loadError ? '⚠️' : '🔍'}</Text>
          <Text style={s.emptyTitle}>{loadError ? 'Failed to load' : 'No challenges yet'}</Text>
          <Text style={s.emptySub}>
            {loadError ? 'Check your connection and pull down to retry' : 'Check back soon'}
          </Text>
        </View>
      )}

      <Section
        title="⚡ Dagsverkefni"
        sub="Dagleg mission — breytist þrisvar í viku"
        items={dailyMissions}
      />
      <Section
        title="🔥 Viku & Mánaðar"
        sub="Endurnýjast sjálfkrafa — alltaf í gangi"
        items={recurringChallenges}
      />
      <Section
        title="🎉 Helgadagar & Sérstakir"
        sub="Curated challenges yfir árið"
        items={specialChallenges}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 2 },
  sectionSub: { fontSize: 12, color: C.muted2, marginBottom: 10 },

  card: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  cardContent: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: C.muted2 },

  joinBtn: { backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  joinBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border },
  joinBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  joinBtnTextDisabled: { color: C.muted2 },

  empty: { paddingTop: 60, alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  emptySub: { fontSize: 13, color: C.muted2, textAlign: 'center' },
});
