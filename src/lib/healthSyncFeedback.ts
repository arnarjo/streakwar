/**
 * Shared, pure wording for foreground health-sync feedback.
 *
 * A Steps insert/update is NOT a workout: counts shown to the user come only
 * from the exercise outcome. A missing or inconsistent per-type outcome never
 * produces an invented count; it falls back to the generic retry guidance.
 * Only typed results are interpreted; other errors stay generic so backend or
 * native error text is never shown.
 */

import type { HealthPollResult } from './healthConnect';

export interface SyncFeedback {
  title: string;
  message: string;
}

/** Native health timestamps (Android) mean a poll where every type completed. */
export const LAST_FULL_SYNC_LABEL = 'Last full sync';

export const STALE_SYNC_ROW = {
  title: 'No recent full sync',
  subtitle: 'Tap for recovery options →',
};

export const STALE_SYNC_ALERT: SyncFeedback = {
  title: 'Full sync is out of date',
  message: 'No full sync has been recorded in over 30 minutes. Some data may still have imported. '
    + 'Check permissions, connectivity and system background restrictions, or try Sync now. '
    + 'Android does not guarantee a sync interval.',
};

const GENERIC_ERROR: SyncFeedback = {
  title: 'Sync incomplete',
  message: 'Some activities may have imported. Please check your connection and permissions, then retry.',
};

/**
 * Thrown by a foreground sync whose Android poll did not fully complete. The
 * message keeps the "Sync did not complete" prefix; `result` carries the
 * per-type outcome and is only attached after the account was re-verified.
 */
export class HealthSyncIncompleteError extends Error {
  readonly result: HealthPollResult;
  readonly isHealthSyncIncomplete = true;

  constructor(result: HealthPollResult) {
    super('Sync did not complete. Some activities may have imported. Please retry.');
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'HealthSyncIncompleteError';
    this.result = result;
  }
}

export function isHealthSyncIncompleteError(error: unknown): error is HealthSyncIncompleteError {
  return typeof error === 'object' && error !== null
    && (error as { isHealthSyncIncomplete?: unknown }).isHealthSyncIncomplete === true
    && (error as { result?: unknown }).result !== null
    && typeof (error as { result?: unknown }).result === 'object';
}

const workouts = (n: number) => `${n} new workout${n === 1 ? '' : 's'}`;

/** A fully completed sync; `count` is the number of new workouts. */
export function formatSyncSuccess(count: number): SyncFeedback {
  if (!Number.isInteger(count) || count < 0) return GENERIC_ERROR;
  return {
    title: 'Sync complete',
    message: count > 0
      ? `${workouts(count)} imported.`
      : 'Health data checked. No new workouts imported.',
  };
}

/** Null when the per-type outcome is missing or inconsistent (callers fall back to generic wording). */
function formatPartial(result: HealthPollResult): SyncFeedback | null {
  const { exercise, steps } = result;
  if (!exercise || !steps) return null;
  const written = exercise.written;
  if (!Number.isInteger(written) || written < 0) return null;

  if (exercise.status === 'ok') {
    if (exercise.cursorAdvanced !== true) return null;
    const stepsMissing = result.missingPermissions?.includes('Steps') === true;
    let stepsNote: string;
    if (steps.status === 'skipped' && stepsMissing) {
      stepsNote = 'Steps were not synced because Health Connect step access is not enabled. Enable it in Health Connect settings.';
    } else if (steps.status === 'failed') {
      stepsNote = 'Steps could not be synced. Please retry.';
    } else if (steps.status === 'skipped') {
      stepsNote = 'Steps were not synced. Please retry.';
    } else {
      return null;   // both ok would have been a completed sync
    }
    return {
      title: 'Workouts synced, steps incomplete',
      message: `Workout sync completed: ${workouts(written)} imported. ${stepsNote}`,
    };
  }

  if (exercise.status === 'failed') {
    return {
      title: 'Sync incomplete',
      message: written > 0
        ? `${written} workout${written === 1 ? ' was' : 's were'} saved before a problem occurred. Please retry to import the rest.`
        : 'No workouts were saved. Please check your connection and permissions, then retry.',
    };
  }

  // Exercise skipped: nothing was checked, so never claim an empty scan.
  return {
    title: 'Sync not completed',
    message: result.missingPermissions?.includes('ExerciseSession')
      ? 'Health Connect workout access is not enabled. Enable it in Health Connect settings, then retry.'
      : 'Health data was not checked (Health Connect is unavailable or another sync is running). Please try again.',
  };
}

/** Alert wording for any error thrown by a foreground sync. */
export function formatSyncError(error: unknown): SyncFeedback {
  return (isHealthSyncIncompleteError(error) && formatPartial(error.result)) || GENERIC_ERROR;
}

/**
 * Message for a connection that was saved but whose first import did not fully
 * complete. Never claims the recent workouts synced.
 */
export function formatConnectedSyncNote(error: unknown): string {
  const partial = isHealthSyncIncompleteError(error) ? formatPartial(error.result) : null;
  return partial
    ? `Connected. ${partial.message}`
    : 'Connected, but the first sync did not complete. Please try Sync now.';
}
