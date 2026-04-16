import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { differenceInDays, parseISO, isAfter, isBefore } from 'date-fns';
import type { FitnessChallenge } from '../types/database';
import { SCORING_MODE_LABELS } from '../types/database';

const C = {
  card: '#151C24',
  border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8',
  muted: '#4A6070',
  primary: '#F97316',
  secondary: '#FBBF24',
  green: '#22C55E',
};

type Props = {
  challenge: FitnessChallenge;
  onPress: () => void;
};

export default function ChallengeCard({ challenge, onPress }: Props) {
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

  const scoringLabels = challenge.scoring_modes
    .slice(0, 2)
    .map(m => SCORING_MODE_LABELS[m].split(' ')[0])
    .join(' · ');

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
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
          <View style={s.rankBadge}>
            <Text style={s.rankText}>#{challenge.my_rank}</Text>
          </View>
        )}
        {challenge.my_score != null && (
          <Text style={s.scoreText}>{challenge.my_score} pts</Text>
        )}
        <View style={{ flex: 1 }} />
        {challenge.participant_count != null && (
          <Text style={s.participants}>👥 {challenge.participant_count}</Text>
        )}
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
    gap: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 2 },
  scoring: { fontSize: 12, color: C.muted },
  participantBadge: { fontSize: 11, color: '#4A6070', marginTop: 2, fontWeight: '600' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBadge: {
    backgroundColor: C.primary + '20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankText: { fontSize: 12, fontWeight: '800', color: C.primary },
  scoreText: { fontSize: 13, fontWeight: '600', color: C.text },
  participants: { fontSize: 12, color: C.muted },
  publicBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  publicText: { fontSize: 11, color: C.muted, fontWeight: '600' },
});
