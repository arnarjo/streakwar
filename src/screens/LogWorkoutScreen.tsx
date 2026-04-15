import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Image, ActivityIndicator, Platform,
  KeyboardAvoidingView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../hooks/useAuth';
import { useWorkoutFeed } from '../hooks/useWorkoutFeed';
import { useFitnessChallenges } from '../hooks/useFitnessChallenges';
import { ACTIVITY_LABELS, ACTIVITY_OPTIONS } from '../types/database';
import type { ActivityType } from '../types/database';
import { cancelTodayStreakReminder } from '../lib/streakNotification';
import { format } from 'date-fns';

const C = {
  bg: '#0C1117',
  card: '#151C24',
  border: 'rgba(255,255,255,0.07)',
  borderFocus: '#F97316',
  text: '#EEF4F8',
  muted: '#4A6070',
  dimmed: '#1E2A35',
  primary: '#F97316',
  error: '#EF4444',
};

export default function LogWorkoutScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const preselectedChallengeId = route.params?.challengeId as string | undefined;

  const { logWorkout, pickMedia } = useWorkoutFeed(profile?.id ?? '');
  const { myChallenges } = useFitnessChallenges(profile?.id ?? '');

  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [steps, setSteps] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(preselectedChallengeId ?? null);
  const [workoutDate, setWorkoutDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeChallenges = myChallenges.filter(c => c.status === 'active');

  async function handlePickMedia() {
    const uri = await pickMedia();
    if (uri) setMediaUri(uri);
  }

  async function handleSave() {
    if (!profile?.id) return;

    const durationVal = duration ? parseFloat(duration) : null;
    const distanceVal = distance ? parseFloat(distance) : null;
    const caloriesVal = calories ? parseInt(calories, 10) : null;
    const stepsVal = steps ? parseInt(steps, 10) : null;

    setSaving(true);
    const { error } = await logWorkout({
      activity_type: activityType,
      duration_minutes: durationVal,
      distance_km: distanceVal,
      calories: caloriesVal,
      steps: stepsVal,
      caption,
      challenge_id: selectedChallengeId,
      workout_date: format(workoutDate, 'yyyy-MM-dd'),
      source: 'manual',
      imageUri: mediaUri ?? undefined,
    });
    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      cancelTodayStreakReminder();
      navigation.goBack();
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
          <Text style={s.title}>Log Workout</Text>
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
          <Text style={s.sectionLabel}>ACTIVITY TYPE</Text>
          <View style={s.activityGrid}>
            {ACTIVITY_OPTIONS.map(type => {
              const label = ACTIVITY_LABELS[type];
              const emoji = label.split(' ')[0];
              const name = label.split(' ').slice(1).join(' ');
              const active = activityType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[s.activityBtn, active && s.activityBtnActive]}
                  onPress={() => setActivityType(type)}
                  activeOpacity={0.7}
                >
                  <Text style={s.activityEmoji}>{emoji}</Text>
                  <Text style={[s.activityName, active && { color: C.primary }]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Stats */}
          <Text style={s.sectionLabel}>STATS (optional)</Text>
          <View style={s.statsGrid}>
            <View style={s.statInput}>
              <Text style={s.statLabel}>Duration (min)</Text>
              <TextInput
                style={s.statField}
                placeholder="45"
                placeholderTextColor={C.dimmed}
                value={duration}
                onChangeText={setDuration}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={s.statInput}>
              <Text style={s.statLabel}>Distance (km)</Text>
              <TextInput
                style={s.statField}
                placeholder="5.0"
                placeholderTextColor={C.dimmed}
                value={distance}
                onChangeText={setDistance}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={s.statInput}>
              <Text style={s.statLabel}>Calories</Text>
              <TextInput
                style={s.statField}
                placeholder="300"
                placeholderTextColor={C.dimmed}
                value={calories}
                onChangeText={setCalories}
                keyboardType="number-pad"
              />
            </View>
            <View style={s.statInput}>
              <Text style={s.statLabel}>Steps</Text>
              <TextInput
                style={s.statField}
                placeholder="8000"
                placeholderTextColor={C.dimmed}
                value={steps}
                onChangeText={setSteps}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Date */}
          <Text style={s.sectionLabel}>DATE</Text>
          <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(!showDatePicker)}>
            <Text style={s.dateBtnText}>📅 {format(workoutDate, 'EEEE, MMMM d, yyyy')}</Text>
          </TouchableOpacity>
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
          <Text style={s.sectionLabel}>PHOTO (optional)</Text>
          <TouchableOpacity style={s.mediaPicker} onPress={handlePickMedia} activeOpacity={0.8}>
            {mediaUri ? (
              <Image source={{ uri: mediaUri }} style={s.mediaPreview} resizeMode="cover" />
            ) : (
              <View style={s.mediaPlaceholder}>
                <Text style={s.mediaIcon}>📷</Text>
                <Text style={s.mediaText}>Add a photo</Text>
              </View>
            )}
          </TouchableOpacity>
          {mediaUri && (
            <TouchableOpacity style={s.removeMedia} onPress={() => setMediaUri(null)}>
              <Text style={s.removeMediaText}>Remove photo</Text>
            </TouchableOpacity>
          )}

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

  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  activityBtnActive: {
    borderColor: C.primary + '60',
    backgroundColor: C.primary + '15',
  },
  activityEmoji: { fontSize: 16 },
  activityName: { fontSize: 13, fontWeight: '600', color: C.muted },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statInput: { width: '47%' },
  statLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 5 },
  statField: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
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

  mediaPicker: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 140,
  },
  mediaPreview: { width: '100%', height: 200 },
  mediaPlaceholder: {
    height: 140,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaIcon: { fontSize: 32 },
  mediaText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  removeMedia: { alignItems: 'center', marginTop: 6 },
  removeMediaText: { color: C.error, fontSize: 13, fontWeight: '600' },

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

  saveBigBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBigBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
