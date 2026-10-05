import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { supabase } from '../src/lib/supabase';
import { pollHealthConnect } from '../src/lib/healthConnect';
import { getHealthConnectBackgroundState } from '../src/lib/healthConnectBackground';
import {
  BACKGROUND_SYNC_TASK, registerBackgroundSync, restoreAndroidBackgroundSync, unregisterBackgroundSync,
} from '../src/lib/backgroundSync';
import { hasActiveHealthConnectConnection } from '../src/lib/healthConnectionConsent';

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
jest.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(), refreshSession: jest.fn() }, from: jest.fn(),
} }));
jest.mock('../src/lib/healthConnect', () => ({ pollHealthConnect: jest.fn() }));
jest.mock('../src/lib/healthConnectBackground', () => ({ getHealthConnectBackgroundState: jest.fn() }));
jest.mock('../src/lib/healthConnectionConsent', () => ({ hasActiveHealthConnectConnection: jest.fn() }));
jest.mock('../src/lib/healthKit', () => ({ syncRecentWorkouts: jest.fn(), syncTodaySteps: jest.fn() }));

const task = jest.mocked(TaskManager.defineTask).mock.calls[0][1];
const run = () => task({
  data: {}, error: null,
  executionInfo: { eventId: 'synthetic-event', taskName: BACKGROUND_SYNC_TASK, appState: 'background' },
});
const auth = supabase.auth as unknown as { getSession: jest.Mock; refreshSession: jest.Mock };
const writeStatus = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(hasActiveHealthConnectConnection).mockResolvedValue(true);
  jest.mocked(getHealthConnectBackgroundState).mockResolvedValue('granted');
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('user-a');
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-a' } } }, error: null });
  jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 0, ranWithPermissions: true, completed: true });
  writeStatus.mockResolvedValue({ data: [{ provider: 'health_connect' }], error: null });
  const query = { eq: jest.fn(), select: writeStatus };
  query.eq.mockReturnValue(query);
  (supabase.from as jest.Mock).mockReturnValue({
    update: jest.fn().mockReturnValue(query),
  });
});

it('does not restore identity, register or poll after an in-app disconnect', async () => {
  jest.mocked(hasActiveHealthConnectConnection).mockResolvedValue(false);
  await expect(restoreAndroidBackgroundSync('user-a')).resolves.toBe(false);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await expect(registerBackgroundSync()).resolves.toBe(false);
  expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  await expect(run()).resolves.toBe(1);
  expect(pollHealthConnect).not.toHaveBeenCalled();
  expect(writeStatus).not.toHaveBeenCalled();
});

it('fails closed on a connection lookup failure', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    jest.mocked(hasActiveHealthConnectConnection).mockRejectedValue(new Error('Offline'));
    await expect(restoreAndroidBackgroundSync('user-a')).resolves.toBe(false);
    await expect(run()).resolves.toBe(3);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(pollHealthConnect).not.toHaveBeenCalled();
  } finally { warning.mockRestore(); }
});

it('restores an active account connection without requesting permissions', async () => {
  jest.mocked(BackgroundFetch.getStatusAsync).mockResolvedValue(BackgroundFetch.BackgroundFetchStatus.Available);
  jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
  await expect(restoreAndroidBackgroundSync('user-a')).resolves.toBe(true);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('streakwar_user_id', 'user-a');
  expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledTimes(1);
});

it.each(['unsupported', 'unavailable', 'permission_required', 'foreground_permission_required', 'error'] as const)(
  'does not register or read health data without background readiness: %s', async state => {
    jest.mocked(getHealthConnectBackgroundState).mockResolvedValue(state);
    await expect(registerBackgroundSync()).resolves.toBe(false);
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
    await expect(run()).resolves.toBe(1);
    expect(pollHealthConnect).not.toHaveBeenCalled();
    expect(writeStatus).not.toHaveBeenCalled();
  },
);

it('does not poll or write status when the persisted account differs from the session', async () => {
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-b' } } }, error: null });
  await expect(run()).resolves.toBe(3);
  expect(pollHealthConnect).not.toHaveBeenCalled();
  expect(supabase.from).not.toHaveBeenCalled();
});

it('checks account identity after session refresh too', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.refreshSession.mockResolvedValue({ data: { session: { user: { id: 'user-b' } } }, error: null });
  await expect(run()).resolves.toBe(3);
  expect(pollHealthConnect).not.toHaveBeenCalled();
});

it.each(['getSession', 'refreshSession'] as const)('rejects an auth error from %s', async method => {
  if (method === 'refreshSession') auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth[method].mockResolvedValue({ data: { session: { user: { id: 'user-a' } } }, error: { message: 'Invalid session' } });
  await expect(run()).resolves.toBe(3);
  expect(pollHealthConnect).not.toHaveBeenCalled();
  expect(supabase.from).not.toHaveBeenCalled();
});

it('does not record success after a partial import', async () => {
  jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 1, ranWithPermissions: true, completed: false });
  await expect(run()).resolves.toBe(3);
  expect(supabase.from).not.toHaveBeenCalled();
});

it('does not record success for a skipped poll', async () => {
  jest.mocked(pollHealthConnect).mockResolvedValue({ synced: 0, ranWithPermissions: false, completed: false });
  await expect(run()).resolves.toBe(1);
  expect(supabase.from).not.toHaveBeenCalled();
});

it('records a successful empty poll without claiming new data', async () => {
  await expect(run()).resolves.toBe(1);
  expect(writeStatus).toHaveBeenCalledTimes(1);
});

it('reports failure when last-success persistence fails', async () => {
  writeStatus.mockResolvedValue({ error: { message: 'Offline' } });
  await expect(run()).resolves.toBe(3);
});

it.each([null, []])('does not claim success for a zero-row status update: %j', async data => {
  writeStatus.mockResolvedValue({ data, error: null });
  await expect(run()).resolves.toBe(3);
});

it('does not persist success if the account changes while the poll runs', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    jest.mocked(pollHealthConnect).mockImplementationOnce(async () => {
      auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-b' } } }, error: null });
      return { synced: 1, completed: true, ranWithPermissions: true };
    });
    await expect(run()).resolves.toBe(3);
    expect(supabase.from).not.toHaveBeenCalled();
  } finally {
    warning.mockRestore();
  }
});

describe('stale-owner guards used by the lifecycle coordinator', () => {
  const available = () => {
    jest.mocked(BackgroundFetch.getStatusAsync).mockResolvedValue(BackgroundFetch.BackgroundFetchStatus.Available);
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
  };

  it('does not register when the owner becomes stale during the final async check', async () => {
    available();
    let current = true;
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockImplementationOnce(async () => { current = false; return false; });
    await expect(registerBackgroundSync(() => current)).resolves.toBe(false);
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('does not touch the system when already stale at entry', async () => {
    available();
    await expect(registerBackgroundSync(() => false)).resolves.toBe(false);
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('does not persist identity or register if the owner changes while checking consent', async () => {
    available();
    let current = true;
    jest.mocked(hasActiveHealthConnectConnection).mockImplementationOnce(async () => { current = false; return true; });
    await expect(restoreAndroidBackgroundSync('user-a', () => current)).resolves.toBe(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('keeps the default behavior for callers without a guard', async () => {
    available();
    await expect(restoreAndroidBackgroundSync('user-a')).resolves.toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('streakwar_user_id', 'user-a');
  });

  it('reports unregister success and failure without throwing', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
      await expect(unregisterBackgroundSync()).resolves.toBe(true);
      expect(BackgroundFetch.unregisterTaskAsync).toHaveBeenCalledTimes(1);
      jest.mocked(BackgroundFetch.unregisterTaskAsync).mockRejectedValueOnce(new Error('Busy'));
      await expect(unregisterBackgroundSync()).resolves.toBe(false);
    } finally { warning.mockRestore(); }
  });
});

it('registers a missing background task with the existing scheduling options', async () => {
  jest.mocked(BackgroundFetch.getStatusAsync).mockResolvedValue(BackgroundFetch.BackgroundFetchStatus.Available);
  jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
  await expect(registerBackgroundSync()).resolves.toBe(true);
  expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(BACKGROUND_SYNC_TASK, {
    minimumInterval: 900, stopOnTerminate: false, startOnBoot: true,
  });
});

it('does not register a second copy of an existing task', async () => {
  jest.mocked(BackgroundFetch.getStatusAsync).mockResolvedValue(BackgroundFetch.BackgroundFetchStatus.Available);
  jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);
  await expect(registerBackgroundSync()).resolves.toBe(true);
  expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
});

it('rechecks permission at task time after successful registration', async () => {
  jest.mocked(BackgroundFetch.getStatusAsync).mockResolvedValue(BackgroundFetch.BackgroundFetchStatus.Available);
  jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
  await expect(registerBackgroundSync()).resolves.toBe(true);
  jest.mocked(getHealthConnectBackgroundState).mockResolvedValue('permission_required');
  await expect(run()).resolves.toBe(1);
  expect(pollHealthConnect).not.toHaveBeenCalled();
  expect(writeStatus).not.toHaveBeenCalled();
});

it.each([BackgroundFetch.BackgroundFetchStatus.Denied, BackgroundFetch.BackgroundFetchStatus.Restricted])(
  'does not register when background fetch is unavailable (%s)', async status => {
    jest.mocked(BackgroundFetch.getStatusAsync).mockResolvedValue(status);
    await expect(registerBackgroundSync()).resolves.toBe(false);
    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  },
);

it('reports registration errors without throwing into foreground connection', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    jest.mocked(BackgroundFetch.getStatusAsync).mockResolvedValue(BackgroundFetch.BackgroundFetchStatus.Available);
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);
    jest.mocked(BackgroundFetch.registerTaskAsync).mockRejectedValue(new Error('Unavailable'));
    await expect(registerBackgroundSync()).resolves.toBe(false);
  } finally {
    warning.mockRestore();
  }
});
