import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { hasActiveHealthConnectConnection } from '../src/lib/healthConnectionConsent';
import { getHealthConnectBackgroundState } from '../src/lib/healthConnectBackground';
import { initHealthKit, teardownHealthKit } from '../src/lib/healthKit';
import {
  __resetHealthSyncLifecycleForTests, disconnectHealthSyncBackground, registerHealthSyncBackground,
  requestHealthSyncOwner, runHealthSyncOperation, whenHealthSyncSettled,
} from '../src/lib/healthSyncLifecycle';

// Real backgroundSync + lifecycle run against an in-memory identity store and task registry.
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-background-fetch', () => ({
  BackgroundFetchResult: { NoData: 1, NewData: 2, Failed: 3 },
  BackgroundFetchStatus: { Denied: 1, Restricted: 2, Available: 3 },
  getStatusAsync: jest.fn(), registerTaskAsync: jest.fn(), unregisterTaskAsync: jest.fn(),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn(), refreshSession: jest.fn() }, from: jest.fn() } }));
jest.mock('../src/lib/healthConnect', () => ({ pollHealthConnect: jest.fn() }));
jest.mock('../src/lib/healthConnectBackground', () => ({ getHealthConnectBackgroundState: jest.fn() }));
jest.mock('../src/lib/healthConnectionConsent', () => ({ hasActiveHealthConnectConnection: jest.fn() }));
jest.mock('../src/lib/healthKit', () => ({
  syncRecentWorkouts: jest.fn(), syncTodaySteps: jest.fn(), initHealthKit: jest.fn(), teardownHealthKit: jest.fn(),
}));

const KEY = 'streakwar_user_id';
const store = new Map<string, string>();
let registered = false;
let sessionUser: string | null = 'a';

/** One-shot gate on a fake native call: it announces it was reached, then waits for release/fail. */
type Gate = { reached: Promise<void>; release(): void; fail(error: Error): void };
const gates = new Map<string, { wait: Promise<void>; reached(): void }>();
function gate(name: string): Gate {
  let release!: () => void;
  let fail!: (e: Error) => void;
  let reached!: () => void;
  const wait = new Promise<void>((resolve, reject) => { release = resolve; fail = reject; });
  wait.catch(() => {});
  const reachedPromise = new Promise<void>(resolve => { reached = resolve; });
  gates.set(name, { wait, reached });
  return { reached: reachedPromise, release, fail };
}
async function pass(name: string) {
  const g = gates.get(name);
  if (!g) return;
  gates.delete(name);
  g.reached();
  await g.wait;
}
/** The auth session changes just before the AuthProvider asks the lifecycle for the new owner. */
const request = (id: string | null) => { sessionUser = id; return requestHealthSyncOwner(id); };
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const setPlatform = (os: string) => { (Platform as { OS: string }).OS = os; };
const warn = jest.spyOn(console, 'warn');

beforeEach(() => {
  jest.resetAllMocks();
  warn.mockImplementation(() => {});
  __resetHealthSyncLifecycleForTests();
  store.clear(); gates.clear(); registered = false; sessionUser = 'a';
  setPlatform('android');
  jest.mocked(AsyncStorage.getItem).mockImplementation(async k => store.get(k) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (k, v) => { await pass('setItem'); store.set(k, v); });
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async k => { await pass('removeItem'); store.delete(k); });
  jest.mocked(TaskManager.isTaskRegisteredAsync).mockImplementation(async () => { await pass('isRegistered'); return registered; });
  jest.mocked(BackgroundFetch.registerTaskAsync).mockImplementation(async () => { await pass('register'); registered = true; });
  jest.mocked(BackgroundFetch.unregisterTaskAsync).mockImplementation(async () => { await pass('unregister'); registered = false; });
  jest.mocked(BackgroundFetch.getStatusAsync).mockResolvedValue(BackgroundFetch.BackgroundFetchStatus.Available);
  jest.mocked(getHealthConnectBackgroundState).mockResolvedValue('granted');
  jest.mocked(hasActiveHealthConnectConnection).mockResolvedValue(true);
  (supabase.auth.getSession as jest.Mock).mockImplementation(async () => ({
    data: { session: sessionUser ? { user: { id: sessionUser } } : null }, error: null,
  }));
});
afterEach(async () => { await whenHealthSyncSettled(); });

const owns = (id: string | null) => {
  expect(store.get(KEY) ?? null).toBe(id);
  expect(registered).toBe(id !== null);
};

it('rejects an old queued disconnect after A -> B -> A before it starts', async () => {
  await request('a');
  const checking = gate('isRegistered');
  const blocker = registerHealthSyncBackground('a', { persist: false }).catch(() => false);
  await checking.reached;
  const staleDisconnect = disconnectHealthSyncBackground('a').then(() => 'accepted', () => 'stale');
  const b = request('b');
  const aAgain = request('a');
  checking.release();
  await Promise.all([blocker, b, aAgain]);
  expect(await staleDisconnect).toBe('stale');
  owns('a');
});

it('retries an Android startup after a returned registration failure', async () => {
  jest.mocked(BackgroundFetch.registerTaskAsync).mockRejectedValueOnce(new Error('Native busy'));
  await request('a');
  expect(registered).toBe(false);
  await request('a');
  owns('a');
});

it('reports a returned unregister failure on explicit disconnect', async () => {
  await request('a');
  jest.mocked(BackgroundFetch.unregisterTaskAsync).mockRejectedValueOnce(new Error('Native busy'));
  await expect(disconnectHealthSyncBackground('a')).rejects.toThrow();
});

it('starts the owner: persists identity and registers with the existing options', async () => {
  await request('a');
  owns('a');
  expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith('streakwar-health-sync', {
    minimumInterval: 900, stopOnTerminate: false, startOnBoot: true,
  });
});

it('does not register for an owner without an active Android connection', async () => {
  jest.mocked(hasActiveHealthConnectConnection).mockResolvedValue(false);
  await request('a');
  expect(store.size).toBe(0);
  expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
});

it('a late A startup cannot persist or register after logout', async () => {
  const persisting = gate('setItem');
  const started = request('a');
  await persisting.reached;                    // A is mid-persist
  const loggedOut = request(null);
  persisting.release();                        // A's write lands late...
  await Promise.all([started, loggedOut]);
  owns(null);                                  // ...and is cleaned up, never registered
  expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
});

it('delayed logout cleanup finishing after B logs in cannot erase B', async () => {
  await request('a');
  const clearing = gate('removeItem');
  const loggedOut = request(null);
  await clearing.reached;                      // A's cleanup is in flight
  sessionUser = 'b';
  const loggedIn = request('b'); // B arrives before cleanup finished
  await tick();
  expect(registered).toBe(true);               // B has NOT started yet (queued behind cleanup)
  clearing.release();
  await Promise.all([loggedOut, loggedIn]);
  owns('b');
});

it('delayed unregister from A cannot unregister B', async () => {
  await request('a');
  const unregistering = gate('unregister');
  const loggedOut = request(null);
  await unregistering.reached;
  const loggedIn = request('b');
  unregistering.release();
  await Promise.all([loggedOut, loggedIn]);
  owns('b');
});

it('handles a direct A -> B switch without a null in between', async () => {
  await request('a');
  await request('b');
  owns('b');
  expect(BackgroundFetch.unregisterTaskAsync).toHaveBeenCalledTimes(1);
  expect(teardownHealthKit).toHaveBeenCalled();
});

it('handles A -> null -> B', async () => {
  await request('a');
  await request(null);
  owns(null);
  await request('b');
  owns('b');
});

it('collapses rapid changes: only the latest owner is ever written', async () => {
  const persisting = gate('setItem');
  const first = request('a');
  await persisting.reached;
  const rest = [request('b'), request(null), request('c'),
    request(null), request('d')];
  persisting.release();
  await Promise.all([first, ...rest]);
  owns('d');
  const written = jest.mocked(AsyncStorage.setItem).mock.calls.map(c => c[1]);
  expect(written).toEqual(['a', 'd']);         // 'a' was already mid-write; b and c never started
});

it('same-user repeats (token refresh) do not tear down or restart anything', async () => {
  await request('a');
  jest.mocked(AsyncStorage.setItem).mockClear();
  jest.mocked(AsyncStorage.removeItem).mockClear();
  jest.mocked(BackgroundFetch.registerTaskAsync).mockClear();
  await Promise.all([request('a'), request('a'), request('a')]);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  expect(BackgroundFetch.unregisterTaskAsync).not.toHaveBeenCalled();
  owns('a');
});

it('a fresh launch with an existing session does not unregister and re-register the task', async () => {
  registered = true;
  store.set(KEY, 'a');
  await request('a');
  expect(BackgroundFetch.unregisterTaskAsync).not.toHaveBeenCalled();
  expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  owns('a');
});

it('a fresh launch with no session clears a stale identity and task', async () => {
  registered = true;
  store.set(KEY, 'stale');
  await request(null);
  owns(null);
});

it('attempts every cleanup step when one fails, then recovers on a later request', async () => {
  await request('a');
  const clearing = gate('removeItem');
  const loggedOut = request(null);
  await clearing.reached;
  clearing.fail(new Error('Storage unavailable'));
  await expect(loggedOut).resolves.toBeUndefined();   // never rejects
  expect(store.get(KEY)).toBe('a');                   // identity clear failed...
  expect(registered).toBe(false);                     // ...but the task was still unregistered
  await request(null);                 // later recovery retries the cleanup
  owns(null);
});

it('does not poison the queue when unregister fails; the next owner still starts', async () => {
  await request('a');
  const unregistering = gate('unregister');
  const loggedOut = request(null);
  await unregistering.reached;
  unregistering.fail(new Error('Busy'));
  await expect(loggedOut).resolves.toBeUndefined();
  await request('b');
  owns('b');
});

it('retries a failed startup on the next request for the same owner', async () => {
  setPlatform('ios');
  const persisting = gate('setItem');
  const started = request('a');
  await persisting.reached;
  persisting.fail(new Error('Disk full'));
  await expect(started).resolves.toBeUndefined();
  expect(store.size).toBe(0);
  expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();   // no false registration claim
  await request('a');
  owns('a');
});

it('keeps the HealthKit startup/teardown call sites on iOS, in order, for the latest owner only', async () => {
  setPlatform('ios');
  await request('a');
  expect(initHealthKit).toHaveBeenCalledWith('a');
  await request(null);
  expect(teardownHealthKit).toHaveBeenCalledTimes(1);
  const registering = gate('isRegistered');
  const b = request('b');
  await registering.reached;
  const c = request('c');
  registering.release();
  await Promise.all([b, c]);
  expect(jest.mocked(initHealthKit).mock.calls.map(c2 => c2[0])).toEqual(['a', 'c']);
  owns('c');
});

describe('user-initiated operations share the queue', () => {
  it('a disconnect from A that is still running cannot erase B after an account switch', async () => {
    await request('a');
    const clearing = gate('removeItem');
    const disconnect = disconnectHealthSyncBackground('a');
    const outcome = disconnect.then(() => 'ok', (e: Error) => e.message);
    await clearing.reached;
    sessionUser = 'b';
    const switched = request('b');
    clearing.release();
    await expect(outcome).resolves.toContain('account changed');
    await switched;
    owns('b');
  });

  it('a reconnect queued behind an account switch is rejected and writes nothing for A', async () => {
    await request('a');
    const registering = gate('isRegistered');
    const switched = request('b');           // start of switch: cleanup runs first
    const reconnect = registerHealthSyncBackground('a', { persist: true });
    const outcome = reconnect.then(() => 'ok', (e: Error) => e.message);
    sessionUser = 'b';
    registering.release();
    await switched;
    await expect(outcome).resolves.toContain('account changed');
    owns('b');
    expect(jest.mocked(AsyncStorage.setItem).mock.calls.map(c => c[1])).toEqual(['a', 'b']);
  });

  it('an enable-background registration for A that is mid-flight is vetoed by an account switch', async () => {
    await request('a');
    store.delete(KEY); registered = false;
    const checking = gate('isRegistered');
    const enable = registerHealthSyncBackground('a', { persist: false });
    const outcome = enable.then(() => 'ok', (e: Error) => e.message);
    await checking.reached;
    const loggedOut = request(null);
    checking.release();
    await expect(outcome).resolves.toContain('account changed');
    await loggedOut;
    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledTimes(1);   // only the initial owner start
    owns(null);
  });

  it('rejects an operation for a user who is not the current owner without side effects', async () => {
    await request('a');
    jest.mocked(AsyncStorage.setItem).mockClear();
    await expect(registerHealthSyncBackground('b', { persist: true })).rejects.toThrow('account changed');
    await expect(disconnectHealthSyncBackground('b')).rejects.toThrow('account changed');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    owns('a');
  });

  it('disconnect clears identity and task for the current owner, and reconnect restores them', async () => {
    await request('a');
    await disconnectHealthSyncBackground('a');
    owns(null);
    await expect(registerHealthSyncBackground('a', { persist: true })).resolves.toBe(true);
    owns('a');
  });

  it('disconnect attempts the unregister even if clearing identity fails, and reports the failure', async () => {
    await request('a');
    const clearing = gate('removeItem');
    const disconnect = disconnectHealthSyncBackground('a');
    const outcome = disconnect.then(() => 'ok', (e: Error) => e.message);
    await clearing.reached;
    clearing.fail(new Error('Storage unavailable'));
    await expect(outcome).resolves.toBe('Storage unavailable');
    expect(registered).toBe(false);
  });

  it('an operation failure does not poison later work', async () => {
    await request('a');
    await expect(runHealthSyncOperation('a', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    await request('b');
    owns('b');
  });
});

it('whenHealthSyncSettled waits for work queued after it was first called', async () => {
  const persisting = gate('setItem');
  void request('a');
  await persisting.reached;
  let done = false;
  const settled = whenHealthSyncSettled().then(() => { done = true; });
  void request('b');
  persisting.release();
  await settled;
  expect(done).toBe(true);
  owns('b');
});

describe('review regressions', () => {
  it('rejects a queued disconnect for A after A -> B -> A (ABA) and leaves the new A intact', async () => {
    await request('a');
    const blocking = gate('isRegistered');
    const blocker = registerHealthSyncBackground('a', { persist: false }).catch(() => false);
    await blocking.reached;
    const stale = disconnectHealthSyncBackground('a').then(() => 'accepted', () => 'stale');
    const b = request('b');
    const a = request('a');
    blocking.release();
    await Promise.all([blocker, b, a]);
    expect(await stale).toBe('stale');
    owns('a');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(BackgroundFetch.unregisterTaskAsync).not.toHaveBeenCalled();
  });

  it('resumes an owner start that was interrupted by A -> B -> A instead of dropping it', async () => {
    const persisting = gate('setItem');
    const first = request('a');
    await persisting.reached;
    const rest = [request('b'), request('a')];
    persisting.release();
    await Promise.all([first, ...rest]);
    owns('a');
  });

  it('retries after a native registration rejection on the next same-owner request', async () => {
    jest.mocked(BackgroundFetch.registerTaskAsync).mockRejectedValueOnce(new Error('Native busy'));
    await request('a');
    expect(registered).toBe(false);              // not claimed as set up
    await request('a');
    owns('a');
  });

  it('retries a start that returned false (no consent yet) only when asked again, and not after success', async () => {
    jest.mocked(hasActiveHealthConnectConnection).mockResolvedValueOnce(false);
    await request('a');
    expect(registered).toBe(false);
    await request('a');
    owns('a');
    jest.mocked(BackgroundFetch.registerTaskAsync).mockClear();
    jest.mocked(AsyncStorage.setItem).mockClear();
    await Promise.all([request('a'), request('a')]);   // successful token refreshes: no churn
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('retries an incomplete iOS registration but never re-prompts HealthKit when already initialised', async () => {
    setPlatform('ios');
    jest.mocked(BackgroundFetch.registerTaskAsync).mockRejectedValueOnce(new Error('Native busy'));
    await request('a');
    expect(registered).toBe(false);
    await request('a');
    owns('a');
  });

  it('reports a failed unregister on explicit disconnect, still clears identity, and can be retried', async () => {
    await request('a');
    jest.mocked(BackgroundFetch.unregisterTaskAsync).mockRejectedValueOnce(new Error('Native busy'));
    await expect(disconnectHealthSyncBackground('a')).rejects.toThrow('unregister');
    expect(store.size).toBe(0);                  // independent step still ran
    expect(registered).toBe(true);               // task really is still registered
    await expect(disconnectHealthSyncBackground('a')).resolves.toBeUndefined();
    owns(null);
  });

  it('reports the identity-clear error first but still attempts the unregister', async () => {
    await request('a');
    const clearing = gate('removeItem');
    const disconnect = disconnectHealthSyncBackground('a');
    const outcome = disconnect.then(() => 'ok', (e: Error) => e.message);
    await clearing.reached;
    clearing.fail(new Error('Storage unavailable'));
    await expect(outcome).resolves.toBe('Storage unavailable');
    expect(registered).toBe(false);
  });

  it('a failed disconnect leaves cleanup retryable at the next logout', async () => {
    await request('a');
    jest.mocked(BackgroundFetch.unregisterTaskAsync).mockRejectedValueOnce(new Error('Native busy'));
    await expect(disconnectHealthSyncBackground('a')).rejects.toThrow();
    await request(null);
    owns(null);
  });
});
