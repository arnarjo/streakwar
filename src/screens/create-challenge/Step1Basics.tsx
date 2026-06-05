import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays } from 'date-fns';
import { C } from '../../theme';

const CHALLENGE_TEMPLATES: Array<{
  icon: string; label: string; name: string; days: number;
  scoring: string[]; pw?: string; ps?: string; pk?: string; pd?: string;
}> = [
  { icon: '💪', label: '30 Days', name: '30 Day Fitness', days: 30, scoring: ['workouts'], pw: '1' },
  { icon: '👟', label: 'Steps', name: 'Step Warriors', days: 14, scoring: ['steps'], ps: '1' },
  { icon: '🏃', label: 'Running Week', name: 'Run This Week', days: 7, scoring: ['distance_km'], pk: '1' },
  { icon: '🔥', label: 'HIIT', name: 'HIIT Week Blitz', days: 7, scoring: ['duration_min'], pd: '2' },
];

const DURATION_PRESETS: Array<{ label: string; days: number | null }> = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: 'Custom', days: null },
];

export interface Step1Props {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  startDate: Date;
  setStartDate: (d: Date) => void;
  endDate: Date;
  setEndDate: (d: Date) => void;
  showStartPicker: boolean;
  setShowStartPicker: (v: boolean) => void;
  showEndPicker: boolean;
  setShowEndPicker: (v: boolean) => void;
  durationPreset: number | null;
  applyPreset: (days: number | null) => void;
  applyTemplate: (t: typeof CHALLENGE_TEMPLATES[0]) => void;
}

export { CHALLENGE_TEMPLATES };

export default function Step1Basics({
  name, setName,
  description, setDescription,
  startDate, setStartDate,
  endDate, setEndDate,
  showStartPicker, setShowStartPicker,
  showEndPicker, setShowEndPicker,
  durationPreset,
  applyPreset,
  applyTemplate,
}: Step1Props) {
  return (
    <>
      <View style={s.inputGroup}>
        <Text style={s.label}>CHALLENGE NAME *</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. January Fitness Month"
          placeholderTextColor={C.dimmed}
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Text style={[s.charCounter, name.length > 50 && s.charCounterWarn]}>
          {name.length}/60
        </Text>
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>QUICK SETUP</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {CHALLENGE_TEMPLATES.map(t => (
            <TouchableOpacity key={t.label} style={s.templateBtn} onPress={() => applyTemplate(t)}>
              <Text style={s.templateIcon}>{t.icon}</Text>
              <Text style={s.templateLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>DURATION</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DURATION_PRESETS.map(preset => {
            const active = preset.days === durationPreset;
            return (
              <TouchableOpacity
                key={String(preset.days)}
                style={[s.presetBtn, active && s.presetBtnActive]}
                onPress={() => applyPreset(preset.days)}
              >
                <Text style={[s.presetBtnText, active && s.presetBtnTextActive]}>{preset.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>DESCRIPTION (optional)</Text>
        <TextInput
          style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
          placeholder="Describe the challenge..."
          placeholderTextColor={C.dimmed}
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>START DATE</Text>
        <TouchableOpacity style={s.dateBtn} onPress={() => setShowStartPicker(!showStartPicker)}>
          <Text style={s.dateBtnText}>📅 {format(startDate, 'EEEE, MMMM d, yyyy')}</Text>
        </TouchableOpacity>
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_, d) => {
              setShowStartPicker(false);
              if (d) {
                setStartDate(d);
                applyPreset(null);
                if (d >= endDate) setEndDate(addDays(d, 30));
              }
            }}
          />
        )}
      </View>

      <View style={s.inputGroup}>
        <Text style={s.label}>END DATE</Text>
        <TouchableOpacity style={s.dateBtn} onPress={() => setShowEndPicker(!showEndPicker)}>
          <Text style={s.dateBtnText}>🏁 {format(endDate, 'EEEE, MMMM d, yyyy')}</Text>
        </TouchableOpacity>
        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={addDays(startDate, 1)}
            onChange={(_, d) => {
              setShowEndPicker(false);
              if (d) { setEndDate(d); applyPreset(null); }
            }}
          />
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 8 },
  templateBtn: {
    flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 4,
  },
  templateIcon: { fontSize: 20 },
  templateLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.5 },
  presetBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  presetBtnActive: { borderColor: C.primary, backgroundColor: C.primary + '18' },
  presetBtnText: { fontSize: 13, fontWeight: '700', color: C.muted },
  presetBtnTextActive: { color: C.primary },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: C.text, fontSize: 15,
  },
  dateBtn: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
  },
  dateBtnText: { color: C.text, fontSize: 14, fontWeight: '600' },
  charCounter: { fontSize: 11, color: C.muted, marginTop: 4, textAlign: 'right' },
  charCounterWarn: { color: C.error },
});
