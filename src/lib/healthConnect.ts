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

import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
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

// Distance and ActiveCaloriesBurned are not yet used — only ExerciseSession and Steps.
const HC_RECORD_TYPES = [
  'ExerciseSession',
  'Steps',
] as const;

/**
 * Map Health Connect exercise type numeric codes to our activity types.
 * HC returns integer constants (ExerciseSessionRecord.EXERCISE_TYPE_*), not strings.
 * Reference: https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord
 */
function mapHCExerciseType(typeCode: number): ActivityType {
  // Key numeric constants from ExerciseSessionRecord
  const map: Record<number, ActivityType> = {
    56: 'run',   // EXERCISE_TYPE_RUNNING
    57: 'run',   // EXERCISE_TYPE_RUNNING_TREADMILL
    79: 'walk',  // EXERCISE_TYPE_WALKING
    37: 'walk',  // EXERCISE_TYPE_HIKING
    8:  'cycle', // EXERCISE_TYPE_BIKING
    9:  'cycle', // EXERCISE_TYPE_BIKING_STATIONARY
    74: 'swim',  // EXERCISE_TYPE_SWIMMING_OPEN_WATER
    75: 'swim',  // EXERCISE_TYPE_SWIMMING_POOL
    62: 'lift',  // EXERCISE_TYPE_STRENGTH_TRAINING
    44: 'lift',  // EXERCISE_TYPE_WEIGHTLIFTING
    83: 'yoga',  // EXERCISE_TYPE_YOGA
    27: 'hiit',  // EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
    38: 'hiit',  // EXERCISE_TYPE_INTERVAL_TRAINING
  };
  return map[typeCode] ?? 'other';
}

/** Returns the device's local date as YYYY-MM-DD, avoiding UTC offset drift. */
function toLocalDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Requests Health Connect permissions and returns true if ExerciseSession was granted.
 * Requires MainActivity.kt to call HealthConnectPermissionDelegate.setPermissionDelegate(this)
 * in onCreate() (handled by plugins/withHealthConnectMainActivity.js).
 */
export async function initHealthConnect(): Promise<boolean> {
  if (Platform.OS !== 'android' || !HealthConnect) {
    console.log('[HealthConnect] init failed: platform or package mismatch');
    return false;
  }
  try {
    const { initialize, requestPermission } = HealthConnect;
    console.log('[HealthConnect] Initializing...');
    const available = await initialize();
    console.log('[HealthConnect] Available:', available);
    if (!available) return false;

    const requested = HC_RECORD_TYPES.map(type => ({ accessType: 'read', recordType: type }));
    console.log('[HealthConnect] Requesting permissions:', requested);
    const granted: any[] = await requestPermission(requested);
    console.log('[HealthConnect] Permissions granted result:', granted);

    return granted.some((g: any) => g.recordType === 'ExerciseSession');
  } catch (e) {
    console.warn('[HealthConnect] requestPermission failed:', e);
    return false;
  }
}

/**
 * Opens Health Connect settings so the user can grant permissions manually.
 * Uses openHealthConnectSettings() which works on all Android versions and
 * all install methods (sideloaded + Play Store). The deep link approach
 * (android-health-connect://manage-health-permissions/) only works on Android 14+
 * AND only when the app is already registered in HC's connected-apps registry —
 * which requires a prior successful Play Store install. We avoid it entirely.
 */
export async function openHealthConnectPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    if (!HealthConnect) return false;
    const { initialize, openHealthConnectSettings } = HealthConnect;
    const available = await initialize();
    if (!available) return false;
    openHealthConnectSettings();
    return true;
  } catch {
    return false;
  }
}

/** Returns true if ExerciseSession read permission has been granted in Health Connect. */
export async function checkHealthConnectGranted(): Promise<boolean> {
  if (Platform.OS !== 'android' || !HealthConnect) return false;
  try {
    const { initialize, getGrantedPermissions } = HealthConnect;
    console.log('[HealthConnect] Checking permissions, initializing...');
    const available = await initialize();
    if (!available) {
      console.log('[HealthConnect] Not available during check');
      return false;
    }
    // Give the HC client 600ms to fully stabilize after returning from HC settings.
    // On many OEM builds (Samsung, Xiaomi) the client reconnects asynchronously
    // after an app switch and getGrantedPermissions() returns [] if called immediately.
    await new Promise(r => setTimeout(r, 600));
    const granted: any[] = await getGrantedPermissions();
    console.log('[HealthConnect] Currently granted:', granted);
    return granted.some((g: any) => g.recordType === 'ExerciseSession');
  } catch (e) {
    console.warn('[HealthConnect] checkHealthConnectGranted failed:', e);
    return false;
  }
}

/** Poll Health Connect for activities since the last sync and write new ones to Supabase */
export async function pollHealthConnect(userId: string): Promise<number> {
  if (Platform.OS !== 'android' || !HealthConnect) return 0;

  // Check permissions before advancing the sync cursor — if permissions were
  // revoked we must not advance LAST_SYNC_KEY or we'll lose historical data.
  const hasPermission = await checkHealthConnectGranted();
  if (!hasPermission) {
    console.log('[HealthConnect] poll skipped — permissions not granted');
    return 0;
  }

  const { initialize, readRecords } = HealthConnect;
  const available = await initialize().catch(() => false);
  if (!available) return 0;

  const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  const startTime = lastSyncRaw ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
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
          // Guard against missing timestamps — HC can omit endTime on in-progress sessions
          const startMs = session.startTime ? new Date(session.startTime).getTime() : NaN;
          const endMs   = session.endTime   ? new Date(session.endTime).getTime()   : NaN;
          const durationMs  = endMs - startMs;
          const durationMin = Number.isFinite(durationMs) ? Math.round(durationMs / 60000) : null;
          return {
            user_id: userId,
            challenge_id: challengeId,
            activity_type: mapHCExerciseType(session.exerciseType ?? 0),
            duration_minutes: durationMin !== null && durationMin > 0 ? durationMin : null,
            source: 'health_connect',
            external_activity_id: String(session.metadata.id),
            // Use local date to avoid UTC midnight off-by-one on users outside UTC
            workout_date: session.startTime ? toLocalDate(session.startTime) : toLocalDate(new Date()),
          };
        });

      if (toInsert.length > 0) {
        await supabase.from('workout_posts').insert(toInsert);
        synced = toInsert.length;
      }
    }

    // Sync today's steps using local date so the day boundary matches the user's clock
    const now = new Date();
    const localDate = toLocalDate(now);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const { records: stepRecords } = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: endOfDay.toISOString(),
      },
    });

    const totalSteps = (stepRecords ?? []).reduce((sum: number, r: any) => sum + (r.count ?? 0), 0);

    if (totalSteps > 0) {
      // Atomic insert — if the row already exists, update steps in place.
      // This eliminates the SELECT-then-INSERT race condition from concurrent syncs.
      const { error: insertErr } = await supabase.from('workout_posts').insert({
        user_id: userId,
        challenge_id: challengeId,
        activity_type: 'walk',
        steps: totalSteps,
        source: 'health_connect',
        external_activity_id: `steps_${localDate}`,
        workout_date: localDate,
      });

      if (insertErr) {
        if (insertErr.code === '23505') {
          // Unique constraint hit — row was already created today, just update step count
          await supabase
            .from('workout_posts')
            .update({ steps: totalSteps })
            .eq('user_id', userId)
            .eq('source', 'health_connect')
            .eq('external_activity_id', `steps_${localDate}`);
        } else {
          console.warn('[HealthConnect] steps insert failed:', insertErr);
        }
      } else {
        synced++;
      }
    }
  } catch (e) {
    console.warn('[HealthConnect] poll failed:', e);
  }

  await AsyncStorage.setItem(LAST_SYNC_KEY, endTime);
  return synced;
}
