/**
 * Google Health Connect integration (Android only)
 *
 * How it works:
 *  1. User grants Health Connect read permissions on first launch.
 *  2. A WorkManager background task (via expo-background-fetch) runs
 *     every 15 minutes and polls Health Connect for new activities
 *     since the last sync timestamp.
 *  3. New activities are posted to Supabase and points are awarded
 *     without the user needing to open the app.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getActiveChallengeId } from './db';
import type { ActivityType } from '../types/database';

let HealthConnect: any = null;

if (Platform.OS === 'android') {
  try {
    HealthConnect = require('react-native-health-connect');
  } catch {
    // Package not linked
  }
}

const LAST_SYNC_KEY = 'health_connect_last_sync';

const HC_RECORD_TYPES = [
  'ExerciseSession',
  'Steps',
  'Distance',
  'ActiveCaloriesBurned',
] as const;

/** Map Health Connect exercise type strings to our activity types */
function mapHCExerciseType(type: string): ActivityType {
  const map: Record<string, ActivityType> = {
    RUNNING: 'hlaup',
    RUNNING_TREADMILL: 'hlaup',
    WALKING: 'ganga',
    HIKING: 'ganga',
    BIKING: 'hjólreiðar',
    BIKING_STATIONARY: 'hjólreiðar',
    SWIMMING_OPEN_WATER: 'sund',
    SWIMMING_POOL: 'sund',
    STRENGTH_TRAINING: 'lyftingar',
    WEIGHTLIFTING: 'lyftingar',
    YOGA: 'jóga',
    HIGH_INTENSITY_INTERVAL_TRAINING: 'hiit',
    INTERVAL_TRAINING: 'hiit',
  };
  return map[type] ?? 'annað';
}

export async function initHealthConnect(): Promise<boolean> {
  if (Platform.OS !== 'android' || !HealthConnect) return false;

  try {
    const { isAvailable } = HealthConnect;
    const available = await isAvailable();
    if (!available) return false;

    const { requestPermission } = HealthConnect;
    const grants = await requestPermission(
      HC_RECORD_TYPES.map(type => ({ accessType: 'read', recordType: type }))
    );
    return grants.every((g: any) => g.granted);
  } catch (e) {
    console.warn('[HealthConnect] init failed:', e);
    return false;
  }
}

/** Poll Health Connect for activities since the last sync and write new ones to Supabase */
export async function pollHealthConnect(userId: string): Promise<number> {
  if (Platform.OS !== 'android' || !HealthConnect) return 0;

  const { readRecords } = HealthConnect;
  const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  const startTime = lastSyncRaw ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  let synced = 0;

  try {
    // Fetch once — reused by both the sessions batch and the steps insert
    const challengeId = await getActiveChallengeId(userId);

    const { records: sessions } = await readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime, endTime },
    });

    const sessionList = sessions ?? [];

    if (sessionList.length > 0) {
      // Single batch existence check instead of one SELECT per session
      const externalIds = sessionList
        .map((s: any) => String(s.metadata?.id))
        .filter(Boolean);

      const { data: existing } = await supabase
        .from('workout_posts')
        .select('external_activity_id')
        .eq('user_id', userId)
        .eq('source', 'health_connect')
        .in('external_activity_id', externalIds);

      const existingSet = new Set(existing?.map((r: any) => r.external_activity_id) ?? []);

      const toInsert = sessionList
        .filter((s: any) => s.metadata?.id && !existingSet.has(String(s.metadata.id)))
        .map((session: any) => {
          const durationMs = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
          const durationMin = Math.round(durationMs / 60000);
          return {
            user_id: userId,
            challenge_id: challengeId,
            activity_type: mapHCExerciseType(session.exerciseType ?? ''),
            duration_minutes: durationMin > 0 ? durationMin : null,
            source: 'health_connect',
            external_activity_id: String(session.metadata.id),
            workout_date: session.startTime.slice(0, 10),
          };
        });

      if (toInsert.length > 0) {
        await supabase.from('workout_posts').insert(toInsert);
        synced = toInsert.length;
      }
    }

    // Sync today's steps
    const today = new Date().toISOString().slice(0, 10);
    const { records: stepRecords } = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: `${today}T00:00:00Z`,
        endTime: `${today}T23:59:59Z`,
      },
    });

    const totalSteps = (stepRecords ?? []).reduce((sum: number, r: any) => sum + (r.count ?? 0), 0);

    if (totalSteps > 0) {
      const { data: existingSteps } = await supabase
        .from('workout_posts')
        .select('id')
        .eq('user_id', userId)
        .eq('source', 'health_connect')
        .eq('external_activity_id', `steps_${today}`)
        .maybeSingle();

      if (existingSteps) {
        await supabase.from('workout_posts').update({ steps: totalSteps }).eq('id', existingSteps.id);
      } else {
        await supabase.from('workout_posts').insert({
          user_id: userId,
          challenge_id: challengeId,
          activity_type: 'ganga',
          steps: totalSteps,
          source: 'health_connect',
          external_activity_id: `steps_${today}`,
          workout_date: today,
        });
        synced++;
      }
    }
  } catch (e) {
    console.warn('[HealthConnect] poll failed:', e);
  }

  await AsyncStorage.setItem(LAST_SYNC_KEY, endTime);
  return synced;
}
