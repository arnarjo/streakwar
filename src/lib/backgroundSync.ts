/**
 * Background sync task
 *
 * Requests an expo-background-fetch task with a 15-minute interval hint.
 * The OS decides when it actually runs; registration is not delivery evidence.
 *
 * On Android  → polls Health Connect for new activities
 * On iOS      → this task IS the background sync. react-native-health has no
 *               workout observer / background delivery API, so workouts and
 *               steps are only synced when iOS grants this fetch task time
 *               (or when the user foregrounds the app).
 *
 * Register this task before the NavigationContainer mounts (in App.tsx).
 * Identity persistence and (un)registration are driven only through
 * healthSyncLifecycle.ts, which serializes them across account changes.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { assertHealthSyncUser } from './healthSyncIdentity';
import { pollHealthConnect } from './healthConnect';
import { getHealthConnectBackgroundState } from './healthConnectBackground';
import { hasActiveHealthConnectConnection } from './healthConnectionConsent';
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
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return BackgroundFetch.BackgroundFetchResult.Failed;
    let session = sessionData.session;
    if (!session) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) return BackgroundFetch.BackgroundFetchResult.Failed;
      session = data.session;
    }
    // Persisted IDs can outlive logout or an account switch. Never poll for a
    // different account using the current authenticated session.
    if (!session || session.user.id !== userId) return BackgroundFetch.BackgroundFetchResult.Failed;

    let synced = 0;
    let syncRan = false;

    if (Platform.OS === 'android') {
      if (!await hasActiveHealthConnectConnection(userId)) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
      // Recheck on every invocation: permission/support may change after registration.
      if (await getHealthConnectBackgroundState() !== 'granted') {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }
      const result = await pollHealthConnect(userId);
      synced += result.synced;
      // If the poll was skipped (permissions revoked, HC unavailable) we must
      // NOT bump last_synced_at — the staleness warning relies on it going stale.
      syncRan = result.completed;
      if (result.ranWithPermissions && !result.completed) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    } else if (Platform.OS === 'ios') {
      // Steps and recent workouts are independent — run in parallel.
      // Both initialize HealthKit themselves in this headless launch.
      const [, workoutsSynced] = await Promise.all([
        syncTodaySteps(userId),
        syncRecentWorkouts(userId),
      ]);
      synced += workoutsSynced;
      syncRan = true;
    }

    // Update last_synced_at only when a sync completed successfully
    // (even if it found 0 new workouts).
    if (syncRan) {
      await assertHealthSyncUser(userId);
      const { data, error } = await supabase
        .from('device_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('provider', Platform.OS === 'ios' ? 'apple_health' : 'health_connect')
        .eq('is_active', true)
        .select('provider');
      if (error || data?.length !== 1) return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    return synced > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    console.warn('[BackgroundSync] task error:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Ensure registration at startup and after native health reconnection.
 * `isCurrent` lets the lifecycle coordinator veto a stale owner's registration:
 * it is rechecked after every await and immediately before the side effect.
 */
export async function registerBackgroundSync(isCurrent: () => boolean = () => true): Promise<boolean> {
  try {
    if (!isCurrent()) return false;
    if (Platform.OS === 'android') {
      const { data, error } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (error || !userId || !await hasActiveHealthConnectConnection(userId)) return false;
    }
    if (!isCurrent()) return false;
    if (Platform.OS === 'android' && await getHealthConnectBackgroundState() !== 'granted') {
      return false;
    }
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return false;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isCurrent()) return false;
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,   // keep running after app is closed (Android)
        startOnBoot: true,        // restart on device reboot (Android)
      });
    }
    return true;
  } catch (err) {
    console.warn('[BackgroundSync] register failed:', err);
    return false;
  }
}

/** Android restart must not silently reconnect an in-app disconnected source. */
export async function restoreAndroidBackgroundSync(
  userId: string,
  isCurrent: () => boolean = () => true,
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    if (!await hasActiveHealthConnectConnection(userId)) return false;
    await assertHealthSyncUser(userId);
    if (!isCurrent()) return false;
    await persistUserId(userId);
    return await registerBackgroundSync(isCurrent);
  } catch (error) {
    console.warn('[BackgroundSync] restore failed:', error);
    return false;
  }
}

/** Unregister – call on logout. Never throws; resolves false if the task may still be registered. */
export async function unregisterBackgroundSync(): Promise<boolean> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    }
    return true;
  } catch (err) {
    console.warn('[BackgroundSync] unregister failed:', err);
    return false;
  }
}
