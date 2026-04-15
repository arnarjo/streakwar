import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Switch,
  KeyboardAvoidingView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../hooks/useAuth';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import {
  SCORING_MODE_LABELS, TIE_BREAK_LABELS,
} from '../types/database';
import type { ScoringMode, TieBreakRule } from '../types/database';
import { format, addDays } from 'date-fns';

const C = {
  bg: '#0C1117',
  card: '#151C24',
  border: 'rgba(255,255,255,0.07)',
  text: '#EEF4F8',
  muted: '#4A6070',
  dimmed: '#1E2A35',
  primary: '#F97316',
  error: '#EF4444',
};

const ALL_SCORING_MODES: ScoringMode[] = ['workouts', 'steps', 'distance_km', 'duration_min', 'calories', 'custom'];
const TIE_BREAK_OPTIONS: TieBreakRule[] = ['first_to_score', 'most_recent_activity', 'most_workouts'];

type Step = 1 | 2 | 3 | 4;

export default function CreateChallengeScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const { createChallenge } = useFitnessChallenges(profile?.id ?? '');

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 – Basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(addDays(new Date(), 30));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Step 2 – Scoring
  const [scoringModes, setScoringModes] = useState<ScoringMode[]>(['workouts']);
  const [pointsPerWorkout, setPointsPerWorkout] = useState('1');
  const [pointsPer1000Steps, setPointsPer1000Steps] = useState('1');
  const [pointsPerKm, setPointsPerKm] = useState('1');
  const [pointsPer30min, setPointsPer30min] = useState('1');

  // Step 3 – Rules
  const [backlogDays, setBacklogDays] = useState('7');
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [teamsMode, setTeamsMode] = useState(false);
  const [tieBreak, setTieBreak] = useState<TieBreakRule>('most_recent_activity');
  const [isPublic, setIsPublic] = useState(false);

  function toggleScoring(mode: ScoringMode) {
    setScoringModes(prev =>
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    );
  }

  function validateStep1(): boolean {
    if (!name.trim()) { Alert.alert('Error', 'Challenge name is required'); return false; }
    if (endDate <= startDate) { Alert.alert('Error', 'End date must be after start date'); return false; }
    return true;
  }

  function validateStep2(): boolean {
    if (scoringModes.length === 0) { Alert.alert('Error', 'Select at least one scoring mode'); return false; }
    return true;
  }

  async function handleCreate() {
    setSaving(true);
    const { error, challenge } = await createChallenge({
      name: name.trim(),
      description: description.trim(),
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      scoring_modes: scoringModes,
      points_per_workout: parseInt(pointsPerWorkout) || 1,
      points_per_1000_steps: parseInt(pointsPer1000Steps) || 1,
      points_per_km: parseFloat(pointsPerKm) || 1,
      points_per_30min: parseInt(pointsPer30min) || 1,
      custom_scoring: null,
      backlog_days_allowed: parseInt(backlogDays) || 7,
      require_photo_proof: requirePhoto,
      is_teams_mode: teamsMode,
      tie_break_rule: tieBreak,
      is_public: isPublic,
    });
    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      navigation.goBack();
      if (challenge) {
        navigation.navigate('ChallengeDetail', { challengeId: challenge.id });
      }
    }
  }

  const stepTitles: Record<Step, string> = {
    1: 'Basics',
    2: 'Scoring',
    3: 'Rules',
    4: 'Review',
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => step === 1 ? navigation.goBack() : setStep((step - 1) as Step)}>
            <Text style={s.backText}>{step === 1 ? 'Cancel' : '← Back'}</Text>
          </TouchableOpacity>
          <Text style={s.title}>New Challenge</Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Progress */}
        <View style={s.progressRow}>
          {([1, 2, 3, 4] as Step[]).map(n => (
            <View key={n} style={[s.progressDot, n <= step && s.progressDotActive]}>
              <Text style={[s.progressDotText, n <= step && { color: '#000' }]}>{n}</Text>
            </View>
          ))}
          <View style={s.progressLine} />
        </View>
        <Text style={s.stepLabel}>Step {step}: {stepTitles[step]}</Text>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Step 1: Basics ── */}
          {step === 1 && (
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
                    onChange={(_, d) => { setShowStartPicker(false); if (d) { setStartDate(d); if (d >= endDate) setEndDate(addDays(d, 30)); } }}
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
                    onChange={(_, d) => { setShowEndPicker(false); if (d) setEndDate(d); }}
                  />
                )}
              </View>
            </>
          )}

          {/* ── Step 2: Scoring ── */}
          {step === 2 && (
            <>
              <Text style={s.label}>SCORING (select one or more)</Text>
              {ALL_SCORING_MODES.map(mode => {
                const active = scoringModes.includes(mode);
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[s.toggleRow, active && s.toggleRowActive]}
                    onPress={() => toggleScoring(mode)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.toggleLabel}>{SCORING_MODE_LABELS[mode]}</Text>
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
            </>
          )}

          {/* ── Step 3: Rules ── */}
          {step === 3 && (
            <>
              <View style={s.inputGroup}>
                <Text style={s.label}>BACKLOG (days)</Text>
                <TextInput
                  style={s.input}
                  value={backlogDays}
                  onChangeText={setBacklogDays}
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor={C.dimmed}
                />
                <Text style={s.hint}>How many days back can workouts be logged?</Text>
              </View>

              <View style={s.switchRow}>
                <View>
                  <Text style={s.switchLabel}>Require photo proof?</Text>
                  <Text style={s.switchHint}>Participants must upload a photo</Text>
                </View>
                <Switch
                  value={requirePhoto}
                  onValueChange={setRequirePhoto}
                  trackColor={{ false: C.dimmed, true: C.primary }}
                  thumbColor="#fff"
                />
              </View>

              <View style={s.switchRow}>
                <View>
                  <Text style={s.switchLabel}>Teams mode?</Text>
                  <Text style={s.switchHint}>Divide participants into teams</Text>
                </View>
                <Switch
                  value={teamsMode}
                  onValueChange={setTeamsMode}
                  trackColor={{ false: C.dimmed, true: C.primary }}
                  thumbColor="#fff"
                />
              </View>

              <View style={s.switchRow}>
                <View>
                  <Text style={s.switchLabel}>Open to everyone?</Text>
                  <Text style={s.switchHint}>Appears in the Discover tab</Text>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: C.dimmed, true: C.primary }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={[s.label, { marginTop: 20 }]}>TIEBREAKER *</Text>
              <Text style={s.hint}>This will be shown to participants in advance</Text>
              {TIE_BREAK_OPTIONS.map(rule => (
                <TouchableOpacity
                  key={rule}
                  style={[s.toggleRow, tieBreak === rule && s.toggleRowActive]}
                  onPress={() => setTieBreak(rule)}
                >
                  <Text style={s.toggleLabel}>{TIE_BREAK_LABELS[rule]}</Text>
                  <View style={[s.radio, tieBreak === rule && s.radioActive]}>
                    {tieBreak === rule && <View style={s.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <>
              <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>{name}</Text>
                {description ? <Text style={s.summaryDesc}>{description}</Text> : null}
              </View>

              {[
                { label: 'Duration', value: `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}` },
                { label: 'Scoring', value: scoringModes.map(m => SCORING_MODE_LABELS[m]).join('\n') },
                { label: 'Tiebreaker', value: TIE_BREAK_LABELS[tieBreak] },
                { label: 'Backlog', value: `${backlogDays} days` },
                { label: 'Photo proof', value: requirePhoto ? 'Required' : 'Optional' },
                { label: 'Teams mode', value: teamsMode ? 'Yes' : 'No' },
                { label: 'Visibility', value: isPublic ? 'Public' : 'Invite only' },
              ].map(({ label, value }) => (
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
          )}

          {/* Next button for steps 1-3 */}
          {step < 4 && (
            <TouchableOpacity
              style={s.nextBtn}
              onPress={() => {
                if (step === 1 && !validateStep1()) return;
                if (step === 2 && !validateStep2()) return;
                setStep((step + 1) as Step);
              }}
              activeOpacity={0.85}
            >
              <Text style={s.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '800', color: C.text },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    position: 'relative',
  },
  progressLine: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    height: 1,
    backgroundColor: C.border,
    zIndex: -1,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  progressDotActive: { backgroundColor: C.primary, borderColor: C.primary },
  progressDotText: { fontSize: 12, fontWeight: '800', color: C.muted },
  stepLabel: {
    textAlign: 'center',
    fontSize: 13,
    color: C.muted,
    fontWeight: '600',
    marginBottom: 4,
  },

  scroll: { padding: 20, paddingBottom: 60 },
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
  dateBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dateBtnText: { color: C.text, fontSize: 14, fontWeight: '600' },

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
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: C.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },

  switchRow: {
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
  switchLabel: { fontSize: 14, color: C.text, fontWeight: '600' },
  switchHint: { fontSize: 11, color: C.muted, marginTop: 2 },

  summaryCard: {
    backgroundColor: C.primary + '12',
    borderWidth: 1,
    borderColor: C.primary + '30',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  summaryTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  summaryDesc: { fontSize: 14, color: C.muted, lineHeight: 20 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 12,
  },
  summaryLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  summaryValue: { fontSize: 13, color: C.text, fontWeight: '600', flex: 1, textAlign: 'right' },

  nextBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  nextBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  createBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
