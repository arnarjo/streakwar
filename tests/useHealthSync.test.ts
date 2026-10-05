import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';
import { useHealthSync } from '../src/hooks/useHealthSync';
import { HealthSyncIncompleteError } from '../src/lib/healthSyncFeedback';
import { supabase } from '../src/lib/supabase';
import { pollHealthConnect, initHealthConnect, checkHealthConnectGranted } from '../src/lib/healthConnect';
import {
  persistUserId, clearUserId, registerBackgroundSync, restoreAndroidBackgroundSync, unregisterBackgroundSync,
} from '../src/lib/backgroundSync';
import {
  __resetHealthSyncLifecycleForTests, requestHealthSyncOwner, whenHealthSyncSettled,
} from '../src/lib/healthSyncLifecycle';
import { getHealthConnectBackgroundState, requestHealthConnectBackground } from '../src/lib/healthConnectBackground';

jest.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) } }));
jest.mock('../src/lib/healthConnectBackground', () => ({ getHealthConnectBackgroundState: jest.fn(), requestHealthConnectBackground: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() }, from: jest.fn() } }));
jest.mock('../src/lib/healthConnect', () => ({
  pollHealthConnect: jest.fn(), initHealthConnect: jest.fn(), checkHealthConnectGranted: jest.fn(),
}));
jest.mock('../src/lib/healthKit', () => ({ initHealthKit: jest.fn(), syncRecentWorkouts: jest.fn(), teardownHealthKit: jest.fn() }));
// The real lifecycle coordinator runs on top of these faked background primitives.
jest.mock('../src/lib/backgroundSync', () => ({
  persistUserId: jest.fn(), clearUserId: jest.fn(), unregisterBackgroundSync: jest.fn(), registerBackgroundSync: jest.fn(),
  restoreAndroidBackgroundSync: jest.fn(),
}));

const renderer = jest.requireActual<{ create(element: ReactElement): { unmount(): void; update(element: ReactElement): void } }>('react-test-renderer');
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
let current: ReturnType<typeof useHealthSync>;
let root: ReturnType<typeof renderer.create>;
const update = jest.fn();
const upsert = jest.fn();
const writeStatus = jest.fn();

// Additive per-type outcome contract (HC-PARTIAL02A) for completed polls.
const outcomes = (exerciseWritten = 0, stepsWritten = 0) => ({
  exercise: { status: 'ok' as const, written: exerciseWritten, cursorAdvanced: true },
  steps: { status: 'ok' as const, written: stepsWritten, updated: false },
});

// Fake local identity/task state and one-shot gates for deferred native calls.
const local = { id: null as string | null, registered: false };
const gates = new Map<string, { wait: Promise<void>; reached(): void }>();
function gate(name: string) {
  let release!: () => void;
  let reached!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const reachedPromise = new Promise<void>(resolve => { reached = resolve; });
  gates.set(name, { wait, reached });
  return { reached: reachedPromise, release };
}
async function pass(name: string) {
  const g = gates.get(name);
  if (!g) return;
  gates.delete(name);
  g.reached();
  await g.wait;
}

function Harness({ userId = 'user-a' }: { userId?: string }) {
  const result = useHealthSync(userId);
  useEffect(() => { current = result; });
  return null;
}

beforeAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
beforeEach(async () => {
  jest.resetAllMocks();
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
  jest.mocked(getHealthConnectBackgroundState).mockResolvedValue('permission_required');
  jest.mocked(requestHealthConnectBackground).mockResolvedValue('granted');
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'user-a' } } }, error: null });
  jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 0, ranWithPermissions: true, completed: true, ...outcomes() });
  jest.mocked(initHealthConnect).mockResolvedValue(true);
  jest.mocked(checkHealthConnectGranted).mockResolvedValue(true);
  local.id = null; local.registered = false; gates.clear();
  jest.mocked(persistUserId).mockImplementation(async id => { await pass('persist'); local.id = id; });
  jest.mocked(clearUserId).mockImplementation(async () => { await pass('clear'); local.id = null; });
  jest.mocked(registerBackgroundSync).mockImplementation(async isCurrent => {
    await pass('register');
    if (isCurrent && !isCurrent()) return false;
    local.registered = true;
    return true;
  });
  jest.mocked(unregisterBackgroundSync).mockImplementation(async () => { local.registered = false; return true; });
  jest.mocked(restoreAndroidBackgroundSync).mockImplementation(async (id, isCurrent) => {
    if (isCurrent && !isCurrent()) return false;
    await persistUserId(id);
    return registerBackgroundSync(isCurrent);
  });
  __resetHealthSyncLifecycleForTests();
  await requestHealthSyncOwner('user-a');       // what AuthProvider does on sign-in
  await whenHealthSyncSettled();
  jest.mocked(persistUserId).mockClear();
  jest.mocked(registerBackgroundSync).mockClear();
  jest.mocked(restoreAndroidBackgroundSync).mockClear();
  writeStatus.mockResolvedValue({ data: [{ provider: 'health_connect' }], error: null });
  upsert.mockResolvedValue({ error: null });
  const updateQuery = {
    eq: jest.fn(), select: writeStatus,
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => writeStatus().then(resolve, reject),
  };
  updateQuery.eq.mockReturnValue(updateQuery);
  update.mockReturnValue(updateQuery);
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({
      data: [{ provider: 'health_connect', is_active: true, last_synced_at: null }], error: null,
    }) }),
    update, upsert,
  });
  await act(async () => { root = renderer.create(createElement(Harness)); });
});
afterEach(async () => { await act(async () => root.unmount()); await whenHealthSyncSettled(); });

it('shows existing background permission state without prompting on mount', () => {
  expect(current.backgroundAccess).toBe('permission_required');
  expect(requestHealthConnectBackground).not.toHaveBeenCalled();
});

it('registers only after an explicit background grant', async () => {
  await act(async () => { await current.enableBackgroundSync(); });
  expect(requestHealthConnectBackground).toHaveBeenCalledTimes(1);
  expect(registerBackgroundSync).toHaveBeenCalledTimes(1);
  expect(current.backgroundAccess).toBe('granted');
  expect(current.syncing).toBe(false);
});

it('keeps foreground sync available after background permission denial', async () => {
  jest.mocked(requestHealthConnectBackground).mockResolvedValue('permission_required');
  await act(async () => { await current.enableBackgroundSync(); });
  expect(registerBackgroundSync).not.toHaveBeenCalled();
  await act(async () => { await current.syncNow(); });
  expect(pollHealthConnect).toHaveBeenCalledTimes(1);
});

it('does not register background work after account switch in the permission dialog', async () => {
  jest.mocked(requestHealthConnectBackground).mockImplementationOnce(async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    return 'granted';
  });
  await act(async () => { await expect(current.enableBackgroundSync()).rejects.toThrow('account changed'); });
  expect(registerBackgroundSync).not.toHaveBeenCalled();
});

it('refreshes revoked background access on return to the app without prompting', async () => {
  const onChange = jest.mocked(AppState.addEventListener).mock.calls[0][1];
  jest.mocked(getHealthConnectBackgroundState).mockResolvedValue('granted');
  await act(async () => { onChange('active'); });
  expect(current.backgroundAccess).toBe('granted');
  jest.mocked(getHealthConnectBackgroundState).mockResolvedValue('permission_required');
  await act(async () => { onChange('active'); });
  expect(current.backgroundAccess).toBe('permission_required');
  expect(requestHealthConnectBackground).not.toHaveBeenCalled();
});

it('discards an older background check that finishes after explicit enablement', async () => {
  let finish!: (state: 'permission_required') => void;
  jest.mocked(getHealthConnectBackgroundState).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const onChange = jest.mocked(AppState.addEventListener).mock.calls[0][1];
  await act(async () => { onChange('active'); });
  await act(async () => { await current.enableBackgroundSync(); });
  await act(async () => { finish('permission_required'); });
  expect(current.backgroundAccess).toBe('granted');
});

it('reports scheduling failure separately from a granted read permission', async () => {
  jest.mocked(registerBackgroundSync).mockResolvedValue(false);
  await act(async () => { await current.enableBackgroundSync(); });
  expect(current.backgroundAccess).toBe('granted');
  expect(current.backgroundSyncUnavailable).toBe(true);
});

it.each([null, []])('does not expose a success time when no active connection was updated: %j', async data => {
  writeStatus.mockResolvedValue({ data, error: null });
  await act(async () => { await expect(current.syncNow()).rejects.toThrow('not saved to an active connection'); });
  expect(current.lastSynced).toBeNull();
  expect(current.syncing).toBe(false);
  expect(update.mock.results[0].value.eq).toHaveBeenCalledWith('is_active', true);
});

it('explains a missing Steps permission and clears the notice after recovery', async () => {
  jest.mocked(pollHealthConnect).mockResolvedValueOnce({
    synced: 1, completed: false, ranWithPermissions: true, missingPermissions: ['Steps'],
  });
  await act(async () => { await expect(current.syncNow()).rejects.toThrow('Sync did not complete'); });
  expect(current.permissionNotice).toContain('Steps');
  expect(current.lastSynced).toBeNull();
  await act(async () => { await current.syncNow(); });
  expect(current.permissionNotice).toBeNull();
});

it('clears old account timestamps on account switch', async () => {
  await act(async () => { await current.syncNow(); });
  expect(current.lastSynced).toBeInstanceOf(Date);
  await act(async () => { root.update(createElement(Harness, { userId: 'user-b' })); });
  expect(current.lastSynced).toBeNull();
  expect(current.syncing).toBe(false);
});

describe('local lifecycle races with account switches (real coordinator)', () => {
  const switchTo = async (id: string | null) => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: id ? { user: { id } } : null }, error: null });
    return requestHealthSyncOwner(id);
  };

  it('starts the owner through the shared queue before hook actions run', () => {
    expect(local).toEqual({ id: 'user-a', registered: true });
  });

  it.each(['connectNative', 'confirmHealthConnectConnection'] as const)(
    'a %s reconnect still persisting for A cannot leave A (or unregister B) after A -> B', async method => {
      local.id = null; local.registered = false;
      const persisting = gate('persist');
      let outcome!: Promise<string>;
      await act(async () => {
        outcome = current[method]().then(() => 'ok', (e: Error) => e.message);
        await persisting.reached;
        void switchTo('user-b');
        persisting.release();
        await whenHealthSyncSettled();
      });
      await expect(outcome).resolves.toContain('account changed');
      expect(registerBackgroundSync).toHaveBeenCalledTimes(1);   // only B's startup; A's registration was vetoed
      const order = [...jest.mocked(persistUserId).mock.invocationCallOrder, ...jest.mocked(clearUserId).mock.invocationCallOrder];
      expect(jest.mocked(persistUserId).mock.calls.map(c => c[0])).toEqual(['user-a', 'user-b']);
      expect(jest.mocked(persistUserId).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(clearUserId).mock.invocationCallOrder[0]);
      expect(jest.mocked(clearUserId).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(persistUserId).mock.invocationCallOrder[1]);
      expect(order.length).toBe(3);
      expect(restoreAndroidBackgroundSync).toHaveBeenLastCalledWith('user-b', expect.any(Function));
      expect(local).toEqual({ id: 'user-b', registered: true });
    },
  );

  it('a disconnect clearing A\'s identity cannot erase B that logged in meanwhile', async () => {
    const clearing = gate('clear');
    let outcome!: Promise<string>;
    await act(async () => {
      outcome = current.disconnect('health_connect').then(() => 'ok', (e: Error) => e.message);
      await clearing.reached;
      void switchTo('user-b');
      clearing.release();
      await whenHealthSyncSettled();
    });
    await expect(outcome).resolves.toContain('account changed');
    expect(local).toEqual({ id: 'user-b', registered: true });
  });

  it('enable-background registration for A is vetoed by a logout and nothing stays registered', async () => {
    local.registered = false;
    const registering = gate('register');
    let outcome!: Promise<string>;
    await act(async () => {
      outcome = current.enableBackgroundSync().then(() => 'ok', (e: Error) => e.message);
      await registering.reached;
      void switchTo(null);
      registering.release();
      await whenHealthSyncSettled();
    });
    await expect(outcome).resolves.toContain('account changed');
    expect(local).toEqual({ id: null, registered: false });
  });

  it('does not let a hook action write local state for a user who is no longer the owner', async () => {
    await switchTo('user-b');
    jest.mocked(persistUserId).mockClear();
    await act(async () => { await expect(current.confirmHealthConnectConnection()).rejects.toThrow('account changed'); });
    expect(persistUserId).not.toHaveBeenCalledWith('user-a');
    expect(local.id).toBe('user-b');
  });
});

it('ignores a late connection fetch from the previous account', async () => {
  let finish!: (value: unknown) => void;
  (supabase.from as jest.Mock).mockReturnValueOnce({ select: () => ({ eq: () => new Promise(resolve => { finish = resolve; }) }) });
  const staleFetch = current.refresh();
  await act(async () => { root.update(createElement(Harness, { userId: 'user-b' })); });
  await act(async () => {
    finish({ data: [{ provider: 'strava', is_active: true, last_synced_at: null }], error: null });
    await staleFetch;
  });
  expect(current.connections.map(c => c.provider)).toEqual(['health_connect']);
});

it('rejects simultaneous manual sync taps instead of claiming an empty success', async () => {
  let finish!: (value: Awaited<ReturnType<typeof pollHealthConnect>>) => void;
  jest.mocked(pollHealthConnect).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  let first!: Promise<number>;
  await act(async () => {
    first = current.syncNow();
    await expect(current.syncNow()).rejects.toThrow('already running');
  });
  await act(async () => { finish({ synced: 0, completed: true, ranWithPermissions: true, ...outcomes() }); await first; });
  expect(pollHealthConnect).toHaveBeenCalledTimes(1);
});

it('does not write a success timestamp after the account changes during import', async () => {
  jest.mocked(pollHealthConnect).mockImplementationOnce(async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    return { synced: 1, completed: true, ranWithPermissions: true, ...outcomes(1) };
  });
  await act(async () => { await expect(current.syncNow()).rejects.toThrow('account changed'); });
  expect(update).not.toHaveBeenCalled();
  expect(current.lastSynced).toBeNull();
  expect(current.syncing).toBe(false);
});

it('does not persist a connection after an account changes in the permission dialog', async () => {
  jest.mocked(initHealthConnect).mockImplementationOnce(async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    return true;
  });
  await act(async () => { await expect(current.connectNative()).rejects.toThrow('account changed'); });
  expect(upsert).not.toHaveBeenCalled();
  expect(persistUserId).not.toHaveBeenCalled();
});

it('reports a failed disconnect instead of clearing local background identity', async () => {
  writeStatus.mockResolvedValue({ error: new Error('Offline') });
  await act(async () => { await expect(current.disconnect('health_connect')).rejects.toThrow('Offline'); });
  expect(unregisterBackgroundSync).not.toHaveBeenCalled();
});

it.each(['connectNative', 'confirmHealthConnectConnection'] as const)(
  'exposes failed background registration but allows foreground sync via %s', async method => {
    jest.mocked(registerBackgroundSync).mockResolvedValue(false);
    await act(async () => { await current[method](); });
    expect(current.backgroundSyncUnavailable).toBe(true);
    expect(pollHealthConnect).toHaveBeenCalledTimes(1);
    expect(current.lastSynced).toBeInstanceOf(Date);
    jest.mocked(registerBackgroundSync).mockResolvedValue(true);
    await act(async () => { await current[method](); });
    expect(current.backgroundSyncUnavailable).toBe(false);
  },
);

it.each(['connectNative', 'confirmHealthConnectConnection'] as const)(
  'restores background registration after disconnect via %s', async method => {
    await act(async () => { await current.disconnect('health_connect'); });
    expect(unregisterBackgroundSync).toHaveBeenCalledTimes(1);
    await act(async () => { await current[method](); });
    expect(persistUserId).toHaveBeenCalledWith('user-a');
    expect(registerBackgroundSync).toHaveBeenCalledTimes(1);
    expect(jest.mocked(persistUserId).mock.invocationCallOrder[0])
      .toBeLessThan(jest.mocked(registerBackgroundSync).mock.invocationCallOrder[0]);
    expect(jest.mocked(registerBackgroundSync).mock.invocationCallOrder[0])
      .toBeLessThan(jest.mocked(pollHealthConnect).mock.invocationCallOrder[0]);
  },
);

it.each(['connectNative', 'confirmHealthConnectConnection'] as const)(
  'does not register background work if %s is denied', async method => {
    jest.mocked(initHealthConnect).mockResolvedValue(false);
    jest.mocked(checkHealthConnectGranted).mockResolvedValue(false);
    await act(async () => { await current[method](); });
    expect(registerBackgroundSync).not.toHaveBeenCalled();
    expect(persistUserId).not.toHaveBeenCalled();
  },
);

it.each(['connectNative', 'confirmHealthConnectConnection'] as const)(
  'does not register background work if %s cannot save the connection', async method => {
    upsert.mockResolvedValue({ error: new Error('Offline') });
    await act(async () => { await expect(current[method]()).rejects.toThrow('Offline'); });
    expect(registerBackgroundSync).not.toHaveBeenCalled();
  },
);

it('does not mark a partial import successful and releases the syncing state', async () => {
  jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 1, ranWithPermissions: true, completed: false });
  await act(async () => { await expect(current.syncNow()).rejects.toThrow('Sync did not complete'); });
  expect(update).not.toHaveBeenCalled();
  expect(current.lastSynced).toBeNull();
  expect(current.syncing).toBe(false);
});

it('releases the syncing state after a preflight rejection', async () => {
  jest.mocked(pollHealthConnect).mockRejectedValue(new Error('Storage unavailable'));
  await act(async () => { await expect(current.syncNow()).rejects.toThrow('Storage unavailable'); });
  expect(update).not.toHaveBeenCalled();
  expect(current.lastSynced).toBeNull();
  expect(current.syncing).toBe(false);
});

it('records a successful empty sync only after persisting its timestamp', async () => {
  await act(async () => { await expect(current.syncNow()).resolves.toBe(0); });
  expect(writeStatus).toHaveBeenCalledWith('provider');
  expect(update).toHaveBeenCalledWith({ last_synced_at: current.lastSynced?.toISOString() });
  expect(current.lastSynced).toBeInstanceOf(Date);
  expect(current.syncing).toBe(false);
});

it('does not set a local success timestamp when status persistence fails', async () => {
  writeStatus.mockResolvedValue({ error: new Error('Offline') });
  await act(async () => { await expect(current.syncNow()).rejects.toThrow('Offline'); });
  expect(current.lastSynced).toBeNull();
  expect(current.syncing).toBe(false);
});

it('distinguishes a granted connection from an unsuccessful first import', async () => {
  jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 0, ranWithPermissions: true, completed: false });
  await act(async () => {
    await expect(current.connectNative()).resolves.toEqual({
      success: true, message: 'Connected, but the first sync did not complete. Please try Sync now.',
    });
  });
  expect(upsert).toHaveBeenCalledWith(
    { user_id: 'user-a', provider: 'health_connect', is_active: true },
    { onConflict: 'user_id,provider' },
  );
  expect(update).not.toHaveBeenCalled();
  expect(current.lastSynced).toBeNull();
  expect(current.syncing).toBe(false);
});

it('does not invent a successful sync when confirming permissions after settings', async () => {
  jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 0, ranWithPermissions: false, completed: false });
  await act(async () => { await expect(current.confirmHealthConnectConnection()).resolves.toBe(true); });
  expect(upsert.mock.calls[0][0]).not.toHaveProperty('last_synced_at');
  expect(update).not.toHaveBeenCalled();
  expect(current.lastSynced).toBeNull();
  expect(current.syncing).toBe(false);
});

describe('truthful foreground feedback contract', () => {
  const partial = (exercise: 'ok' | 'failed' | 'skipped', written: number, steps: 'ok' | 'failed' | 'skipped', extra = {}) => ({
    synced: written, ranWithPermissions: true, completed: false,
    exercise: { status: exercise, written, cursorAdvanced: exercise === 'ok' },
    steps: { status: steps, written: 0, updated: false },
    ...extra,
  });
  const thrown = async (promise: Promise<unknown>) => { try { await promise; } catch (e) { return e; } return undefined; };

  it('returns the workout count for a complete Android poll, excluding the Steps insert', async () => {
    jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 3, ranWithPermissions: true, completed: true, ...outcomes(2, 1) });
    await act(async () => { await expect(current.syncNow()).resolves.toBe(2); });
    expect(update).toHaveBeenCalledTimes(1);
    expect(current.lastSynced).toBeInstanceOf(Date);
  });

  it('a complete poll with only a Steps change is zero workouts, not one', async () => {
    jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 1, ranWithPermissions: true, completed: true, ...outcomes(0, 1) });
    await act(async () => { await expect(current.syncNow()).resolves.toBe(0); });
  });

  it.each([
    ['no outcome', { synced: 2, ranWithPermissions: true, completed: true }],
    ['a non-ok exercise outcome', { synced: 2, ranWithPermissions: true, completed: true, ...outcomes(2), exercise: { status: 'failed' as const, written: 2, cursorAdvanced: false } }],
  ])('a completed poll with %s fails safely: no invented count and no timestamp', async (_n, result) => {
    jest.mocked(pollHealthConnect).mockResolvedValue(result);
    await act(async () => { await expect(current.syncNow()).rejects.toThrow('Sync did not complete'); });
    expect(update).not.toHaveBeenCalled();
    expect(current.lastSynced).toBeNull();
    expect(current.syncing).toBe(false);
  });

  it('an incomplete poll throws the typed error with per-type counts, keeps the message prefix and writes no timestamp', async () => {
    const result = partial('failed', 50, 'ok');
    jest.mocked(pollHealthConnect).mockResolvedValue(result);
    let error: unknown;
    await act(async () => { error = await thrown(current.syncNow()); });
    expect(error).toBeInstanceOf(HealthSyncIncompleteError);
    expect((error as Error).message.startsWith('Sync did not complete')).toBe(true);
    expect((error as HealthSyncIncompleteError).result.exercise?.written).toBe(50);
    expect(update).not.toHaveBeenCalled();
    expect(current.lastSynced).toBeNull();
  });

  it('exercise-only permission is typed, shows the notice and writes no timestamp', async () => {
    jest.mocked(pollHealthConnect).mockResolvedValue(partial('ok', 2, 'skipped', { missingPermissions: ['Steps'] }));
    let error: unknown;
    await act(async () => { error = await thrown(current.syncNow()); });
    expect((error as HealthSyncIncompleteError).result.exercise).toEqual({ status: 'ok', written: 2, cursorAdvanced: true });
    expect(current.permissionNotice).toContain('Steps');
    expect(update).not.toHaveBeenCalled();
  });

  it('a timestamp save failure after a complete poll is not reported as success or as a typed result', async () => {
    jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 2, ranWithPermissions: true, completed: true, ...outcomes(2) });
    writeStatus.mockResolvedValue({ error: new Error('Offline') });
    let error: unknown;
    await act(async () => { error = await thrown(current.syncNow()); });
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(HealthSyncIncompleteError);
    expect(current.lastSynced).toBeNull();
  });

  it('an account change during the poll rejects as stale and never exposes the old outcome', async () => {
    jest.mocked(pollHealthConnect).mockImplementationOnce(async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
      return partial('failed', 7, 'ok');
    });
    let error: unknown;
    await act(async () => { error = await thrown(current.syncNow()); });
    expect(error).not.toBeInstanceOf(HealthSyncIncompleteError);
    expect((error as Error).message).toContain('account changed');
    expect(JSON.stringify(error)).not.toContain('"written":7');
    expect(update).not.toHaveBeenCalled();
  });

  it('connectNative keeps success:true but reports a partial first import in detail', async () => {
    jest.mocked(pollHealthConnect).mockResolvedValue(partial('ok', 1, 'skipped', { missingPermissions: ['Steps'] }));
    let outcome: { success: boolean; message: string } | undefined;
    await act(async () => { outcome = await current.connectNative(); });
    expect(outcome?.success).toBe(true);
    expect(outcome?.message.startsWith('Connected. Workout sync completed: 1 new workout imported.')).toBe(true);
    expect(outcome?.message).not.toMatch(/recent workouts have been synced/);
    expect(update).not.toHaveBeenCalled();
    expect(current.lastSynced).toBeNull();
  });

  it('connectNative still reports a full first import as synced', async () => {
    await act(async () => {
      await expect(current.connectNative()).resolves.toEqual({ success: true, message: 'Connected! Your recent workouts have been synced.' });
    });
  });

  it('connectNative rejects as stale, without exposing the partial outcome, if the account changes during the first import', async () => {
    jest.mocked(pollHealthConnect).mockImplementationOnce(async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
      return partial('failed', 3, 'ok');
    });
    await act(async () => { await expect(current.connectNative()).rejects.toThrow('account changed'); });
  });

  it('confirmHealthConnectConnection stays a permissions/connection boolean after a partial first import', async () => {
    jest.mocked(pollHealthConnect).mockResolvedValue(partial('failed', 2, 'ok'));
    await act(async () => { await expect(current.confirmHealthConnectConnection()).resolves.toBe(true); });
    expect(update).not.toHaveBeenCalled();
  });
});
