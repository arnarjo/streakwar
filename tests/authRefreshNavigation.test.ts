import { act, createElement, useEffect, type ReactElement } from 'react';
import { AuthProvider, useAuth, type AuthContextValue } from '../src/contexts/AuthContext';
import { supabase } from '../src/lib/supabase';
import { cancelStreakReminders } from '../src/lib/streakNotification';
import { __resetHealthSyncLifecycleForTests, whenHealthSyncSettled } from '../src/lib/healthSyncLifecycle';

// C02-R2 F3: same-identity auth events must not unmount the authenticated tree.
// Real AuthProvider; a real consumer gated exactly like RootNavigator (loading / reset / session+profile)
// whose children count mounts and unmounts.
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Alert: { alert: jest.fn() } }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'streakwar://') }));
jest.mock('../src/hooks/usePremium', () => ({ configurePurchases: jest.fn(), logOutPurchases: jest.fn() }));
jest.mock('../src/lib/streakNotification', () => ({ cancelStreakReminders: jest.fn() }));
jest.mock('../src/lib/healthKit', () => ({ teardownHealthKit: jest.fn(), initHealthKit: jest.fn() }));
jest.mock('../src/lib/backgroundSync', () => ({
  persistUserId: jest.fn(async () => undefined), clearUserId: jest.fn(async () => undefined),
  registerBackgroundSync: jest.fn(async () => true), restoreAndroidBackgroundSync: jest.fn(async () => true),
  unregisterBackgroundSync: jest.fn(async () => true),
}));
jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn(), signOut: jest.fn(), getSession: jest.fn() }, from: jest.fn() },
}));

const renderer = jest.requireActual<{ create(element: ReactElement): { unmount(): void } }>('react-test-renderer');
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;

type Callback = (event: string, session: unknown) => unknown;
let authCallback: Callback;
let current: AuthContextValue;
let root: ReturnType<typeof renderer.create> | null;
const loadingSeen: boolean[] = [];
const mounts: Record<string, number> = {};
const unmounts: Record<string, number> = {};

type ProfileRequest = { id: string; resolve(value: unknown): void; reject(error: unknown): void };
let profileRequests: ProfileRequest[] = [];
const respond = (request: ProfileRequest, username = `user-${request.id}`) =>
  request.resolve({ data: { id: request.id, username }, error: null });
const session = (id: string, token = 'token-1') => ({ user: { id }, access_token: token });
const emit = (event: string, value: unknown) => act(async () => { authCallback(event, value); });
const settle = (action: () => void) => act(async () => { action(); });

function Counted({ name }: { name: string }) {
  useEffect(() => {
    mounts[name] = (mounts[name] ?? 0) + 1;
    return () => { unmounts[name] = (unmounts[name] ?? 0) + 1; };
  }, [name]);
  return null;
}

/** Same decision tree as RootNavigator: blank while loading, reset screen, authenticated iff session && profile. */
function NavigationGate() {
  const value = useAuth();
  useEffect(() => { current = value; });
  loadingSeen.push(value.loading);
  if (value.loading) return null;
  if (value.needsPasswordReset) return createElement(Counted, { name: 'reset' });
  return createElement(Counted, { name: value.session && value.profile != null ? 'main' : 'auth' });
}

const mainMounts = () => mounts.main ?? 0;
const mainUnmounts = () => unmounts.main ?? 0;
const mainIsMounted = () => mainMounts() - mainUnmounts() === 1;
const everLoadingAfter = (index: number) => loadingSeen.slice(index).some(Boolean);

/** Signs A in and resolves its profile, leaving the authenticated tree mounted once. */
async function signInResolved(id = 'a') {
  await emit('SIGNED_IN', session(id));
  await settle(() => respond(profileRequests[0]));
  expect(mainIsMounted()).toBe(true);
  expect(current.loading).toBe(false);
}

beforeAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(cancelStreakReminders).mockResolvedValue(undefined as never);
  __resetHealthSyncLifecycleForTests();
  profileRequests = []; loadingSeen.length = 0;
  for (const k of Object.keys(mounts)) delete mounts[k];
  for (const k of Object.keys(unmounts)) delete unmounts[k];
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(((cb: Callback) => {
    authCallback = cb;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }) as never);
  (supabase.from as jest.Mock).mockImplementation(() => ({
    select: () => ({ eq: (_c: string, id: string) => ({
      single: () => new Promise((resolve, reject) => { profileRequests.push({ id, resolve, reject }); }),
    }) }),
  }));
  root = null;
  await act(async () => { root = renderer.create(createElement(AuthProvider, null, createElement(NavigationGate))); });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  await whenHealthSyncSettled();
});

describe.each(['TOKEN_REFRESHED', 'USER_UPDATED', 'SIGNED_IN'] as const)('same-user %s with a resolved profile', event => {
  it('keeps the authenticated tree mounted, never raises loading, and still updates the session', async () => {
    await signInResolved();
    const mark = loadingSeen.length;
    await emit(event, session('a', 'token-2'));
    expect(current.loading).toBe(false);
    expect(everLoadingAfter(mark)).toBe(false);          // no blank frame at any render
    expect(mainMounts()).toBe(1);
    expect(mainUnmounts()).toBe(0);
    expect((current.session as unknown as { access_token: string }).access_token).toBe('token-2');
    expect(current.profile?.id).toBe('a');
    expect(profileRequests).toHaveLength(2);             // a background refresh was requested
    await settle(() => respond(profileRequests[1], 'renamed'));
    expect((current.profile as unknown as { username: string }).username).toBe('renamed');
    expect(everLoadingAfter(mark)).toBe(false);
    expect(mainUnmounts()).toBe(0);
  });
});

it('repeated same-user events in a row never unmount, and only the latest refresh response applies', async () => {
  await signInResolved();
  await emit('TOKEN_REFRESHED', session('a', 'token-2'));
  await emit('TOKEN_REFRESHED', session('a', 'token-3'));
  await settle(() => respond(profileRequests[1], 'stale'));      // superseded refresh
  expect((current.profile as unknown as { username: string }).username).toBe('user-a');
  await settle(() => respond(profileRequests[2], 'latest'));
  expect((current.profile as unknown as { username: string }).username).toBe('latest');
  expect(mainUnmounts()).toBe(0);
});

describe('same-user refresh failures after the profile resolved', () => {
  it.each([
    ['a thrown/network error', (r: ProfileRequest) => r.reject(new Error('Network request failed'))],
    ['a returned transient error', (r: ProfileRequest) => r.resolve({ data: null, error: { code: '57014', message: 'timeout' } })],
  ])('%s keeps the valid current profile and the mounted UI', async (_n, fail) => {
    await signInResolved();
    await emit('TOKEN_REFRESHED', session('a', 'token-2'));
    await settle(() => fail(profileRequests[1]));
    expect(current.profile?.id).toBe('a');
    expect(current.profileMissing).toBe(false);
    expect(current.loading).toBe(false);
    expect(mainUnmounts()).toBe(0);
  });

  it('authoritative absence (PGRST116) is not preserved: the profile clears without a blank frame', async () => {
    await signInResolved();
    const mark = loadingSeen.length;
    await emit('USER_UPDATED', session('a', 'token-2'));
    await settle(() => profileRequests[1].resolve({ data: null, error: { code: 'PGRST116' } }));
    expect(current.profile).toBeNull();
    expect(current.profileMissing).toBe(false);
    expect(current.loading).toBe(false);
    expect(everLoadingAfter(mark)).toBe(false);
    expect(mainUnmounts()).toBe(1);                       // not authenticated any more
  });
});

describe('initial / unresolved profile still blocks', () => {
  it('blocks while the first profile load is pending and mounts the tree once it resolves', async () => {
    await emit('SIGNED_IN', session('a'));
    expect(current.loading).toBe(true);
    expect(mainMounts()).toBe(0);
    await settle(() => respond(profileRequests[0]));
    expect(mainMounts()).toBe(1);
    expect(current.loading).toBe(false);
  });

  it('a same-user event during the pending first load never exposes unresolved UI', async () => {
    await emit('SIGNED_IN', session('a'));
    await emit('TOKEN_REFRESHED', session('a', 'token-2'));
    expect(current.loading).toBe(true);
    expect(mainMounts()).toBe(0);
    await settle(() => respond(profileRequests[0]));                  // superseded response is ignored
    expect(current.loading).toBe(true);
    expect(mainMounts()).toBe(0);
    await settle(() => respond(profileRequests[1]));
    expect(current.loading).toBe(false);
    expect(mainMounts()).toBe(1);
  });

  it('a failed first load does not keep a previous profile and stops blocking', async () => {
    await emit('SIGNED_IN', session('a'));
    await settle(() => profileRequests[0].reject(new Error('Offline')));
    expect(current.profile).toBeNull();
    expect(current.loading).toBe(false);
    expect(mainMounts()).toBe(0);
  });
});

describe('identity changes still block and never keep the old profile', () => {
  it('A -> B: unmounts, clears A at once, blocks until B resolves, ignores A\'s late response', async () => {
    await signInResolved('a');
    await emit('SIGNED_IN', session('b'));
    expect(current.profile).toBeNull();
    expect(current.loading).toBe(true);
    expect(mainUnmounts()).toBe(1);
    await settle(() => respond(profileRequests[0], 'late-a'));
    expect(current.profile).toBeNull();
    await settle(() => respond(profileRequests[1]));
    expect(current.profile?.id).toBe('b');
    expect(mainMounts()).toBe(2);
  });

  it('A -> B -> A: the old A refresh is ignored; the re-entered A blocks until its own load resolves', async () => {
    await signInResolved('a');
    await emit('TOKEN_REFRESHED', session('a', 'token-2'));        // refresh in flight (index 1)
    await emit('SIGNED_IN', session('b'));
    await emit('SIGNED_IN', session('a', 'token-3'));
    expect(current.loading).toBe(true);
    expect(current.profile).toBeNull();
    await settle(() => respond(profileRequests[1], 'stale-a'));
    expect(current.profile).toBeNull();
    await settle(() => respond(profileRequests[3], 'fresh-a'));
    expect((current.profile as unknown as { username: string }).username).toBe('fresh-a');
    expect(current.loading).toBe(false);
  });

  it('sign-out after resolution unmounts without a refresh keeping the profile', async () => {
    await signInResolved('a');
    await emit('SIGNED_OUT', null);
    expect(current.profile).toBeNull();
    expect(current.session).toBeNull();
    expect(current.loading).toBe(false);
    expect(mainUnmounts()).toBe(1);
  });

  it('a refresh in flight when the identity changes is ignored (no profile for the new account)', async () => {
    await signInResolved('a');
    await emit('TOKEN_REFRESHED', session('a', 'token-2'));
    await emit('SIGNED_IN', session('b'));
    await settle(() => respond(profileRequests[1], 'refresh-a'));
    expect(current.profile).toBeNull();
  });

  it('unmount while a refresh is pending ignores its response', async () => {
    await signInResolved('a');
    await emit('TOKEN_REFRESHED', session('a', 'token-2'));
    await act(async () => { root?.unmount(); root = null; });
    await settle(() => respond(profileRequests[1]));
    expect(mainUnmounts()).toBe(1);
  });
});

describe('password recovery is unchanged', () => {
  it('same-user recovery keeps the tree mounted and shows the reset flag; recovery for another user drops the old profile', async () => {
    await signInResolved('a');
    await emit('PASSWORD_RECOVERY', session('a'));
    expect(current.needsPasswordReset).toBe(true);
    expect(current.profile?.id).toBe('a');
    await emit('USER_UPDATED', session('a', 'token-2'));
    expect(current.needsPasswordReset).toBe(false);
    expect(current.loading).toBe(false);
    await emit('PASSWORD_RECOVERY', session('b'));
    expect(current.needsPasswordReset).toBe(true);
    expect(current.userId).toBeNull();
    expect(current.profile).toBeNull();
  });
});

it('keeps the auth callback synchronous for same-user events', async () => {
  await signInResolved();
  let returned: unknown = 'unset';
  await act(async () => { returned = authCallback('TOKEN_REFRESHED', session('a', 'token-2')); });
  expect(returned).toBeUndefined();
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
});
