import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
} from 'react-native';
import { C } from '../../theme';
import { SCORING_MODE_LABELS } from '../../types/database';
import type { ScoringMode } from '../../types/database';

const ALL_SCORING_MODES: ScoringMode[] = ['workouts', 'days_active', 'steps', 'distance_km', 'duration_min', 'calories', 'custom'];

interface Step2ScoringProps {
  scoringModes: ScoringMode[];
  toggleScoring: (mode: ScoringMode) => void;
  isPro: boolean;
  pointsPerWorkout: string;
  setPointsPerWorkout: (v: string) => void;
  pointsPer1000Steps: string;
  setPointsPer1000Steps: (v: string) => void;
  pointsPerKm: string;
  setPointsPerKm: (v: string) => void;
  pointsPer30min: string;
  setPointsPer30min: (v: string) => void;
}

export default function Step2Scoring({
  scoringModes, toggleScoring, isPro,
  pointsPerWorkout, setPointsPerWorkout,
  pointsPer1000Steps, setPointsPer1000Steps,
  pointsPerKm, setPointsPerKm,
  pointsPer30min, setPointsPer30min,
}: Step2ScoringProps) {
  return (
    <>
      <Text style={s.label}>SCORING (select one or more)</Text>
      {ALL_SCORING_MODES.map(mode => {
        const active = scoringModes.includes(mode);
        const isProMode = mode === 'custom';
        return (
          <TouchableOpacity
            key={mode}
            style={[s.toggleRow, active && s.toggleRowActive]}
            onPress={() => toggleScoring(mode)}
            activeOpacity={0.75}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Text style={s.toggleLabel}>{SCORING_MODE_LABELS[mode]}</Text>
              {isProMode && !isPro && (
                <View style={{ backgroundColor: '#FBBF2420', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#FBBF24', letterSpacing: 0.5 }}>PRO</Text>
                </View>
              )}
            </View>
            <View style={[s.checkbox, active && s.checkboxActive]}>
              {active && <Text style={s.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        );
      })}

      {scoringModes.includes('workouts') && (
        <View style={s.inputGroup}>
          <Text style={s.label}>POINTS PER WORKOUT</Text>
          <TextInput style={s.input} value={pointsPerWorkout} onChangeText={setPointsPerWorkout} keyboardType="number-pad" placeholderTextColor={C.dimmed} />
        </View>
      )}
      {scoringModes.includes('steps') && (
        <View style={s.inputGroup}>
          <Text style={s.label}>POINTS PER 1,000 STEPS</Text>
          <TextInput style={s.input} value={pointsPer1000Steps} onChangeText={setPointsPer1000Steps} keyboardType="decimal-pad" placeholderTextColor={C.dimmed} />
        </View>
      )}
      {scoringModes.includes('distance_km') && (
        <View style={s.inputGroup}>
          <Text style={s.label}>POINTS PER KM</Text>
          <TextInput style={s.input} value={pointsPerKm} onChangeText={setPointsPerKm} keyboardType="decimal-pad" placeholderTextColor={C.dimmed} />
        </View>
      )}
      {scoringModes.includes('duration_min') && (
        <View style={s.inputGroup}>
          <Text style={s.label}>POINTS PER 30 MINUTES</Text>
          <TextInput style={s.input} value={pointsPer30min} onChangeText={setPointsPer30min} keyboardType="number-pad" placeholderTextColor={C.dimmed} />
        </View>
      )}
      {scoringModes.includes('custom') && (
        <View style={s.inputGroup}>
          <Text style={[s.hint, { color: C.primary }]}>⚡ Custom scoring formula editor coming soon. For now, enable other modes above to score workouts.</Text>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 8 },
  hint: { fontSize: 12, color: C.muted, marginTop: 5 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: C.text,
    fontSize: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 8,
  },
  toggleRowActive: { borderColor: C.primary + '50', backgroundColor: C.primary + '10' },
  toggleLabel: { fontSize: 14, color: C.text, fontWeight: '600', flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },
  checkmark: { color: '#000', fontSize: 13, fontWeight: '900' },
});
