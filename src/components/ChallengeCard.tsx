import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { differenceInDays, parseISO, isAfter, isBefore } from 'date-fns';
import type { FitnessChallenge } from '../types/database';
import { SCORING_MODE_LABELS } from '../types/database';

const C = {
  card: '#151C24',
  border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8',
  muted: '#637C8F',
  primary: '#F97316',
  secondary: '#FBBF24',
  green: '#22C55E',
};

type Props = {
  challenge: FitnessChallenge;
  onPress: () => void;
  compact?: boolean;
};

export default function ChallengeCard({ challenge, onPress, compact }: Props) {
  const now = new Date();
  const start = parseISO(challenge.start_date);
  const end = parseISO(challenge.end_date);

  const isActive = isAfter(now, start) && isBefore(now, end);
  const isUpcoming = isBefore(now, start);
  const daysLeft = differenceInDays(end, now);
  const totalDays = differenceInDays(end, start);
  const daysElapsed = differenceInDays(now, start);
  const progress = isActive ? Math.min(1, Math.max(0, daysElapsed / totalDays)) : isUpcoming ? 0 : 1;

  const statusLabel = isUpcoming
    ? `Starts in ${differenceInDays(start, now)}d`
    : isActive
    ? daysLeft <= 1 ? 'Last day!' : `${daysLeft} days left`
    : 'Ended';
  const statusColor = isUpcoming ? C.muted : isActive ? (daysLeft <= 3 ? '#EF4444' : C.green) : C.muted;

  const scoringLabels = (challenge.scoring_modes ?? [])
    .slice(0, 2)
    .map(m => (SCORING_MODE_LABELS[m] ?? m)?.split(' ')[0] ?? '')
    .filter(Boolean)
    .join(' · ');

  const iconEmoji = scoringLabels.includes('Steps') ? '👟' : scoringLabels.includes('Calor') ? '🔥' : scoringLabels.includes('Dist') ? '📍' : '🏆';

  if (compact) {
    return (
      <TouchableOpacity style={s.compactRow} onPress={onPress} activeOpacity={0.8} accessibilityLabel={`Challenge: ${challenge.name}`} accessibilityRole="button">
        <View style={s.compactIcon}>
          <Text style={{ fontSize: 18 }}>{iconEmoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.compactName} numberOfLines={1}>{challenge.name}</Text>
          <Text style={s.compactSub} numberOfLines={1}>
            {challenge.my_score != null ? `${challenge.my_score} pts` : scoringLabels || 'Challenge'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {challenge.my_rank != null && (
            <Text style={s.compactRank}>#{challenge.my_rank}</Text>
          )}
          <View style={[s.statusBadge, { borderColor: statusColor + '40', backgroundColor: statusColor + '15' }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8} accessibilityLabel={`Challenge: ${challenge.name}`} accessibilityRole="button">
      {/* Top row */}
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{challenge.name}</Text>
          <Text style={s.scoring}>{scoringLabels}</Text>
          {challenge.participant_count !== undefined && (
            <Text style={s.participantBadge}>
              👥 {challenge.participant_count}{challenge.max_participants ? `/${challenge.max_participants}` : ''}
            </Text>
          )}
        </View>
        <View style={[s.statusBadge, { borderColor: statusColor + '40', backgroundColor: statusColor + '15' }]}>
          <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Progress bar */}
      {isActive && (
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      )}

      {/* Bottom row */}
      <View style={s.bottomRow}>
        {challenge.my_rank != null && (
          <View style={s.rankHero}>
            <Text style={s.rankHeroText}>#{challenge.my_rank}</Text>
            {challenge.my_score != null && (
              <Text style={s.rankHeroScore}>{challenge.my_score} pts</Text>
            )}
          </View>
        )}
        <View style={{ flex: 1 }} />
        {challenge.is_public && (
          <View style={s.publicBadge}>
            <Text style={s.publicText}>Public</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 2 },
  scoring: { fontSize: 12, color: C.muted },
  participantBadge: { fontSize: 11, color: C.muted, marginTop: 2, fontWeight: '600' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 3,
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankHero: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rankHeroText: { fontSize: 22, fontWeight: '900', color: C.primary },
  rankHeroScore: { fontSize: 13, fontWeight: '600', color: C.muted },
  publicBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  publicText: { fontSize: 11, color: C.muted, fontWeight: '600' },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    backgroundColor: '#151C24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 8,
  },
  compactIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.primary + '24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactName: { fontSize: 14, fontWeight: '700', color: C.text },
  compactSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  compactRank: { fontSize: 12, fontWeight: '700', color: C.primary },
});
