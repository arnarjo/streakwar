import { act, createElement, useEffect, type ReactElement } from 'react';
import { Alert } from 'react-native';
import { AuthProvider, useAuth, type AuthContextValue } from '../src/contexts/AuthContext';
import { supabase } from '../src/lib/supabase';
import {
  persistUserId, clearUserId, registerBackgroundSync, restoreAndroidBackgroundSync, unregisterBackgroundSync,
} from '../src/lib/backgroundSync';
import { teardownHealthKit } from '../src/lib/healthKit';
import { configurePurchases, logOutPurchases } from '../src/hooks/usePremium';
import { cancelStreakReminders } from '../src/lib/streakNotification';
import { __resetHealthSyncLifecycleForTests, whenHealthSyncSettled } from '../src/lib/healthSyncLifecycle';

// Real AuthProvider + real lifecycle coordinator; only native/service edges are faked.
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Alert: { alert: jest.fn() } }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'streakwar://') }));
jest.mock('../src/hooks/usePremium', () => ({ configurePurchases: jest.fn(), logOutPurchases: jest.fn() }));
jest.mock('../src/lib/streakNotification', () => ({ cancelStreakReminders: jest.fn() }));
jest.mock('../src/lib/healthKit', () => ({ teardownHealthKit: jest.fn(), initHealthKit: jest.fn() }));
jest.mock('../src/lib/backgroundSync', () => ({
  persistUserId: jest.fn(), clearUserId: jest.fn(), registerBackgroundSync: jest.fn(),
  restoreAndroidBackgroundSync: jest.fn(), unregisterBackgroundSync: jest.fn(),
}));
jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn(), signOut: jest.fn(), getSession: jest.fn() }, from: jest.fn() },
}));

const renderer = jest.requireActual<{ create(element: ReactElement): { unmount(): void } }>('react-test-renderer');
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;

type Callback = (event: string, session: unknown) => unknown;
let authCallback: Callback;
const unsubscribe = jest.fn();
let current: AuthContextValue;
let root: ReturnType<typeof renderer.create> | null;

const store = { id: null as string | null, registered: false };
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

type ProfileRequest = { id: string; resolve(value: unknown): void; reject(error: unknown): void };
let profileRequests: ProfileRequest[] = [];
const profileRow = (id: string) => ({ id, username: `user-${id}` });
const respond = (request: ProfileRequest) => request.resolve({ data: profileRow(request.id), error: null });

const session = (id: string) => ({ user: { id } });
const emit = (event: string, value: unknown) => act(async () => { authCallback(event, value); });
const userStore = () => ({ id: store.id, registered: store.registered });

function Probe() {
  const value = useAuth();
  useEffect(() => { current = value; });
  return null;
}
const mount = async () => { await act(async () => { root = renderer.create(createElement(AuthProvider, null, createElement(Probe))); }); };

beforeAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
beforeEach(async () => {
  jest.resetAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(cancelStreakReminders).mockResolvedValue(undefined as never);
  __resetHealthSyncLifecycleForTests();
  store.id = null; store.registered = false; gates.clear(); profileRequests = [];
  jest.mocked(persistUserId).mockImplementation(async id => { await pass('persist'); store.id = id; });
  jest.mocked(clearUserId).mockImplementation(async () => { await pass('clear'); store.id = null; });
  jest.mocked(registerBackgroundSync).mockImplementation(async isCurrent => {
    if (isCurrent && !isCurrent()) return false;
    store.registered = true;
    return true;
  });
  jest.mocked(restoreAndroidBackgroundSync).mockImplementation(async (id, isCurrent) => {
    await pass('restore');
    if (isCurrent && !isCurrent()) return false;
    await persistUserId(id);
    return registerBackgroundSync(isCurrent);
  });
  jest.mocked(unregisterBackgroundSync).mockImplementation(async () => { await pass('unregister'); store.registered = false; return true; });
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(((cb: Callback) => {
    authCallback = cb;
    return { data: { subscription: { unsubscribe } } };
  }) as never);
  jest.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);
  (supabase.from as jest.Mock).mockImplementation(() => ({
    select: () => ({ eq: (_c: string, id: string) => ({
      single: () => new Promise((resolve, reject) => { profileRequests.push({ id, resolve, reject }); }),
    }) }),
  }));
  root = null;
  await mount();
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  await whenHealthSyncSettled();
});

it('subscribes once and keeps the auth callback synchronous', async () => {
  expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  let returned: unknown = 'unset';
  await act(async () => { returned = authCallback('SIGNED_IN', session('a')); });
  expect(returned).toBeUndefined();            // nothing awaited inside Supabase's auth lock
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
});

it('invalidates old account/profile work when another account enters recovery', async () => {
  await emit('SIGNED_IN', session('a'));
  const oldProfile = profileRequests[0];
  await emit('PASSWORD_RECOVERY', session('b'));
  await act(async () => { respond(oldProfile); });
  expect(current.needsPasswordReset).toBe(true);
  expect(current.userId).not.toBe('a');
  expect(current.profile?.id).not.toBe('a');
  expect(store.id).not.toBe('a');
});

it('starts health sync for the signed-in user without waiting for the profile', async () => {
  await emit('SIGNED_IN', session('a'));
  await act(async () => { await whenHealthSyncSettled(); });
  expect(userStore()).toEqual({ id: 'a', registered: true });
  expect(current.loading).toBe(true);          // profile still pending
  await act(async () => { respond(profileRequests[0]); });
  expect(current.profile?.id).toBe('a');
  expect(current.loading).toBe(false);
});

it('cleans up on an external SIGNED_OUT that did not go through signOut()', async () => {
  await emit('SIGNED_IN', session('a'));
  await act(async () => { respond(profileRequests[0]); await whenHealthSyncSettled(); });
  await emit('SIGNED_OUT', null);
  await act(async () => { await whenHealthSyncSettled(); });
  expect(userStore()).toEqual({ id: null, registered: false });
  expect(teardownHealthKit).toHaveBeenCalled();
  expect(logOutPurchases).toHaveBeenCalled();
  expect(current.profile).toBeNull();
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
});

it('does not tear down or restart on a same-user token refresh', async () => {
  await emit('SIGNED_IN', session('a'));
  await act(async () => { await whenHealthSyncSettled(); });
  jest.mocked(persistUserId).mockClear();
  await emit('TOKEN_REFRESHED', session('a'));
  await emit('TOKEN_REFRESHED', session('a'));
  await act(async () => { await whenHealthSyncSettled(); });
  expect(clearUserId).not.toHaveBeenCalled();
  expect(unregisterBackgroundSync).not.toHaveBeenCalled();
  expect(persistUserId).not.toHaveBeenCalled();
  expect(configurePurchases).toHaveBeenCalledTimes(1);
  expect(userStore()).toEqual({ id: 'a', registered: true });
});

it('switches A -> B directly: clears the profile at once, ignores A\'s late response, ends owned by B', async () => {
  await emit('SIGNED_IN', session('a'));
  await act(async () => { respond(profileRequests[0]); await whenHealthSyncSettled(); });
  expect(current.profile?.id).toBe('a');
  await emit('SIGNED_IN', session('b'));
  expect(current.profile).toBeNull();          // stale profile never shown for B
  await act(async () => { await whenHealthSyncSettled(); });
  expect(userStore()).toEqual({ id: 'b', registered: true });
  await act(async () => { respond(profileRequests[1]); });
  expect(current.profile?.id).toBe('b');
});

it('ignores a late profile response and finally-block from the previous account', async () => {
  await emit('SIGNED_IN', session('a'));
  await emit('SIGNED_IN', session('b'));
  await act(async () => { respond(profileRequests[0]); });   // A answers after the switch
  expect(current.profile).toBeNull();
  expect(current.loading).toBe(true);                        // B is still loading; A's finally did not flip it
  await act(async () => { respond(profileRequests[1]); });
  expect(current.profile?.id).toBe('b');
  expect(current.loading).toBe(false);
});

it('ignores a late profile response after sign-out and a failed one after switching', async () => {
  await emit('SIGNED_IN', session('a'));
  await emit('SIGNED_OUT', null);
  await act(async () => { respond(profileRequests[0]); });
  expect(current.profile).toBeNull();
  expect(current.loading).toBe(false);
  await emit('SIGNED_IN', session('b'));
  await emit('SIGNED_IN', session('c'));
  await act(async () => { profileRequests[1].reject(new Error('late failure')); });
  expect(current.loading).toBe(true);
  expect(current.profileMissing).toBe(false);
});

it('ignores a profile response that arrives after unmount', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  await emit('SIGNED_IN', session('a'));
  await act(async () => { root?.unmount(); root = null; });
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  await act(async () => { respond(profileRequests[0]); });
  expect(error).not.toHaveBeenCalled();
});

it('A -> null -> B with A\'s cleanup still running leaves B\'s identity and task intact', async () => {
  await emit('SIGNED_IN', session('a'));
  await act(async () => { await whenHealthSyncSettled(); });
  const clearing = gate('clear');
  await emit('SIGNED_OUT', null);
  await act(async () => { await clearing.reached; });
  await emit('SIGNED_IN', session('b'));
  await act(async () => { clearing.release(); await whenHealthSyncSettled(); });
  expect(userStore()).toEqual({ id: 'b', registered: true });
});

it('a late A startup cannot persist after logout', async () => {
  const restoring = gate('restore');
  await emit('SIGNED_IN', session('a'));
  await act(async () => { await restoring.reached; });
  await emit('SIGNED_OUT', null);
  await act(async () => { restoring.release(); await whenHealthSyncSettled(); });
  expect(persistUserId).not.toHaveBeenCalled();
  expect(userStore()).toEqual({ id: null, registered: false });
});

it('collapses rapid account changes to the latest owner', async () => {
  const restoring = gate('restore');
  await emit('SIGNED_IN', session('a'));
  await act(async () => { await restoring.reached; });
  await emit('SIGNED_IN', session('b'));
  await emit('SIGNED_OUT', null);
  await emit('SIGNED_IN', session('c'));
  await act(async () => { restoring.release(); await whenHealthSyncSettled(); });
  expect(userStore()).toEqual({ id: 'c', registered: true });
  expect(jest.mocked(persistUserId).mock.calls.map(c => c[0])).toEqual(['c']);
});

it('recovers after a failed cleanup on the next sign-out signal', async () => {
  await emit('SIGNED_IN', session('a'));
  await act(async () => { await whenHealthSyncSettled(); });
  const clearing = gate('clear');
  await emit('SIGNED_OUT', null);
  await act(async () => { await clearing.reached; clearing.fail(new Error('Storage unavailable')); await whenHealthSyncSettled(); });
  expect(store.id).toBe('a');
  expect(store.registered).toBe(false);        // the independent unregister still ran
  await emit('SIGNED_OUT', null);
  await act(async () => { await whenHealthSyncSettled(); });
  expect(userStore()).toEqual({ id: null, registered: false });
});

describe('signOut', () => {
  it.each([
    ['a returned error', () => jest.mocked(supabase.auth.signOut).mockResolvedValue({ error: new Error('Offline') } as never)],
    ['a thrown error', () => jest.mocked(supabase.auth.signOut).mockRejectedValue(new Error('Offline'))],
  ])('does not claim logout or tear down a still-signed-in account after %s', async (_n, arrange) => {
    await emit('SIGNED_IN', session('a'));
    await act(async () => { await whenHealthSyncSettled(); });
    arrange();
    let result: Awaited<ReturnType<AuthContextValue['signOut']>> | undefined;
    await act(async () => { result = await current.signOut(); });   // must resolve, never reject
    expect(result?.error).toEqual(expect.objectContaining({ message: 'Offline' }));
    expect(Alert.alert).toHaveBeenCalledWith('Sign out failed', expect.any(String));
    expect(clearUserId).not.toHaveBeenCalled();
    expect(unregisterBackgroundSync).not.toHaveBeenCalled();
    expect(teardownHealthKit).not.toHaveBeenCalled();
    expect(userStore()).toEqual({ id: 'a', registered: true });
    expect(current.userId).toBe('a');
  });

  it('settles the serialized cleanup before resolving, and B logging in meanwhile is not erased', async () => {
    await emit('SIGNED_IN', session('a'));
    await act(async () => { await whenHealthSyncSettled(); });
    const clearing = gate('clear');
    jest.mocked(supabase.auth.signOut).mockImplementation((async () => {
      authCallback('SIGNED_OUT', null);        // auth-js notifies subscribers before resolving
      return { error: null };
    }) as never);
    let done = false;
    let signingOut!: Promise<unknown>;
    await act(async () => {
      signingOut = current.signOut().then(() => { done = true; });
      await clearing.reached;
    });
    expect(done).toBe(false);                  // waiting on the queue, not racing a second cleanup
    await emit('SIGNED_IN', session('b'));
    await act(async () => { clearing.release(); await signingOut; });
    expect(done).toBe(true);
    expect(userStore()).toEqual({ id: 'b', registered: true });
    expect(clearUserId).toHaveBeenCalledTimes(1);   // no late independent cleanup
  });
});

it('keeps password recovery behavior and does not start health sync for it', async () => {
  await emit('PASSWORD_RECOVERY', session('a'));
  expect(current.needsPasswordReset).toBe(true);
  expect(current.loading).toBe(false);
  expect(current.session).toBeNull();
  await act(async () => { await whenHealthSyncSettled(); });
  expect(persistUserId).not.toHaveBeenCalled();
  await emit('USER_UPDATED', session('a'));
  expect(current.needsPasswordReset).toBe(false);
});

describe('password recovery identity handling', () => {
  it('invalidates a different signed-in account: userId, profile, in-flight response and health state', async () => {
    await emit('SIGNED_IN', session('a'));
    const old = profileRequests[0];
    await act(async () => { await whenHealthSyncSettled(); });
    expect(userStore()).toEqual({ id: 'a', registered: true });
    let returned: unknown = 'unset';
    await act(async () => { returned = authCallback('PASSWORD_RECOVERY', session('b')); });
    expect(returned).toBeUndefined();                 // callback stays synchronous
    await act(async () => { respond(old); await whenHealthSyncSettled(); });
    expect(current.needsPasswordReset).toBe(true);    // reset UI preserved
    expect(current.userId).not.toBe('a');
    expect(current.profile?.id).not.toBe('a');
    expect(current.loading).toBe(false);
    expect(userStore()).toEqual({ id: null, registered: false });
    expect(persistUserId).not.toHaveBeenCalledWith('b');   // recovery session is not a health owner
  });

  it('leaves the same signed-in user untouched during recovery', async () => {
    await emit('SIGNED_IN', session('a'));
    await act(async () => { respond(profileRequests[0]); await whenHealthSyncSettled(); });
    await emit('PASSWORD_RECOVERY', session('a'));
    await act(async () => { await whenHealthSyncSettled(); });
    expect(current.needsPasswordReset).toBe(true);
    expect(current.userId).toBe('a');
    expect(current.profile?.id).toBe('a');
    expect(userStore()).toEqual({ id: 'a', registered: true });
  });

  it('recovery state does not survive a logout', async () => {
    await emit('PASSWORD_RECOVERY', session('b'));
    expect(current.needsPasswordReset).toBe(true);
    await emit('SIGNED_OUT', null);
    expect(current.needsPasswordReset).toBe(false);
  });

  it('recovery state does not survive an unrelated new account, but survives events for the recovering user', async () => {
    await emit('PASSWORD_RECOVERY', session('b'));
    await emit('TOKEN_REFRESHED', session('b'));
    expect(current.needsPasswordReset).toBe(true);
    await emit('SIGNED_IN', session('c'));
    expect(current.needsPasswordReset).toBe(false);
    await act(async () => { await whenHealthSyncSettled(); });
    expect(userStore()).toEqual({ id: 'c', registered: true });
  });

  it('USER_UPDATED completes the recovery and adopts the account', async () => {
    await emit('PASSWORD_RECOVERY', session('b'));
    await emit('USER_UPDATED', session('b'));
    expect(current.needsPasswordReset).toBe(false);
    expect(current.userId).toBe('b');
    await act(async () => { await whenHealthSyncSettled(); });
    expect(userStore()).toEqual({ id: 'b', registered: true });
  });
});
