/**
 * Background sync task
 *
 * Registers an expo-background-fetch task that runs every ~15 minutes
 * (the minimum Android allows for background work).
 *
 * On Android  → polls Health Connect for new activities
 * On iOS      → HealthKit background delivery handles this natively via
 *               observeWorkouts() registered in healthKit.ts; we still
 *               run a secondary fetch task as a safety net for steps.
 *
 * Register this task before the NavigationContainer mounts (in App.tsx).
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { pollHealthConnect } from './healthConnect';
import { syncRecentWorkouts, syncTodaySteps } from './healthKit';

export const BACKGROUND_SYNC_TASK = 'streakwar-health-sync';
const USER_ID_KEY = 'streakwar_user_id';

/** Call this when the user logs in to persist their ID for background tasks */
export async function persistUserId(userId: string) {
  await AsyncStorage.setItem(USER_ID_KEY, userId);
}

/** Call this when the user logs out */
export async function clearUserId() {
  await AsyncStorage.removeItem(USER_ID_KEY);
}

// Define the task before any component mounts
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const userId = await AsyncStorage.getItem(USER_ID_KEY);
    if (!userId) return BackgroundFetch.BackgroundFetchResult.NoData;

    // JWT may have expired in background — refresh before making authenticated DB calls
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data } = await supabase.auth.refreshSession();
      session = data.session;
    }
    if (!session) return BackgroundFetch.BackgroundFetchResult.Failed;

    let synced = 0;

    if (Platform.OS === 'android') {
      synced += await pollHealthConnect(userId);
    } else if (Platform.OS === 'ios') {
      // Steps and recent workouts are independent — run in parallel
      const [, workoutsSynced] = await Promise.all([
        syncTodaySteps(userId),
        syncRecentWorkouts(userId),
      ]);
      synced += workoutsSynced;
    }

    // Always update last_synced_at to reflect that sync ran (even if 0 new workouts)
    await supabase
      .from('device_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('provider', Platform.OS === 'ios' ? ['apple_health'] : ['health_connect']);

    return synced > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    console.warn('[BackgroundSync] task error:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/** Register the background fetch task – call once at app startup */
export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,   // keep running after app is closed (Android)
        startOnBoot: true,        // restart on device reboot (Android)
      });
    }
  } catch (err) {
    console.warn('[BackgroundSync] register failed:', err);
  }
}

/** Unregister – call on logout */
export async function unregisterBackgroundSync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    }
  } catch (err) {
    console.warn('[BackgroundSync] unregister failed:', err);
  }
}
