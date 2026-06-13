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
import { toLocalDate } from './dateUtils';
import { mapHCExerciseType } from './healthMapping';

let HealthConnect: any = null;

if (Platform.OS === 'android') {
  try {
    HealthConnect = require('react-native-health-connect');
  } catch {
    // Package not linked
  }
}

const LAST_SYNC_KEY = 'health_connect_last_sync';

// Stores the last diagnostic message from initHealthConnect() for surface-level debugging.
let _lastHCDebug = '';
export function getLastHCDebug(): string { return _lastHCDebug; }

// Distance and ActiveCaloriesBurned are not yet used — only ExerciseSession and Steps.
const HC_RECORD_TYPES = [
  'ExerciseSession',
  'Steps',
] as const;




/**
 * Requests Health Connect permissions and returns true if ExerciseSession was granted.
 * Requires MainActivity.kt to call HealthConnectPermissionDelegate.setPermissionDelegate(this)
 * in onCreate() (handled by plugins/withHealthConnectMainActivity.js).
 */
export async function initHealthConnect(): Promise<boolean> {
  if (Platform.OS !== 'android' || !HealthConnect) {
    _lastHCDebug = `FAIL: platform=${Platform.OS} packageLoaded=${!!HealthConnect}`;
    return false;
  }
  try {
    const { initialize, requestPermission, getGrantedPermissions } = HealthConnect;
    const available = await initialize();
    if (!available) {
      _lastHCDebug = 'FAIL: initialize() returned false — HC not available on device';
      return false;
    }

    // Check already-granted permissions first — requestPermission() returns []
    // when called again on already-granted permissions on some HC versions.
    const alreadyGranted: any[] = await getGrantedPermissions();
    if (alreadyGranted.some((g: any) => g.recordType === 'ExerciseSession')) {
      _lastHCDebug = `OK: already granted=${JSON.stringify(alreadyGranted)}`;
      return true;
    }

    const requested = HC_RECORD_TYPES.map(type => ({ accessType: 'read', recordType: type }));
    const granted: any[] = await requestPermission(requested);
    _lastHCDebug = `OK: granted=${JSON.stringify(granted)} alreadyGranted=${JSON.stringify(alreadyGranted)}`;

    return granted.some((g: any) => g.recordType === 'ExerciseSession');
  } catch (e: any) {
    _lastHCDebug = `CATCH: ${e?.message ?? String(e)}`;
    console.warn('[HealthConnect] requestPermission failed:', e);
    return false;
  }
}

/**
 * Opens the Health Connect permissions page for StreakWar.
 * On Android 14+ with a Play Store install the deep link takes the user directly
 * to StreakWar's permission toggles. Falls back to general HC settings on older
 * Android versions or if the deep link is unavailable.
 */
export async function openHealthConnectPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    if (!HealthConnect) return false;
    const { initialize, openHealthConnectSettings } = HealthConnect;
    const available = await initialize();
    if (!available) return false;

    // Try the direct per-app permissions deep link (Android 14+, Play Store builds).
    // Skip canOpenURL — it returns false on some OEM builds even when the scheme is declared.
    const deepLink = 'android-health-connect://manage-health-permissions/is.streakwar.app';
    try {
      await Linking.openURL(deepLink);
      return true;
    } catch { /* deep link not supported, fall through to settings */ }

    openHealthConnectSettings();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true if ExerciseSession read permission has been granted in Health Connect.
 * Pass stabilize=true after returning from HC settings — on OEM builds (Samsung, Xiaomi)
 * the client reconnects asynchronously after an app switch and needs a moment to settle.
 */
export async function checkHealthConnectGranted(stabilize = false): Promise<boolean> {
  if (Platform.OS !== 'android' || !HealthConnect) return false;
  try {
    const { initialize, getGrantedPermissions } = HealthConnect;
    console.log('[HealthConnect] Checking permissions, initializing...');
    const available = await initialize();
    if (!available) {
      console.log('[HealthConnect] Not available during check');
      return false;
    }
    if (stabilize) {
      await new Promise(r => setTimeout(r, 600));
    }
    const granted: any[] = await getGrantedPermissions();
    console.log('[HealthConnect] Currently granted:', granted);
    return granted.some((g: any) => g.recordType === 'ExerciseSession');
  } catch (e) {
    console.warn('[HealthConnect] checkHealthConnectGranted failed:', e);
    return false;
  }
}

let _pollInFlight = false;

export interface HealthPollResult {
  /** Number of new rows written to Supabase */
  synced: number;
  /**
   * True only when the poll actually ran with granted permissions.
   * False when skipped (permissions revoked, HC unavailable, poll already
   * in flight, wrong platform) — callers must NOT bump last_synced_at then,
   * otherwise the staleness warning can never fire after a revocation.
   */
  ranWithPermissions: boolean;
}

const SKIPPED: HealthPollResult = { synced: 0, ranWithPermissions: false };

// Re-read this far behind the stored cursor. The cursor is wall-clock time at
// poll end, but readRecords filters by record time — a watch workout that
// syncs into HC 30 minutes after it ended would otherwise fall behind the
// cursor forever. Dedupe by external_activity_id makes re-reads safe.
const CURSOR_OVERLAP_MS = 48 * 60 * 60 * 1000;

/** Poll Health Connect for activities since the last sync and write new ones to Supabase */
export async function pollHealthConnect(userId: string): Promise<HealthPollResult> {
  if (Platform.OS !== 'android' || !HealthConnect) return SKIPPED;
  if (_pollInFlight) return SKIPPED;
  _pollInFlight = true;

  const { initialize, readRecords } = HealthConnect;
  const available = await initialize().catch(() => false);
  if (!available) { _pollInFlight = false; return SKIPPED; }

  // Check permissions before advancing the sync cursor — if permissions were
  // revoked we must not advance LAST_SYNC_KEY or we'll lose historical data.
  // No stabilize delay needed here; we're in a background poll, not a settings return.
  const { getGrantedPermissions } = HealthConnect;
  const granted: any[] = await getGrantedPermissions().catch(() => []);
  if (!granted.some((g: any) => g.recordType === 'ExerciseSession')) {
    console.log('[HealthConnect] poll skipped — permissions not granted');
    _pollInFlight = false;
    return SKIPPED;
  }

  const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  // Subtract the overlap from the stored cursor so late-arriving records
  // (watch syncs, manual entries) are still picked up. First run: 7 days.
  const startTime = lastSyncRaw
    ? new Date(new Date(lastSyncRaw).getTime() - CURSOR_OVERLAP_MS).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  let synced = 0;

  try {
    let insertFailed = false;
    // Fetch once — reused by both the sessions batch and the steps insert
    const challengeId = await getActiveChallengeId(userId);

    const rawSessions = await readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime, endTime },
    });

    const sessionList = Array.isArray(rawSessions) ? rawSessions : (rawSessions?.records ?? []);

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
        // Skip in-progress sessions (no endTime yet): inserting them now would
        // store a null duration, and dedupe would then block the completed
        // version. The 48h cursor lookback re-reads them once complete.
        .filter((s: any) => s.metadata?.id && s.endTime && !existingSet.has(String(s.metadata.id)))
        .map((session: any) => {
          const startMs = session.startTime ? new Date(session.startTime).getTime() : NaN;
          const endMs   = new Date(session.endTime).getTime();
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
        const { error: batchErr } = await supabase.from('workout_posts').insert(toInsert);
        if (batchErr) {
          console.error('[HealthConnect] batch insert failed:', batchErr.message, batchErr.code);
          insertFailed = true;
        } else {
          synced = toInsert.length;
        }
      }
    }

    // Sync today's steps using local date so the day boundary matches the user's clock.
    // Wrapped in its own try/catch: the LAST_SYNC_KEY cursor only governs the
    // ExerciseSession window (steps are always re-read for the whole day), so a
    // steps failure (e.g. Steps permission denied) must not block the cursor advance.
    try {
      const now = new Date();
      const localDate = toLocalDate(now);
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const dayRange = {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: endOfDay.toISOString(),
      };

      // Prefer the aggregate API: aggregateRecord({ recordType: 'Steps', ... })
      // returns { COUNT_TOTAL } deduplicated by source priority, so phone and
      // watch recording the same steps are not counted twice. Fall back to
      // summing raw records (may double-count) if aggregation throws.
      let totalSteps = 0;
      try {
        const { aggregateRecord } = HealthConnect;
        const agg = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: dayRange });
        totalSteps = Math.round(agg?.COUNT_TOTAL ?? 0);
      } catch (aggErr) {
        console.warn('[HealthConnect] steps aggregate failed, falling back to raw sum:', aggErr);
        const rawSteps = await readRecords('Steps', { timeRangeFilter: dayRange });
        const stepRecords = Array.isArray(rawSteps) ? rawSteps : (rawSteps?.records ?? []);
        totalSteps = stepRecords.reduce((sum: number, r: any) => sum + (r.count ?? 0), 0);
      }

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
            // Unique constraint hit — row was already created today. Update the step
            // count, and the challenge_id if one is active, so a challenge joined
            // mid-day still gets credit (never clobber an existing link with null).
            // The unique index is (user_id, external_activity_id) WITHOUT source,
            // so do not filter by source — the conflicting row may have been
            // created by Apple Health before a platform switch.
            await supabase
              .from('workout_posts')
              .update({ steps: totalSteps, ...(challengeId ? { challenge_id: challengeId } : {}) })
              .eq('user_id', userId)
              .eq('external_activity_id', `steps_${localDate}`);
          } else {
            console.warn('[HealthConnect] steps insert failed:', insertErr);
          }
        } else {
          synced++;
        }
      }
    } catch (e) {
      console.warn('[HealthConnect] steps sync failed:', e);
    }
    if (!insertFailed) {
      await AsyncStorage.setItem(LAST_SYNC_KEY, endTime);
    }
  } catch (e) {
    console.warn('[HealthConnect] poll failed:', e);
    // Do not advance LAST_SYNC_KEY on failure — retry from same window next poll.
  } finally {
    _pollInFlight = false;
  }

  return { synced, ranWithPermissions: true };
}
