import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform,
  KeyboardAvoidingView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { usePremium } from '../hooks/usePremium';
import UpgradeModal from '../components/UpgradeModal';
import Step1Basics, { type ChallengeTemplate } from '../components/createChallenge/Step1Basics';
import Step2Scoring from '../components/createChallenge/Step2Scoring';
import Step3Rules from '../components/createChallenge/Step3Rules';
import Step4Review from '../components/createChallenge/Step4Review';
import type { ScoringMode, TieBreakRule, RenewalType } from '../types/database';
import { format, addDays } from 'date-fns';
import { C } from '../theme';
import type { RootStackNavigationProp } from '../navigation/types';

type Step = 1 | 2 | 3 | 4;

export default function CreateChallengeScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<RootStackNavigationProp>();
  const { createChallenge } = useFitnessChallenges(profile?.id ?? '');
  const { isPro, offering, purchase, restore } = usePremium(profile?.id ?? '');

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [upgradeVisible, setUpgradeVisible] = useState(false);

  // Step 1 – Basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(addDays(new Date(), 30));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [durationPreset, setDurationPreset] = useState<number | null>(30); // days, null = custom

  function applyPreset(days: number | null) {
    setDurationPreset(days);
    if (days !== null) {
      const start = new Date();
      setStartDate(start);
      setEndDate(addDays(start, days));
    }
  }

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
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
  const [renewalType, setRenewalType] = useState<RenewalType>('none');

  function applyTemplate(t: ChallengeTemplate) {
    setName(t.name);
    applyPreset(t.days);
    setScoringModes(t.scoring);
    if (t.pw) setPointsPerWorkout(t.pw);
    if (t.ps) setPointsPer1000Steps(t.ps);
    if (t.pk) setPointsPerKm(t.pk);
    if (t.pd) setPointsPer30min(t.pd);
  }

  function toggleScoring(mode: ScoringMode) {
    if (mode === 'custom' && !isPro) { setUpgradeVisible(true); return; }
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

  function validateStep3(): boolean {
    const backlogNum = parseInt(backlogDays, 10);
    if (isNaN(backlogNum) || backlogNum < 0) {
      Alert.alert('Invalid Backlog', 'Backlog days must be 0 or a positive number.');
      return false;
    }
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
      max_participants: maxParticipants,
      renewal_type: isPublic ? renewalType : 'none',
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
            <Step1Basics
              name={name}
              setName={setName}
              description={description}
              setDescription={setDescription}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              showStartPicker={showStartPicker}
              setShowStartPicker={setShowStartPicker}
              showEndPicker={showEndPicker}
              setShowEndPicker={setShowEndPicker}
              durationPreset={durationPreset}
              applyPreset={applyPreset}
              applyTemplate={applyTemplate}
            />
          )}

          {/* ── Step 2: Scoring ── */}
          {step === 2 && (
            <Step2Scoring
              scoringModes={scoringModes}
              toggleScoring={toggleScoring}
              isPro={isPro}
              pointsPerWorkout={pointsPerWorkout}
              setPointsPerWorkout={setPointsPerWorkout}
              pointsPer1000Steps={pointsPer1000Steps}
              setPointsPer1000Steps={setPointsPer1000Steps}
              pointsPerKm={pointsPerKm}
              setPointsPerKm={setPointsPerKm}
              pointsPer30min={pointsPer30min}
              setPointsPer30min={setPointsPer30min}
            />
          )}

          {/* ── Step 3: Rules ── */}
          {step === 3 && (
            <Step3Rules
              backlogDays={backlogDays}
              setBacklogDays={setBacklogDays}
              isPro={isPro}
              setUpgradeVisible={setUpgradeVisible}
              requirePhoto={requirePhoto}
              setRequirePhoto={setRequirePhoto}
              teamsMode={teamsMode}
              setTeamsMode={setTeamsMode}
              isPublic={isPublic}
              setIsPublic={setIsPublic}
              renewalType={renewalType}
              setRenewalType={setRenewalType}
              maxParticipants={maxParticipants}
              setMaxParticipants={setMaxParticipants}
              tieBreak={tieBreak}
              setTieBreak={setTieBreak}
            />
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <Step4Review
              name={name}
              description={description}
              startDate={startDate}
              endDate={endDate}
              scoringModes={scoringModes}
              tieBreak={tieBreak}
              backlogDays={backlogDays}
              requirePhoto={requirePhoto}
              teamsMode={teamsMode}
              isPublic={isPublic}
              maxParticipants={maxParticipants}
              renewalType={renewalType}
              saving={saving}
              handleCreate={handleCreate}
            />
          )}

          {/* Next button for steps 1-3 */}
          {step < 4 && (
            <TouchableOpacity
              style={s.nextBtn}
              onPress={() => {
                if (step === 1 && !validateStep1()) return;
                if (step === 2 && !validateStep2()) return;
                if (step === 3 && !validateStep3()) return;
                setStep((step + 1) as Step);
              }}
              activeOpacity={0.85}
            >
              <Text style={s.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <UpgradeModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        offering={offering}
        onPurchase={purchase}
        onRestore={restore}
        reason="This feature requires a Pro subscription."
      />
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

  nextBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  nextBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
