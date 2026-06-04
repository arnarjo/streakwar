/**
 * Apple HealthKit integration (iOS only)
 *
 * How it works:
 *  1. At app open, initHealthKit() requests permissions and registers
 *     background delivery observers on HKWorkoutType and step counts.
 *  2. iOS wakes the app in the background whenever a new workout sample
 *     is written to HealthKit (e.g. after Apple Watch syncs).
 *  3. The observer callback fires → we read the new workout → post to
 *     Supabase → points are awarded without the user ever opening the app.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getActiveChallengeId } from './db';
import { toLocalDate } from './dateUtils';
import type { ActivityType } from '../types/database';

let AppleHealthKit: any = null;

if (Platform.OS === 'ios') {
  try {
    const RNHealth = require('react-native-health');
    AppleHealthKit = RNHealth.default;
  } catch {
    // Package not linked (e.g. Expo Go) — background sync will be skipped
  }
}

const HEALTHKIT_PERMISSIONS = {
  permissions: {
    read: [
      'Steps',
      'StepCount',
      'DistanceWalkingRunning',
      'DistanceCycling',
      'ActiveEnergyBurned',
      'Workout',
    ],
    write: [] as string[],
  },
};

/** Map Apple workout type codes to our activity types */
function mapAppleWorkoutType(typeId: number): ActivityType {
  // HKWorkoutActivityType constants
  switch (typeId) {
    case 37: return 'run';   // Running
    case 52: return 'walk';  // Walking
    case 13: return 'cycle'; // Cycling
    case 46: return 'swim';  // Swimming
    case 20: return 'lift';  // TraditionalStrengthTraining
    case 21: return 'lift';  // FunctionalStrengthTraining
    case 57: return 'yoga';  // Yoga
    case 39: return 'hiit';  // HighIntensityIntervalTraining
    default:  return 'other';
  }
}


// Track which userId was initialized so re-auth with a different account
// doesn't keep delivering workouts to the previous user.
let _initializedUserId: string | null = null;
let _initInProgress = false;

export async function initHealthKit(userId: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !AppleHealthKit) return false;
  if (_initializedUserId === userId) return true;
  if (_initInProgress) return false;
  _initInProgress = true;

  return new Promise(resolve => {
    AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (err: any) => {
      _initInProgress = false;
      if (err) {
        console.warn('[HealthKit] init failed:', err);
        resolve(false);
        return;
      }
      _initializedUserId = userId;

      // iOS wakes the app in background when new workouts arrive
      AppleHealthKit.observeWorkouts({}, async (_err: any, results: any[]) => {
        if (_err || !results?.length) return;
        if (_initializedUserId !== userId) return;
        await syncNewWorkouts(userId, results);
      });

      resolve(true);
    });
  });
}

/** Call on sign-out so the next sign-in re-initializes with the correct user. */
export function teardownHealthKit() {
  _initializedUserId = null;
  _initInProgress = false;
}

/** Fetch workouts recorded in the last 7 days and sync any that are new */
export async function syncRecentWorkouts(userId: string): Promise<number> {
  if (Platform.OS !== 'ios' || !AppleHealthKit || _initializedUserId !== userId) return 0;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return new Promise(resolve => {
    AppleHealthKit.getSamples(
      {
        startDate: sevenDaysAgo.toISOString(),
        endDate: new Date().toISOString(),
        type: 'Workout',
        includeManuallyAdded: true,
      },
      async (err: any, results: any[]) => {
        if (err || !results?.length) { resolve(0); return; }
        const count = await syncNewWorkouts(userId, results);
        resolve(count);
      }
    );
  });
}

async function syncNewWorkouts(userId: string, workouts: any[]): Promise<number> {
  const externalIds = workouts
    .map(w => String(w.id ?? w.sourceId ?? w.startDate))
    .filter(Boolean);

  if (!externalIds.length) return 0;

  // Single batch query instead of one SELECT per workout
  const { data: existing } = await supabase
    .from('workout_posts')
    .select('external_activity_id')
    .eq('user_id', userId)
    .eq('source', 'apple_health')
    .in('external_activity_id', externalIds);

  const existingSet = new Set(existing?.map((r: any) => r.external_activity_id) ?? []);

  // Fetch once — same user, same active challenge for the whole batch
  const challengeId = await getActiveChallengeId(userId);

  const toInsert = workouts
    .map(workout => {
      const externalId = String(workout.id ?? workout.sourceId ?? workout.startDate);
      if (!externalId || existingSet.has(externalId)) return null;
      return {
        user_id: userId,
        challenge_id: challengeId,
        activity_type: mapAppleWorkoutType(workout.workoutActivityType ?? 0),
        duration_minutes: workout.duration ? Math.round(workout.duration / 60) : null,
        distance_km: workout.distance ? parseFloat((workout.distance / 1000).toFixed(2)) : null,
        calories: workout.totalEnergyBurned ? Math.round(workout.totalEnergyBurned) : null,
        source: 'apple_health',
        external_activity_id: externalId,
        // Use local date to avoid UTC midnight off-by-one on users outside UTC
        workout_date: workout.startDate
          ? toLocalDate(workout.startDate)
          : toLocalDate(new Date()),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (toInsert.length > 0) {
    const { error: batchErr } = await supabase.from('workout_posts').insert(toInsert);
    if (batchErr) {
      console.error('[HealthKit] batch insert failed:', batchErr.message, batchErr.code);
      return 0;
    }
  }

  return toInsert.length;
}

/** Sync step counts for the current day */
export async function syncTodaySteps(userId: string): Promise<void> {
  if (Platform.OS !== 'ios' || !AppleHealthKit || _initializedUserId !== userId) return;

  // Guard against stale sync running for a logged-out user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return;

  // Resolve challengeId once — not inside the callback to avoid N+1 per sync
  const challengeId = await getActiveChallengeId(userId);
  const localDate = toLocalDate(new Date());

  return new Promise(resolve => {
    AppleHealthKit.getStepCount(
      { date: new Date().toISOString() },
      async (err: any, result: { value: number }) => {
        if (err || !result?.value) { resolve(); return; }

        const { error: upsertErr } = await supabase.from('workout_posts').upsert(
          {
            user_id: userId,
            challenge_id: challengeId,
            activity_type: 'walk',
            steps: result.value,
            source: 'apple_health',
            external_activity_id: `steps_${localDate}`,
            workout_date: localDate,
          },
          { onConflict: 'user_id,external_activity_id' }
        );

        if (upsertErr) {
          console.warn('[HealthKit] steps upsert failed:', upsertErr.message);
        }
        resolve();
      }
    );
  });
}
