import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView, StatusBar, Animated, Easing,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../hooks/useAuth';
import { useWorkoutFeed } from '../hooks/useWorkoutFeed';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import type { ActivityType, WorkoutPost } from '../types/database';
import { scheduleStreakReminder } from '../lib/streakNotification';
import { useStreaks } from '../hooks/useStreaks';
import { format } from 'date-fns';

import { C } from '../theme';
import type { RootStackNavigationProp, RootStackRouteProp } from '../navigation/types';
import ActivityTypePicker from '../components/logWorkout/ActivityTypePicker';
import StatsInputs from '../components/logWorkout/StatsInputs';
import MediaPicker from '../components/logWorkout/MediaPicker';
import SuccessOverlay from '../components/logWorkout/SuccessOverlay';

let HapticsModule: any = null;
try { HapticsModule = require('expo-haptics'); } catch {}

export default function LogWorkoutScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RootStackRouteProp<'LogWorkout'>>();
  const preselectedChallengeId = route.params?.challengeId;
  const editWorkout = route.params?.editWorkout;
  const isEditMode = !!editWorkout;

  const { logWorkout, updateWorkout, pickMedia } = useWorkoutFeed(profile?.id ?? '');
  const { myChallenges } = useFitnessChallenges(profile?.id ?? '');
  const { streak } = useStreaks(profile?.id ?? '');

  const [activityType, setActivityType] = useState<ActivityType>(editWorkout?.activity_type ?? 'run');
  const [duration, setDuration] = useState(editWorkout?.duration_minutes != null ? String(editWorkout.duration_minutes) : '');
  const [distance, setDistance] = useState(editWorkout?.distance_km != null ? String(editWorkout.distance_km) : '');
  const [calories, setCalories] = useState(editWorkout?.calories != null ? String(editWorkout.calories) : '');
  const [steps, setSteps] = useState(editWorkout?.steps != null ? String(editWorkout.steps) : '');
  const [caption, setCaption] = useState(editWorkout?.caption ?? '');
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(
    editWorkout?.challenge_id ?? preselectedChallengeId ?? null
  );
  const [workoutDate, setWorkoutDate] = useState(
    editWorkout?.workout_date ? new Date(editWorkout.workout_date) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [mediaUri, setMediaUri] = useState<string | null>(editWorkout?.media_url ?? null);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function toggleTimer() {
    if (timerRunning) {
      clearInterval(timerRef.current!);
      setTimerRunning(false);
    } else {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
      setTimerRunning(true);
    }
  }

  function useTimerDuration() {
    const mins = Math.max(1, Math.round(timerSeconds / 60));
    setDuration(String(mins));
    clearInterval(timerRef.current!);
    setTimerRunning(false);
    setTimerSeconds(0);
  }

  const timerDisplay = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;

  const activeChallenges = myChallenges.filter(c => c.status === 'active');

  function showSuccessAndGoBack() {
    HapticsModule?.notificationAsync?.(HapticsModule?.NotificationFeedbackType?.Success)?.catch?.(() => {});
    setShowSuccess(true);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          navigation.goBack();
        });
      }, 900);
    });
  }

  async function handlePickMedia() {
    const uri = await pickMedia();
    if (uri) setMediaUri(uri);
  }

  async function handleSave() {
    if (!profile?.id) return;

    const durationVal = duration !== '' ? parseFloat(duration) : null;
    const distanceVal = distance !== '' ? parseFloat(distance) : null;
    const caloriesVal = calories !== '' ? parseInt(calories, 10) : null;
    const stepsVal = steps !== '' ? parseInt(steps, 10) : null;

    if (durationVal !== null && (isNaN(durationVal) || durationVal <= 0)) {
      Alert.alert('Invalid Input', 'Duration must be a positive number.');
      return;
    }
    if (distanceVal !== null && (isNaN(distanceVal) || distanceVal <= 0)) {
      Alert.alert('Invalid Input', 'Distance must be a positive number.');
      return;
    }
    if (caloriesVal !== null && (isNaN(caloriesVal) || caloriesVal <= 0)) {
      Alert.alert('Invalid Input', 'Calories must be a positive number.');
      return;
    }
    if (stepsVal !== null && (isNaN(stepsVal) || stepsVal <= 0)) {
      Alert.alert('Invalid Input', 'Steps must be a positive number.');
      return;
    }

    const hasMetric = durationVal !== null || distanceVal !== null || caloriesVal !== null || stepsVal !== null || caption.trim();
    if (!hasMetric) {
      Alert.alert('Missing info', 'Add at least one stat or a note before saving.');
      return;
    }

    const workoutDateStr = format(workoutDate, 'yyyy-MM-dd');

    setSaving(true);
    let error: string | null = null;

    if (isEditMode && editWorkout) {
      ({ error } = await updateWorkout(editWorkout.id, {
        activity_type: activityType,
        duration_minutes: durationVal,
        distance_km: distanceVal,
        calories: caloriesVal,
        steps: stepsVal,
        caption,
        workout_date: workoutDateStr,
        imageUri: mediaUri,
      }));
    } else {
      ({ error } = await logWorkout({
        activity_type: activityType,
        duration_minutes: durationVal,
        distance_km: distanceVal,
        calories: caloriesVal,
        steps: stepsVal,
        caption,
        challenge_id: selectedChallengeId,
        workout_date: workoutDateStr,
        source: 'manual',
        imageUri: mediaUri ?? undefined,
      }));
    }
    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      // Reschedule the streak reminder so the evening notification reflects
      // the updated streak. Edit mode doesn't change the streak count.
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const firstName = profile?.full_name?.split(' ')[0] ?? profile?.username;
      // Use current streak value — the server-side increment hasn't arrived yet
      // via realtime. The notification scheduler will be called again by
      // usePushNotifications once the streak row updates.
      scheduleStreakReminder(
        streak?.current_streak ?? 0,
        workoutDateStr === todayStr ? todayStr : (streak?.last_active_date ?? null),
        firstName
      ).catch(() => {});
      showSuccessAndGoBack();
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.title}>{isEditMode ? 'Edit Workout' : 'Log Workout'}</Text>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Activity type picker */}
          <ActivityTypePicker activityType={activityType} setActivityType={setActivityType} />

          {/* Timer */}
          {!isEditMode && (
            <>
              <Text style={s.sectionLabel}>WORKOUT TIMER</Text>
              <View style={s.timerCard}>
                <Text style={s.timerDisplay}>{timerDisplay}</Text>
                <View style={s.timerBtns}>
                  <TouchableOpacity
                    style={[s.timerBtn, timerRunning && s.timerBtnActive]}
                    onPress={toggleTimer}
                  >
                    <Text style={s.timerBtnText}>{timerRunning ? '⏸ Pause' : timerSeconds > 0 ? '▶ Resume' : '▶ Start'}</Text>
                  </TouchableOpacity>
                  {timerSeconds > 0 && !timerRunning && (
                    <TouchableOpacity style={s.timerUseBtn} onPress={useTimerDuration}>
                      <Text style={s.timerUseBtnText}>Use time →</Text>
                    </TouchableOpacity>
                  )}
                  {timerSeconds > 0 && (
                    <TouchableOpacity onPress={() => { clearInterval(timerRef.current!); setTimerRunning(false); setTimerSeconds(0); }}>
                      <Text style={s.timerResetText}>Reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          )}

          {/* Stats */}
          <StatsInputs
            duration={duration}
            setDuration={setDuration}
            distance={distance}
            setDistance={setDistance}
            calories={calories}
            setCalories={setCalories}
            steps={steps}
            setSteps={setSteps}
          />

          {/* Date */}
          <Text style={s.sectionLabel}>DATE</Text>
          <View style={s.dateChipRow}>
            {(() => {
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              const isToday = format(workoutDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
              const isYesterday = format(workoutDate, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd');
              const isCustom = !isToday && !isYesterday;
              return (
                <>
                  <TouchableOpacity
                    style={[s.dateChip, isToday && s.dateChipActive]}
                    onPress={() => { setWorkoutDate(today); setShowDatePicker(false); }}
                  >
                    <Text style={[s.dateChipText, isToday && s.dateChipTextActive]}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.dateChip, isYesterday && s.dateChipActive]}
                    onPress={() => { setWorkoutDate(yesterday); setShowDatePicker(false); }}
                  >
                    <Text style={[s.dateChipText, isYesterday && s.dateChipTextActive]}>Yesterday</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.dateChip, isCustom && s.dateChipActive]}
                    onPress={() => setShowDatePicker(!showDatePicker)}
                  >
                    <Text style={[s.dateChipText, isCustom && s.dateChipTextActive]}>
                      {isCustom ? format(workoutDate, 'MMM d') : 'Pick date'}
                    </Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={workoutDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setWorkoutDate(date);
              }}
              style={{ backgroundColor: C.card }}
            />
          )}

          {/* Challenge selector */}
          {activeChallenges.length > 0 && (
            <>
              <Text style={s.sectionLabel}>CHALLENGE (optional)</Text>
              <View style={s.challengeList}>
                <TouchableOpacity
                  style={[s.challengeChip, !selectedChallengeId && s.challengeChipActive]}
                  onPress={() => setSelectedChallengeId(null)}
                >
                  <Text style={[s.challengeChipText, !selectedChallengeId && { color: C.primary }]}>None</Text>
                </TouchableOpacity>
                {activeChallenges.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.challengeChip, selectedChallengeId === c.id && s.challengeChipActive]}
                    onPress={() => setSelectedChallengeId(c.id)}
                  >
                    <Text
                      style={[s.challengeChipText, selectedChallengeId === c.id && { color: C.primary }]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Photo */}
          <MediaPicker
            mediaUri={mediaUri}
            onPickMedia={handlePickMedia}
            onRemoveMedia={() => setMediaUri(null)}
          />

          {/* Caption */}
          <Text style={s.sectionLabel}>CAPTION (optional)</Text>
          <TextInput
            style={s.captionInput}
            placeholder="Describe your workout..."
            placeholderTextColor={C.dimmed}
            value={caption}
            onChangeText={setCaption}
            multiline
            numberOfLines={3}
          />

          {/* Save */}
          <TouchableOpacity
            style={[s.saveBigBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={s.saveBigBtnText}>Save workout 💪</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {showSuccess && (
        <SuccessOverlay successOpacity={successOpacity} successScale={successScale} />
      )}
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
  cancelText: { color: C.muted, fontSize: 15, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '800', color: C.text },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },

  scroll: { padding: 20, gap: 0, paddingBottom: 60 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 20,
  },

  dateChipRow: { flexDirection: 'row', gap: 8 },
  dateChip: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipActive: {
    backgroundColor: C.primary + '15',
    borderColor: C.primary + '50',
  },
  dateChipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  dateChipTextActive: { color: C.primary },

  challengeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  challengeChip: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    maxWidth: 200,
  },
  challengeChipActive: {
    borderColor: C.primary + '60',
    backgroundColor: C.primary + '15',
  },
  challengeChipText: { color: C.muted, fontSize: 13, fontWeight: '600' },

  captionInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: C.text,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  timerCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  timerDisplay: { fontSize: 42, fontWeight: '900', color: C.text, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  timerBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timerBtn: { backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 9 },
  timerBtnActive: { backgroundColor: C.primary + '30', borderColor: C.primary + '80' },
  timerBtnText: { color: C.primary, fontWeight: '800', fontSize: 14 },
  timerUseBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  timerUseBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  timerResetText: { color: C.muted, fontSize: 13, fontWeight: '600' },

  saveBigBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBigBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
