import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';

import { C } from '../../theme';

interface StatsInputsProps {
  duration: string;
  setDuration: (value: string) => void;
  distance: string;
  setDistance: (value: string) => void;
  calories: string;
  setCalories: (value: string) => void;
  steps: string;
  setSteps: (value: string) => void;
}

export default function StatsInputs({
  duration,
  setDuration,
  distance,
  setDistance,
  calories,
  setCalories,
  steps,
  setSteps,
}: StatsInputsProps) {
  return (
    <>
      <Text style={s.sectionLabel}>STATS (optional)</Text>
      <View style={s.statsGrid}>
        <View style={s.statCard}>
          <View style={s.statCardHeader}>
            <Text style={s.statCardEmoji}>⏱</Text>
            <Text style={s.statCardLabel}>Duration (min)</Text>
          </View>
          <TextInput
            style={s.statCardField}
            placeholder="45"
            placeholderTextColor={C.dimmed}
            value={duration}
            onChangeText={setDuration}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={s.statCard}>
          <View style={s.statCardHeader}>
            <Text style={s.statCardEmoji}>📍</Text>
            <Text style={s.statCardLabel}>Distance (km)</Text>
          </View>
          <TextInput
            style={s.statCardField}
            placeholder="5.0"
            placeholderTextColor={C.dimmed}
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={s.statCard}>
          <View style={s.statCardHeader}>
            <Text style={s.statCardEmoji}>🔥</Text>
            <Text style={s.statCardLabel}>Calories</Text>
          </View>
          <TextInput
            style={s.statCardField}
            placeholder="300"
            placeholderTextColor={C.dimmed}
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
          />
        </View>
        <View style={s.statCard}>
          <View style={s.statCardHeader}>
            <Text style={s.statCardEmoji}>👟</Text>
            <Text style={s.statCardLabel}>Steps</Text>
          </View>
          <TextInput
            style={s.statCardField}
            placeholder="8000"
            placeholderTextColor={C.dimmed}
            value={steps}
            onChangeText={setSteps}
            keyboardType="number-pad"
          />
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  statCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  statCardEmoji: { fontSize: 13 },
  statCardLabel: { fontSize: 11.5, fontWeight: '600', color: C.muted },
  statCardField: {
    color: C.text,
    fontSize: 24,
    fontWeight: '700',
    padding: 0,
  },
});
