/**
 * Single serialized authority for LOCAL health-sync lifecycle mutations:
 * persisted account identity, background task (un)registration and the
 * HealthKit startup/teardown call sites.
 *
 * Model:
 *  - `requestHealthSyncOwner` records the desired owner and bumps an epoch
 *    synchronously, so every queued/in-flight operation for an older owner is
 *    invalidated the moment the account changes (no await needed).
 *  - All mutations run on ONE promise queue. An in-flight operation is never
 *    interrupted: it settles (checking `isCurrent` after awaits and before new
 *    side effects), then reconcile cleans up whatever it touched and starts
 *    the LATEST desired owner. A late cleanup therefore cannot erase a newer
 *    owner's identity/task, and a late start cannot persist after logout.
 *  - Failures are caught and recorded; the queue is never poisoned and no
 *    function here rejects except user-initiated operations (to their caller).
 *
 * Limits: this orders local mutations only. It does not cancel database
 * requests already dispatched and does not make cross-account isolation atomic.
 */

import { Platform } from 'react-native';
import {
  persistUserId,
  clearUserId,
  registerBackgroundSync,
  restoreAndroidBackgroundSync,
  unregisterBackgroundSync,
} from './backgroundSync';
import { initHealthKit, teardownHealthKit } from './healthKit';

const STALE_MESSAGE = 'Health sync account changed or signed out. Please retry.';

/** undefined = nothing requested yet in this process. */
let desired: string | null | undefined;
/** Bumped synchronously on every desired-owner change. */
let epoch = 0;
/** Owner whose local state may exist; undefined = unknown (fresh process). */
let localOwner: string | null | undefined;
let cleanupFailed = false;
/** The last start did not confirm setup (returned false, threw, or was interrupted): retry on the next same-owner request. */
let setupIncomplete = false;
/** Never rejects. */
let tail: Promise<void> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const result = tail.then(job);
  tail = result.then(() => undefined, () => undefined);
  return result;
}

function isClean(): boolean {
  return desired !== undefined
    && localOwner === desired
    && !setupIncomplete
    && !(desired === null && cleanupFailed);
}

/** Attempts every step even if one fails; true only if all succeeded. */
async function cleanup(unregister: boolean): Promise<boolean> {
  let ok = true;
  try {
    teardownHealthKit();
  } catch (error) {
    ok = false;
    console.warn('[HealthSync] HealthKit teardown failed:', error);
  }
  try {
    await clearUserId();
  } catch (error) {
    ok = false;
    console.warn('[HealthSync] clearing persisted identity failed:', error);
  }
  if (unregister) {
    try {
      if (await unregisterBackgroundSync() === false) ok = false;
    } catch (error) {
      ok = false;
      console.warn('[HealthSync] background unregister failed:', error);
    }
  }
  return ok;
}

/** True only if setup was positively confirmed; false is never reported as success. */
async function startOwner(userId: string, isCurrent: () => boolean): Promise<boolean> {
  if (Platform.OS === 'android') {
    // Requires an active in-app connection; never prompts for permissions.
    return (await restoreAndroidBackgroundSync(userId, isCurrent)) === true;
  }
  if (!isCurrent()) return false;
  await persistUserId(userId);
  if (!isCurrent()) return false;
  const registered = (await registerBackgroundSync(isCurrent)) === true;
  if (!isCurrent()) return false;
  // iOS: set up HealthKit observers (callback-based, no Activity required).
  if (Platform.OS === 'ios') await initHealthKit(userId);
  return registered;
}

async function reconcile(): Promise<void> {
  for (;;) {
    const target = desired;
    if (target === undefined) return;
    const ticket = epoch;
    const stale = () => epoch !== ticket;

    if (localOwner !== target || (target === null && cleanupFailed)) {
      // Clean only what a previous owner may have left: a fresh process
      // starting a signed-in owner, or an already-clean slate, needs nothing
      // (avoids task churn and a redundant second cleanup after a collapsed
      // A -> null -> B change). A failed cleanup is retried on the next null.
      const needsCleanup = typeof localOwner === 'string'
        || (target === null && (localOwner === undefined || cleanupFailed));
      if (needsCleanup) {
        const full = target === null || typeof localOwner === 'string';
        cleanupFailed = !await cleanup(full);
      }
      localOwner = null;
      setupIncomplete = false;
      if (stale()) continue;
    } else if (target === null || !setupIncomplete) {
      return;
    }
    if (target === null) return;

    localOwner = target;
    setupIncomplete = false;
    try {
      setupIncomplete = !await startOwner(target, () => !stale());
    } catch (error) {
      setupIncomplete = true;
      console.warn('[HealthSync] startup failed:', error);
    }
    if (!stale()) return;
    // Interrupted by a newer request: if that request is the same owner again
    // (A -> B -> A) the loop resumes the aborted start instead of dropping it.
    setupIncomplete = true;
  }
}

/**
 * Declare the signed-in account (or null after sign-out). Safe to call from a
 * synchronous auth callback: invalidation is synchronous, work is deferred,
 * and the returned promise never rejects. Repeating the same owner is a no-op.
 */
export function requestHealthSyncOwner(userId: string | null): Promise<void> {
  if (desired !== userId) {
    desired = userId;
    epoch++;
  } else if (isClean()) {
    return whenHealthSyncSettled();
  }
  return enqueue(reconcile).catch(() => undefined);
}

/** Resolves once every queued mutation (including newer ones) has settled. */
export async function whenHealthSyncSettled(): Promise<void> {
  for (;;) {
    const seen = tail;
    await seen;
    if (seen === tail) return;
  }
}

/**
 * Run a user-initiated local mutation for `userId` on the same queue. Rejects
 * with an "account changed" error if the owner changed at any point after the
 * request was made (including back to the same user) or by the time it finishes; `isCurrent` lets the operation re-check.
 */
export function runHealthSyncOperation<T>(
  userId: string,
  operation: (isCurrent: () => boolean) => Promise<T>,
): Promise<T> {
  // Captured at ENQUEUE time: any owner change since (even A -> B -> A) makes
  // this request stale, so an old disconnect cannot hit a newly requested A.
  const ticket = epoch;
  const isCurrent = () => epoch === ticket && desired === userId;
  return enqueue(async () => {
    if (!isCurrent()) throw new Error(STALE_MESSAGE);
    const result = await operation(isCurrent);
    if (!isCurrent()) throw new Error(STALE_MESSAGE);
    return result;
  });
}

/** Persist identity (optional) and request the background task for `userId`. */
export function registerHealthSyncBackground(userId: string, options: { persist: boolean }): Promise<boolean> {
  return runHealthSyncOperation(userId, async isCurrent => {
    if (options.persist) {
      await persistUserId(userId);
      if (!isCurrent()) throw new Error(STALE_MESSAGE);
    }
    return registerBackgroundSync(isCurrent);
  });
}

/** Clear persisted identity and unregister the task; both attempted, a failure of either is reported. */
export function disconnectHealthSyncBackground(userId: string): Promise<void> {
  return runHealthSyncOperation(userId, async () => {
    let failed = false;
    let failure: unknown;
    try {
      await clearUserId();
    } catch (error) {
      failed = true;
      failure = error;
    }
    try {
      if (await unregisterBackgroundSync() === false) {
        if (!failed) failure = new Error('Could not unregister background sync. Please retry.');
        failed = true;
      }
    } catch (error) {
      if (!failed) failure = error;
      failed = true;
    }
    if (failed) {
      cleanupFailed = true;   // the next logout cleanup retries whatever is left
      throw failure;
    }
  });
}

/** Tests only: forget all coordinator state. */
export function __resetHealthSyncLifecycleForTests(): void {
  desired = undefined;
  epoch++;
  localOwner = undefined;
  cleanupFailed = false;
  setupIncomplete = false;
  tail = Promise.resolve();
}
