import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { format } from 'date-fns';
import { SCORING_MODE_LABELS, TIE_BREAK_LABELS } from '../../types/database';
import type { ScoringMode, TieBreakRule, RenewalType } from '../../types/database';
import { C } from '../../theme';

export interface Step4Props {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  scoringModes: ScoringMode[];
  tieBreak: TieBreakRule;
  backlogDays: string;
  requirePhoto: boolean;
  teamsMode: boolean;
  isPublic: boolean;
  maxParticipants: number | null;
  renewalType: RenewalType;
  saving: boolean;
  handleCreate: () => void;
  onEditStep: (step: number) => void;
}

export default function Step4Preview({
  name, description, startDate, endDate,
  scoringModes, tieBreak, backlogDays,
  requirePhoto, teamsMode, isPublic, maxParticipants,
  renewalType, saving, handleCreate, onEditStep,
}: Step4Props) {
  const basicsRows = [
    { label: 'Duration', value: `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}` },
  ];
  const scoringRows = [
    { label: 'Scoring', value: scoringModes.map(m => SCORING_MODE_LABELS[m]).join('\n') },
  ];
  const rulesRows = [
    { label: 'Tiebreaker', value: TIE_BREAK_LABELS[tieBreak] },
    { label: 'Backlog', value: `${backlogDays} days` },
    { label: 'Photo proof', value: requirePhoto ? 'Required' : 'Optional' },
    { label: 'Teams mode', value: teamsMode ? 'Yes' : 'No' },
    { label: 'Visibility', value: isPublic ? 'Public' : 'Invite only' },
    { label: 'Max participants', value: maxParticipants == null ? 'Unlimited' : String(maxParticipants) },
    ...(isPublic && renewalType !== 'none' ? [{ label: 'Auto-renewal', value: renewalType === 'weekly' ? '🔥 Weekly' : '🏆 Monthly' }] : []),
  ];

  return (
    <>
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>{name}</Text>
        {description ? <Text style={s.summaryDesc}>{description}</Text> : null}
      </View>

      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>Basics</Text>
        <TouchableOpacity onPress={() => onEditStep(1)}>
          <Text style={s.editLink}>Edit</Text>
        </TouchableOpacity>
      </View>
      {basicsRows.map(({ label, value }) => (
        <View key={label} style={s.summaryRow}>
          <Text style={s.summaryLabel}>{label}</Text>
          <Text style={s.summaryValue}>{value}</Text>
        </View>
      ))}

      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>Scoring</Text>
        <TouchableOpacity onPress={() => onEditStep(2)}>
          <Text style={s.editLink}>Edit</Text>
        </TouchableOpacity>
      </View>
      {scoringRows.map(({ label, value }) => (
        <View key={label} style={s.summaryRow}>
          <Text style={s.summaryLabel}>{label}</Text>
          <Text style={s.summaryValue}>{value}</Text>
        </View>
      ))}

      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>Rules</Text>
        <TouchableOpacity onPress={() => onEditStep(3)}>
          <Text style={s.editLink}>Edit</Text>
        </TouchableOpacity>
      </View>
      {rulesRows.map(({ label, value }) => (
        <View key={label} style={s.summaryRow}>
          <Text style={s.summaryLabel}>{label}</Text>
          <Text style={s.summaryValue}>{value}</Text>
        </View>
      ))}

      <TouchableOpacity
        style={[s.createBtn, saving && { opacity: 0.5 }]}
        onPress={handleCreate}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#000" />
          : <Text style={s.createBtnText}>Create challenge 🚀</Text>
        }
      </TouchableOpacity>
    </>
  );
}

const s = StyleSheet.create({
  summaryCard: {
    backgroundColor: C.primary + '12', borderWidth: 1, borderColor: C.primary + '30',
    borderRadius: 14, padding: 16, marginBottom: 12, gap: 6,
  },
  summaryTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  summaryDesc: { fontSize: 14, color: C.muted, lineHeight: 20 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.card, borderRadius: 10, padding: 12, marginBottom: 6, gap: 12,
  },
  summaryLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  summaryValue: { fontSize: 13, color: C.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  sectionHeaderText: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  editLink: { fontSize: 13, fontWeight: '700', color: C.primary },
  createBtn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
  },
  createBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
