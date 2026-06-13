/**
 * Pure mappers shared by the iOS HealthKit and Android Health Connect sync
 * code. Kept free of any `supabase`/native imports so the logic is unit
 * testable in jest (the sync modules themselves pull in native deps).
 */

import type { ActivityType } from '../types/database';

/**
 * Map a Health Connect ExerciseSessionRecord exercise-type code to our
 * ActivityType. HC returns integer constants (EXERCISE_TYPE_*), not strings.
 * https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord
 */
export function mapHCExerciseType(typeCode: number): ActivityType {
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

/**
 * Map an Apple HKWorkoutActivityType raw value (returned by react-native-health
 * getSamples as `activityId`) to our ActivityType.
 */
export function mapAppleWorkoutType(typeId: number): ActivityType {
  switch (typeId) {
    case 37: return 'run';   // HKWorkoutActivityTypeRunning
    case 52: return 'walk';  // HKWorkoutActivityTypeWalking
    case 24: return 'walk';  // HKWorkoutActivityTypeHiking
    case 13: return 'cycle'; // HKWorkoutActivityTypeCycling
    case 46: return 'swim';  // HKWorkoutActivityTypeSwimming
    case 50: return 'lift';  // HKWorkoutActivityTypeTraditionalStrengthTraining
    case 20: return 'lift';  // HKWorkoutActivityTypeFunctionalStrengthTraining
    case 57: return 'yoga';  // HKWorkoutActivityTypeYoga
    case 63: return 'hiit';  // HKWorkoutActivityTypeHighIntensityIntervalTraining
    default:  return 'other';
  }
}

/** HealthKit reports workout distance in miles; we store kilometres. */
export const MILES_TO_KM = 1.60934;

export function milesToKm(miles: number): number {
  return miles * MILES_TO_KM;
}
