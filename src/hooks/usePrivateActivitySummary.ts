import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Owner-only summary of privately imported Health Connect activity.
 *
 * Source: RPC `get_my_private_activity_summary()` (SECURITY INVOKER, RLS). It
 * takes no arguments and returns exactly one row for `auth.uid()`. This hook
 * never writes anything and never merges the numbers into public profile,
 * feed, leaderboard or streak data.
 *
 * Safety model:
 *  - State is stored together with the owner it was loaded for. Whenever the
 *    `userId` prop differs from that owner (account switch, logout) the stale
 *    summary is hidden in the SAME render, before any effect runs.
 *  - Every request carries a sequence number; changing user/refreshToken,
 *    refreshing again or unmounting invalidates all older requests, so late or
 *    out-of-order responses are ignored.
 *  - A response is accepted only if its `owner_id` equals the requested user and
 *    all three counters are non-negative safe integers (a Postgres bigint may
 *    arrive as a number or a decimal string). Anything else is an error, never
 *    a zero-valued success.
 *  - Nothing from the response (or the error) is logged.
 */

export interface PrivateActivitySummary {
  /** Imported records, including daily Steps snapshots (not workouts). */
  activityCount: number;
  personalPoints: number;
  totalSteps: number;
}

export type PrivateActivityStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PrivateActivitySummaryState {
  status: PrivateActivityStatus;
  /** Only ever the current owner's data; null while loading, on error and when signed out. */
  summary: PrivateActivitySummary | null;
  /** A reload for the same owner is running while the previous summary is still shown. */
  refreshing: boolean;
  refresh: () => void;
}

interface Stored {
  owner: string;
  /** The refreshToken the stored result was requested for. */
  token: PrivateActivityToken;
  status: 'ready' | 'error';
  summary: PrivateActivitySummary | null;
  /** A manual refresh/retry is in flight (set by the handler, cleared by the newest response). */
  busy: boolean;
}

type PrivateActivityToken = string | number | boolean | undefined;

const DECIMAL_INTEGER = /^(0|[1-9]\d*)$/;

function parseCounter(value: unknown): number | null {
  let n: number;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && DECIMAL_INTEGER.test(value)) n = Number(value);
  else return null;
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** Null for anything other than exactly one well-formed row owned by `userId`. */
export function parsePrivateActivitySummary(data: unknown, userId: string): PrivateActivitySummary | null {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const row = data[0] as Record<string, unknown> | null;
  if (typeof row !== 'object' || row === null) return null;
  if (typeof row.owner_id !== 'string' || row.owner_id !== userId) return null;
  const activityCount = parseCounter(row.activity_count);
  const personalPoints = parseCounter(row.personal_points);
  const totalSteps = parseCounter(row.total_steps);
  if (activityCount === null || personalPoints === null || totalSteps === null) return null;
  return { activityCount, personalPoints, totalSteps };
}

export function usePrivateActivitySummary(
  userId: string,
  refreshToken?: string | number | boolean,
): PrivateActivitySummaryState {
  const [stored, setStored] = useState<Stored | null>(null);
  const sequence = useRef(0);
  // Scope identity distinguishes A -> B -> A and same-owner token changes.
  // An old callback must not revive an obsolete request/token after either.
  const scope = useMemo(() => ({ userId, refreshToken }), [userId, refreshToken]);
  const activeScope = useRef<typeof scope | null>(null);

  const invalidate = useCallback(() => {
    sequence.current++;
    activeScope.current = null;
  }, []);

  const load = useCallback(async (owner: string, token: PrivateActivityToken) => {
    const mine = ++sequence.current;
    let next: Stored;
    try {
      const { data, error } = await supabase.rpc('get_my_private_activity_summary');
      const summary = error ? null : parsePrivateActivitySummary(data, owner);
      next = summary
        ? { owner, token, status: 'ready', summary, busy: false }
        : { owner, token, status: 'error', summary: null, busy: false };
    } catch {
      next = { owner, token, status: 'error', summary: null, busy: false };
    }
    // Superseded (newer request, user/token change, unmount): ignore entirely.
    if (mine !== sequence.current) return;
    setStored(next);
  }, []);

  useEffect(() => {
    if (!userId) {
      activeScope.current = null;
      return undefined;
    }
    activeScope.current = scope;
    void load(userId, refreshToken);
    return invalidate;
  }, [userId, refreshToken, scope, load, invalidate]);

  const refresh = useCallback(() => {
    // A stale handle (old account, unmounted) cannot start a request.
    if (!userId || activeScope.current !== scope) return;
    setStored(prev => (prev && prev.owner === userId ? { ...prev, busy: true } : prev));
    void load(userId, refreshToken);
  }, [userId, refreshToken, scope, load]);

  if (!userId) return { status: 'idle', summary: null, refreshing: false, refresh };
  // Nothing stored for THIS owner: never show another owner's summary.
  if (!stored || stored.owner !== userId) return { status: 'loading', summary: null, refreshing: false, refresh };
  // A newer token or a manual refresh is in flight: keep only a good same-owner summary visible.
  if (stored.busy || stored.token !== refreshToken) {
    return stored.status === 'ready' && stored.summary
      ? { status: 'ready', summary: stored.summary, refreshing: true, refresh }
      : { status: 'loading', summary: null, refreshing: false, refresh };
  }
  return { status: stored.status, summary: stored.summary, refreshing: false, refresh };
}
