/**
 * Apple HealthKit integration (iOS only)
 *
 * How it works:
 *  1. At app open, initHealthKit() requests HealthKit read permissions.
 *  2. react-native-health does NOT provide a workout observer API, so there
 *     is no native background delivery. Instead, the expo-background-fetch
 *     task in backgroundSync.ts runs periodically (iOS decides the cadence)
 *     and calls syncRecentWorkouts()/syncTodaySteps().
 *  3. New workouts found by those polls are posted to Supabase and points
 *     are awarded — but only as often as iOS grants background fetch time.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getActiveChallengeId } from './db';
import { toLocalDate } from './dateUtils';
import { mapAppleWorkoutType, MILES_TO_KM } from './healthMapping';

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


// Track which userId was initialized so re-auth with a different account
// doesn't keep delivering workouts to the previous user.
let _initializedUserId: string | null = null;
let _initPromise: Promise<boolean> | null = null;

export async function initHealthKit(userId: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !AppleHealthKit) return false;
  if (_initializedUserId === userId) return true;
  // Share the in-flight init so parallel callers (e.g. steps + workouts sync
  // in the background task) don't race or get a spurious false.
  if (_initPromise) return _initPromise;

  _initPromise = new Promise<boolean>(resolve => {
    AppleHealthKit.initHealthKit(HEALTHKIT_PERMISSIONS, (err: any) => {
      _initPromise = null;
      if (err) {
        console.warn('[HealthKit] init failed:', err);
        resolve(false);
        return;
      }
      _initializedUserId = userId;
      // No observer API exists in react-native-health — new workouts are
      // picked up by the expo-background-fetch task (backgroundSync.ts) and
      // by foreground syncs (useHealthSync.syncNow / connectNative).
      resolve(true);
    });
  });
  return _initPromise;
}

/** Call on sign-out so the next sign-in re-initializes with the correct user. */
export function teardownHealthKit() {
  _initializedUserId = null;
  _initPromise = null;
}

/** Fetch workouts recorded in the last 7 days and sync any that are new */
export async function syncRecentWorkouts(userId: string): Promise<number> {
  if (Platform.OS !== 'ios' || !AppleHealthKit) return 0;
  // In a headless background-fetch launch initHealthKit() may never have run
  // for this process — initialize first (no UI prompt when already authorized).
  if (_initializedUserId !== userId) {
    const ok = await initHealthKit(userId);
    if (!ok) return 0;
  }

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
  // getSamples(type: 'Workout') items: { activityId, id, activityName, calories,
  // distance (MILES), start, end (ISO strings) } — no duration field.
  const externalIds = workouts
    .map(w => String(w.id ?? w.start ?? ''))
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
      const externalId = String(workout.id ?? workout.start ?? '');
      if (!externalId || existingSet.has(externalId)) return null;

      // No duration field on getSamples results — derive it from start/end
      const startMs = workout.start ? new Date(workout.start).getTime() : NaN;
      const endMs   = workout.end   ? new Date(workout.end).getTime()   : NaN;
      const durationMin = Number.isFinite(endMs - startMs)
        ? Math.round((endMs - startMs) / 60000)
        : null;

      return {
        user_id: userId,
        challenge_id: challengeId,
        activity_type: mapAppleWorkoutType(workout.activityId ?? 0),
        duration_minutes: durationMin !== null && durationMin > 0 ? durationMin : null,
        // getSamples returns distance in MILES — convert to km
        distance_km: workout.distance
          ? parseFloat((workout.distance * MILES_TO_KM).toFixed(2))
          : null,
        calories: workout.calories ? Math.round(workout.calories) : null,
        source: 'apple_health',
        external_activity_id: externalId,
        // Use local date to avoid UTC midnight off-by-one on users outside UTC
        workout_date: workout.start
          ? toLocalDate(workout.start)
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
  if (Platform.OS !== 'ios' || !AppleHealthKit) return;
  // Headless background-fetch launch — initialize HealthKit first if needed
  if (_initializedUserId !== userId) {
    const ok = await initHealthKit(userId);
    if (!ok) return;
  }

  // Use local date — new Date().toISOString() returns UTC which can be yesterday
  const localDate = toLocalDate(new Date());

  return new Promise(resolve => {
    AppleHealthKit.getStepCount(
      { date: new Date().toISOString() },
      async (err: any, result: { value: number }) => {
        if (err || !result?.value) { resolve(); return; }

        // Atomic insert — if the row already exists, update steps in place.
        // This eliminates the SELECT-then-INSERT race condition from concurrent syncs.
        const { error: insertErr } = await supabase.from('workout_posts').insert({
          user_id: userId,
          challenge_id: await getActiveChallengeId(userId),
          activity_type: 'walk',
          steps: result.value,
          source: 'apple_health',
          external_activity_id: `steps_${localDate}`,
          workout_date: localDate,
        });

        if (insertErr) {
          if (insertErr.code === '23505') {
            // Unique constraint hit — row already exists, just update step count.
            // The unique index is (user_id, external_activity_id) WITHOUT source,
            // so do not filter by source here — the conflicting row may have been
            // created on the other platform (e.g. Health Connect before a switch).
            await supabase
              .from('workout_posts')
              .update({ steps: result.value })
              .eq('user_id', userId)
              .eq('external_activity_id', `steps_${localDate}`);
          } else {
            console.warn('[HealthKit] steps insert failed:', insertErr);
          }
        }

        resolve();
      }
    );
  });
}
