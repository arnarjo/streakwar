import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  challengeName: string;
  renewalType: 'weekly' | 'monthly' | 'none';
  rank: number | null;
  score: number;
  username: string;
  inviteCode: string;
}

// Rendered off-screen and captured by react-native-view-shot.
// forwardRef so the parent can pass the ref to ViewShot.
const ShareCard = forwardRef<View, Props>(
  ({ challengeName, renewalType, rank, score, username, inviteCode }, ref) => {
    const badge =
      renewalType === 'weekly' ? { label: 'VIKU', color: '#F97316' } :
      renewalType === 'monthly' ? { label: 'MÁNAÐAR', color: '#F59E0B' } :
      { label: 'CHALLENGE', color: '#8B5CF6' };

    const rankLabel = rank ? `#${rank}` : '–';

    return (
      <View ref={ref} style={s.card} collapsable={false}>
        {/* Background gradient strips */}
        <View style={[s.accent, { backgroundColor: badge.color + '15' }]} />

        {/* Badge */}
        <View style={[s.badge, { backgroundColor: badge.color + '25', borderColor: badge.color + '60' }]}>
          <Text style={[s.badgeText, { color: badge.color }]}>🔥 {badge.label}</Text>
        </View>

        {/* Challenge name */}
        <Text style={s.name} numberOfLines={2}>{challengeName}</Text>

        {/* Rank */}
        <View style={s.rankArea}>
          <Text style={[s.rankNum, { color: badge.color }]}>{rankLabel}</Text>
          <Text style={s.rankLabel}>SÆTI</Text>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>{score}</Text>
            <Text style={s.statLabel}>STIG</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statValue}>@{username}</Text>
            <Text style={s.statLabel}>NOTANDI</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerBrand}>STREAKWAR</Text>
          <Text style={s.footerCode}>Kóði: {inviteCode}</Text>
        </View>
      </View>
    );
  }
);

export default ShareCard;

const s = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: '#0C1117',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    gap: 16,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  name: { fontSize: 22, fontWeight: '900', color: '#EEF4F8', lineHeight: 28 },
  rankArea: { alignItems: 'center', paddingVertical: 8 },
  rankNum: { fontSize: 72, fontWeight: '900', lineHeight: 76 },
  rankLabel: { fontSize: 12, fontWeight: '700', color: '#4A6070', letterSpacing: 2, marginTop: -4 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, padding: 14,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#EEF4F8' },
  statLabel: { fontSize: 10, color: '#4A6070', letterSpacing: 1, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)' },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 12,
  },
  footerBrand: { fontSize: 14, fontWeight: '900', color: '#F97316', letterSpacing: 2 },
  footerCode: { fontSize: 12, color: '#4A6070', fontWeight: '600' },
});
