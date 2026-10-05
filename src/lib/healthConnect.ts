/**
 * Google Health Connect integration (Android only)
 *
 * How it works:
 *  1. User grants Health Connect read permissions on first launch.
 *  2. With supported/granted background access, expo-background-fetch requests
 *     periodic polling. Android decides when/if it runs; the interval is a hint.
 *  3. Foreground/manual polling remains available without background access.
 */

import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseSessionRecord } from 'react-native-health-connect';
import { supabase } from './supabase';
import { getActiveChallengeId } from './db';
import { toLocalDate } from './dateUtils';
import { mapHCExerciseType } from './healthMapping';
import { assertHealthSyncUser } from './healthSyncIdentity';
import { chunk, completedSessionsById, planLookupBatches } from './healthConnectBatching';

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
    if (alreadyGranted.some((g: any) => g.recordType === 'ExerciseSession' && g.accessType === 'read')) {
      _lastHCDebug = `OK: already granted=${JSON.stringify(alreadyGranted)}`;
      return true;
    }

    const requested = HC_RECORD_TYPES.map(type => ({ accessType: 'read', recordType: type }));
    const granted: any[] = await requestPermission(requested);
    _lastHCDebug = `OK: granted=${JSON.stringify(granted)} alreadyGranted=${JSON.stringify(alreadyGranted)}`;

    return granted.some((g: any) => g.recordType === 'ExerciseSession' && g.accessType === 'read');
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
    return granted.some((g: any) => g.recordType === 'ExerciseSession' && g.accessType === 'read');
  } catch (e) {
    console.warn('[HealthConnect] checkHealthConnectGranted failed:', e);
    return false;
  }
}

let _pollInFlight = false;

/** Per-type outcome. `skipped` = not attempted (missing permission, unavailable, in flight, earlier phase threw). */
export type HealthPollTypeStatus = 'ok' | 'skipped' | 'failed';

export interface HealthPollExerciseOutcome {
  /** ok requires every eligible row resolved AND the cursor save to have succeeded. */
  status: HealthPollTypeStatus;
  /** Confirmed newly inserted rows only; kept when a later step fails. */
  written: number;
  cursorAdvanced: boolean;
}

export interface HealthPollStepsOutcome {
  status: HealthPollTypeStatus;
  /** 1 only for a confirmed new Steps row; a conflict update is not a write. */
  written: number;
  /** True after a conflict update returned success (affected rows are not verified). */
  updated: boolean;
}

export interface HealthPollResult {
  /** Explicit missing record permissions; absence is not proof of background capability. */
  missingPermissions?: ('ExerciseSession' | 'Steps')[];
  /** Number of new rows written to Supabase */
  synced: number;
  /** All attempted reads/writes and the exercise cursor save succeeded. */
  completed: boolean;
  /**
   * True only when the poll actually ran with granted permissions.
   * False when skipped (permissions revoked, HC unavailable, poll already
   * in flight, wrong platform). Permission alone is NOT successful sync;
   * callers must use completed before bumping last_synced_at.
   */
  ranWithPermissions: boolean;
  /** Always populated by pollHealthConnect; optional so existing callers/mocks stay compatible. */
  exercise?: HealthPollExerciseOutcome;
  steps?: HealthPollStepsOutcome;
}

/** Fresh object per call so one caller can never mutate another's result. */
function skippedResult(): HealthPollResult {
  return {
    synced: 0, ranWithPermissions: false, completed: false,
    exercise: { status: 'skipped', written: 0, cursorAdvanced: false },
    steps: { status: 'skipped', written: 0, updated: false },
  };
}

// Re-read this far behind the stored cursor. The cursor is wall-clock time at
// poll end, but readRecords filters by record time — a watch workout that
// syncs into HC 30 minutes after it ended would otherwise fall behind the
// cursor forever. Dedupe by external_activity_id makes re-reads safe.
const CURSOR_OVERLAP_MS = 48 * 60 * 60 * 1000;

/** Poll Health Connect for activities since the last sync and write new ones to Supabase */
export async function pollHealthConnect(userId: string): Promise<HealthPollResult> {
  if (!userId || Platform.OS !== 'android' || !HealthConnect) return skippedResult();
  if (_pollInFlight) return skippedResult();
  _pollInFlight = true;

  // Cover native initialization and cursor reads too: both can throw before
  // the import's own error handling starts. Never leave future polls locked out.
  try {
    return await pollHealthConnectUnlocked(userId);
  } finally {
    _pollInFlight = false;
  }
}

async function pollHealthConnectUnlocked(userId: string): Promise<HealthPollResult> {
  await assertHealthSyncUser(userId);
  const { initialize, readRecords } = HealthConnect;
  const available = await initialize().catch(() => false);
  if (!available) return skippedResult();

  // Check permissions before advancing the sync cursor — if permissions were
  // revoked we must not advance LAST_SYNC_KEY or we'll lose historical data.
  // No stabilize delay needed here; we're in a background poll, not a settings return.
  const { getGrantedPermissions } = HealthConnect;
  const granted: any[] = await getGrantedPermissions().catch(() => []);
  if (!granted.some((g: any) => g.recordType === 'ExerciseSession' && g.accessType === 'read')) {
    console.log('[HealthConnect] poll skipped — permissions not granted');
    return { ...skippedResult(), missingPermissions: ['ExerciseSession'] };
  }
  const canReadSteps = granted.some((g: any) => g.recordType === 'Steps' && g.accessType === 'read');

  // Never adopt the legacy unscoped cursor: its owner cannot be established.
  // Each account starts with its own bounded lookback and existing deduplication.
  const cursorKey = `${LAST_SYNC_KEY}:${userId}`;
  const lastSyncRaw = await AsyncStorage.getItem(cursorKey);
  // Subtract the overlap from the stored cursor so late-arriving records
  // (watch syncs, manual entries) are still picked up. First run: 7 days.
  const startTime = lastSyncRaw
    ? new Date(new Date(lastSyncRaw).getTime() - CURSOR_OVERLAP_MS).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date().toISOString();

  let synced = 0;
  let completed = false;
  // Per-type outcome bookkeeping (additive; does not influence control flow).
  let exercisePhaseOk = false;
  let cursorAdvanced = false;
  let stepsStatus: HealthPollTypeStatus = 'skipped';
  let stepsWritten = 0;
  let stepsUpdated = false;

  try {
    let insertFailed = false;
    let stepsFailed = false;
    // Fetch once — reused by both the sessions batch and the steps insert
    const challengeId = await getActiveChallengeId(userId);

    // Read the complete fixed window before importing or advancing its cursor.
    // Fail closed on a broken/unbounded continuation instead of losing records.
    const sessionList: ExerciseSessionRecord[] = [];
    const seenTokens = new Set<string>();
    let pageToken: string | undefined;
    let pages = 0;
    do {
      if (pages++ >= 100) throw new Error('Health Connect exercise page limit reached');
      const page = await readRecords('ExerciseSession', {
        timeRangeFilter: { operator: 'between', startTime, endTime },
        pageSize: 200,
        ...(pageToken ? { pageToken } : {}),
      });
      const records = Array.isArray(page) ? page : page?.records;
      if (!Array.isArray(records)) throw new Error('Invalid Health Connect exercise page');
      sessionList.push(...records);
      const nextToken = Array.isArray(page) ? undefined : page.pageToken;
      if (nextToken != null && typeof nextToken !== 'string') {
        throw new Error('Invalid Health Connect continuation token');
      }
      pageToken = nextToken || undefined;
      if (pageToken) {
        if (seenTokens.has(pageToken)) throw new Error('Repeated Health Connect continuation token');
        seenTokens.add(pageToken);
      }
    } while (pageToken);

    const candidates = completedSessionsById<any>(sessionList);
    if (candidates.size > 0) {
      // Bounded existence checks. Every batch keeps the user/source filters and
      // results are aggregated before deciding what is missing. An oversized ID
      // throws (fail closed) so the cursor can never skip an unchecked record.
      const existingSet = new Set<string>();
      for (const ids of planLookupBatches([...candidates.keys()])) {
        await assertHealthSyncUser(userId);
        const { data: existing, error: lookupError } = await supabase
          .from('workout_posts')
          .select('external_activity_id')
          .eq('user_id', userId)
          .eq('source', 'health_connect')
          .in('external_activity_id', ids);
        if (lookupError) throw lookupError;
        for (const r of existing ?? []) existingSet.add((r as any).external_activity_id);
      }

      // Unfinished sessions were dropped above: inserting them now would store
      // a null duration, and dedupe would then block the completed version.
      // The 48h cursor lookback re-reads them once complete.
      const toInsert = [...candidates.entries()]
        .filter(([id]) => !existingSet.has(id))
        .map(([id, session]: [string, any]) => {
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
            external_activity_id: id,
            // Use local date to avoid UTC midnight off-by-one on users outside UTC
            workout_date: session.startTime ? toLocalDate(session.startTime) : toLocalDate(new Date()),
          };
        });

      // Sequential, bounded inserts. Earlier batches stay committed if a later
      // one fails (no all-or-nothing claim); a failure stops further writes and
      // blocks the cursor so the next poll retries safely via dedupe.
      for (const batch of chunk(toInsert)) {
        await assertHealthSyncUser(userId);
        const { error: batchErr } = await supabase.from('workout_posts').insert(batch);
        if (batchErr?.code === '23505') {
          // A concurrent importer can race the existence query. Retry this
          // batch's rows individually without overwriting saved rows.
          for (const row of batch) {
            await assertHealthSyncUser(userId);
            const { error } = await supabase.from('workout_posts').insert(row);
            if (!error) {
              synced++;
            } else if (error.code === '23505') {
              // Do not swallow unrelated unique violations. Verify this user's
              // exact external ID exists; migration 002's index spans sources.
              const { data: duplicate, error: verifyError } = await supabase
                .from('workout_posts')
                .select('external_activity_id')
                .eq('user_id', userId)
                .eq('external_activity_id', row.external_activity_id)
                .maybeSingle();
              if (verifyError || !duplicate) insertFailed = true;
            } else {
              insertFailed = true;
            }
            // Stop exercise writes at the first failure: no later row or batch.
            if (insertFailed) break;
          }
        } else if (batchErr) {
          console.error('[HealthConnect] batch insert failed:', batchErr.message, batchErr.code);
          insertFailed = true;
        } else {
          synced += batch.length;
        }
        if (insertFailed) break;
      }
    }
    exercisePhaseOk = !insertFailed;

    // Sync today's steps using local date so the day boundary matches the user's clock.
    // Wrapped in its own try/catch: the LAST_SYNC_KEY cursor only governs the
    // ExerciseSession window (steps are always re-read for the whole day), so a
    // steps failure (e.g. Steps permission denied) must not block the cursor advance.
    try {
      if (!canReadSteps) throw new Error('Health Connect Steps read permission is missing');
      const now = new Date();
      const localDate = toLocalDate(now);
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const dayRange = {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: endOfDay.toISOString(),
      };

      // Only Health Connect's aggregate applies source-priority deduplication.
      // Never substitute a raw sum after failure: phone/watch records overlap.
      const { aggregateRecord } = HealthConnect;
      const agg = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: dayRange });
      if (!agg || typeof agg !== 'object') throw new Error('Invalid Health Connect steps response');
      const count = agg.COUNT_TOTAL ?? 0;
      if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
        throw new Error('Invalid Health Connect step total');
      }
      const totalSteps = Math.round(count);

      if (totalSteps > 0) {
        await assertHealthSyncUser(userId);
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
            await assertHealthSyncUser(userId);
            const { error: updateError } = await supabase
              .from('workout_posts')
              .update({ steps: totalSteps, ...(challengeId ? { challenge_id: challengeId } : {}) })
              .eq('user_id', userId)
              .eq('external_activity_id', `steps_${localDate}`);
            if (updateError) throw updateError;
            stepsUpdated = true;
          } else {
            stepsFailed = true;
            stepsStatus = 'failed';
            console.warn('[HealthConnect] steps insert failed:', insertErr);
          }
        } else {
          synced++;
          stepsWritten = 1;
        }
      }
      if (!stepsFailed) stepsStatus = 'ok';
    } catch (e) {
      stepsFailed = true;
      // Without the read grant the first statement threw before any attempt.
      stepsStatus = canReadSteps ? 'failed' : 'skipped';
      console.warn('[HealthConnect] steps sync failed:', e);
    }
    if (!insertFailed) {
      await assertHealthSyncUser(userId);
      await AsyncStorage.setItem(cursorKey, endTime);
      cursorAdvanced = true;
    }
    completed = !insertFailed && !stepsFailed;
  } catch (e) {
    console.warn('[HealthConnect] poll failed:', e);
    // Do not advance LAST_SYNC_KEY on failure — retry from same window next poll.
  }

  return { synced, ranWithPermissions: true, completed,
    ...(!canReadSteps ? { missingPermissions: ['Steps' as const] } : {}),
    exercise: {
      status: exercisePhaseOk && cursorAdvanced ? 'ok' : 'failed',
      written: synced - stepsWritten,   // synced = exercise inserts + Steps insert
      cursorAdvanced,
    },
    steps: { status: stepsStatus, written: stepsWritten, updated: stepsUpdated },
  };
}
