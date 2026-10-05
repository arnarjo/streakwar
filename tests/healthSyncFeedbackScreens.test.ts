import { act, createElement, type ReactElement } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../src/lib/supabase';
import ConnectDevicesScreen from '../src/screens/ConnectDevicesScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import { useHealthSync } from '../src/hooks/useHealthSync';
import {
  HealthSyncIncompleteError, STALE_SYNC_ALERT, STALE_SYNC_ROW, formatSyncError, formatSyncSuccess,
} from '../src/lib/healthSyncFeedback';

// Real screens and real shared formatter; only hooks, navigation and RN primitives are faked.
jest.mock('react-native', () => {
  const { createElement: h } = jest.requireActual('react');
  const host = (name: string) => ({ children, ...props }: { children?: unknown }) => h(name, props, children);
  return {
    Platform: { OS: 'android' },
    Alert: { alert: jest.fn() },
    Linking: { openSettings: jest.fn() },
    AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    View: host('View'), Text: host('Text'), ScrollView: host('ScrollView'), TouchableOpacity: host('TouchableOpacity'),
    ActivityIndicator: host('ActivityIndicator'), StatusBar: host('StatusBar'), RefreshControl: host('RefreshControl'),
    Switch: host('Switch'),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { createElement: h } = jest.requireActual('react');
  return { SafeAreaView: ({ children }: { children?: unknown }) => h('SafeAreaView', null, children) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }) }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) },
}));
jest.mock('../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../src/lib/healthConnect', () => ({ openHealthConnectPermissions: jest.fn(), getLastHCDebug: jest.fn(() => '') }));
jest.mock('../src/lib/streakNotification', () => ({ scheduleStreakReminder: jest.fn(), cancelStreakReminders: jest.fn() }));
jest.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { id: 'user-a', username: 'tester', full_name: 'Test User', total_points: 0 }, signOut: jest.fn() }),
}));
jest.mock('../src/hooks/useStreaks', () => ({
  useStreaks: () => ({ streak: null, freezeCredits: 0, frozenToday: false, freezeStreak: jest.fn() }),
}));
jest.mock('../src/hooks/useFitnessChallenges', () => ({ useFitnessChallenges: () => ({ myChallenges: [] }) }));
jest.mock('../src/hooks/useAchievements', () => ({ useAchievements: () => ({ achievements: [] }) }));
jest.mock('../src/hooks/usePremium', () => ({
  usePremium: () => ({ isPro: false, offering: null, purchase: jest.fn(), restore: jest.fn() }),
}));
jest.mock('../src/hooks/useLeague', () => ({ useLeague: () => ({ myTier: 'bronze' }) }));
jest.mock('../src/components/UpgradeModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/profile/ActivityHeatmap', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/profile/AchievementsGrid', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/hooks/useHealthSync', () => ({
  useHealthSync: jest.fn(),
  PROVIDER_META: {
    apple_health: { label: 'Apple Health', icon: 'A', platform: 'ios' },
    health_connect: { label: 'Health Connect', icon: 'H', platform: 'android' },
    strava: { label: 'Strava', icon: 'S', platform: 'both' },
    samsung_health: { label: 'Samsung Health', icon: 'M', platform: 'android' },
  },
}));

type Node = { type: unknown; props: Record<string, unknown>; findAll(predicate: (node: Node) => boolean): Node[] };
const renderer = jest.requireActual<{ create(element: ReactElement): { root: Node; unmount(): void } }>('react-test-renderer');
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;

const syncNow = jest.fn();
const hook = (overrides: Record<string, unknown> = {}) => ({
  connections: [{ provider: 'health_connect', is_active: true, last_synced_at: new Date(Date.now() - 3600_000).toISOString() }],
  syncing: false, isConnected: (p: string) => p === 'health_connect', connectNative: jest.fn(),
  confirmHealthConnectConnection: jest.fn(), syncNow, disconnect: jest.fn(), nativeProvider: 'health_connect',
  showBatteryWarning: true, backgroundSyncUnavailable: false, backgroundAccess: 'granted',
  enableBackgroundSync: jest.fn(), permissionNotice: null, refresh: jest.fn(), lastSynced: null, ...overrides,
});

const text = (node: Node): string => node.findAll(n => n.type === 'Text')
  .map(t => ([] as unknown[]).concat(t.props.children as never).flat(Infinity).join('')).join(' | ');
const pressable = (root: Node, label: string): Node => {
  const hit = root.findAll(n => n.type === 'TouchableOpacity' && typeof n.props.onPress === 'function' && text(n).includes(label));
  if (!hit.length) throw new Error(`No pressable with "${label}"`);
  return hit[0];
};
const press = (node: Node) => act(async () => { await (node.props.onPress as () => unknown)(); });

const screens = [
  { name: 'ConnectDevicesScreen', Screen: ConnectDevicesScreen, syncLabel: 'Sync now' },
  { name: 'ProfileScreen', Screen: ProfileScreen, syncLabel: 'Sync' },
] as const;

beforeAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  (Platform as { OS: string }).OS = 'android';
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() } as never);
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  // ProfileScreen stats queries: any chain resolves to an empty, error-free result.
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve({ count: 0, data: [], error: null }),
  };
  for (const method of ['select', 'eq', 'gte']) query[method] = jest.fn(() => query);
  (supabase.from as jest.Mock).mockReturnValue(query);
  jest.mocked(useHealthSync).mockReturnValue(hook() as never);
});

describe.each(screens)('$name uses the shared sync feedback', ({ Screen, syncLabel }) => {
  const mount = async () => {
    let tree!: ReturnType<typeof renderer.create>;
    await act(async () => { tree = renderer.create(createElement(Screen as never)); });
    return tree;
  };

  it.each([0, 1, 4])('success with %i new workouts', async count => {
    syncNow.mockResolvedValue(count);
    const tree = await mount();
    await press(pressable(tree.root, syncLabel));
    const expected = formatSyncSuccess(count);
    expect(Alert.alert).toHaveBeenCalledWith(expected.title, expected.message);
    expect(Alert.alert).not.toHaveBeenCalledWith('Nothing new', expect.anything());
    act(() => { tree.unmount(); });
  });

  it('a typed partial result (exercise ok, Steps permission missing) is shown with its counts', async () => {
    const result = {
      synced: 2, ranWithPermissions: true, completed: false, missingPermissions: ['Steps'] as ('Steps')[],
      exercise: { status: 'ok' as const, written: 2, cursorAdvanced: true },
      steps: { status: 'skipped' as const, written: 0, updated: false },
    };
    syncNow.mockRejectedValue(new HealthSyncIncompleteError(result));
    const tree = await mount();
    await press(pressable(tree.root, syncLabel));
    const expected = formatSyncError(new HealthSyncIncompleteError(result));
    expect(expected.message).toContain('2 new workouts');
    expect(Alert.alert).toHaveBeenCalledWith(expected.title, expected.message);
    act(() => { tree.unmount(); });
  });

  it('a partial exercise failure states the saved count and never claims success', async () => {
    const result = {
      synced: 50, ranWithPermissions: true, completed: false,
      exercise: { status: 'failed' as const, written: 50, cursorAdvanced: false },
      steps: { status: 'ok' as const, written: 0, updated: false },
    };
    syncNow.mockRejectedValue(new HealthSyncIncompleteError(result));
    const tree = await mount();
    await press(pressable(tree.root, syncLabel));
    expect(Alert.alert).toHaveBeenCalledWith('Sync incomplete', '50 workouts were saved before a problem occurred. Please retry to import the rest.');
    act(() => { tree.unmount(); });
  });

  it('an unknown error shows only the generic guidance, never its text', async () => {
    syncNow.mockRejectedValue(new Error('permission denied for table workout_posts'));
    const tree = await mount();
    await press(pressable(tree.root, syncLabel));
    const expected = formatSyncError(new Error('x'));
    expect(Alert.alert).toHaveBeenCalledWith(expected.title, expected.message);
    expect(JSON.stringify(jest.mocked(Alert.alert).mock.calls)).not.toContain('workout_posts');
    act(() => { tree.unmount(); });
  });

  it('the stale row and alert use the shared wording and do not blame battery optimization', async () => {
    const tree = await mount();
    const row = pressable(tree.root, STALE_SYNC_ROW.title);
    expect(text(row)).toContain(STALE_SYNC_ROW.subtitle);
    await press(row);
    const [title, message] = jest.mocked(Alert.alert).mock.calls[0];
    expect([title, message]).toEqual([STALE_SYNC_ALERT.title, STALE_SYNC_ALERT.message]);
    expect(JSON.stringify(jest.mocked(Alert.alert).mock.calls)).not.toMatch(/battery/i);
    act(() => { tree.unmount(); });
  });

  it('labels the Android native timestamp as a full sync', async () => {
    jest.mocked(useHealthSync).mockReturnValue(hook({ lastSynced: new Date(2026, 9, 5, 10, 30) }) as never);
    const tree = await mount();
    const all = text(tree.root);
    expect(all).toContain('Last full sync');
    expect(all).not.toMatch(/Last synced/);
    act(() => { tree.unmount(); });
  });
});

describe('timestamp labels are per provider', () => {
  it('Connect Devices does not relabel other providers or iOS', async () => {
    jest.mocked(useHealthSync).mockReturnValue(hook({
      connections: [
        { provider: 'strava', is_active: true, last_synced_at: new Date(Date.now() - 7200_000).toISOString() },
      ],
      isConnected: (p: string) => p === 'strava',
    }) as never);
    let tree!: ReturnType<typeof renderer.create>;
    await act(async () => { tree = renderer.create(createElement(ConnectDevicesScreen as never)); });
    expect(text(tree.root)).toMatch(/Last synced/);
    expect(text(tree.root)).not.toMatch(/Last full sync/);
    act(() => { tree.unmount(); });

    (Platform as { OS: string }).OS = 'ios';
    jest.mocked(useHealthSync).mockReturnValue(hook({
      nativeProvider: 'apple_health',
      connections: [{ provider: 'apple_health', is_active: true, last_synced_at: new Date(Date.now() - 7200_000).toISOString() }],
      isConnected: (p: string) => p === 'apple_health',
    }) as never);
    await act(async () => { tree = renderer.create(createElement(ConnectDevicesScreen as never)); });
    expect(text(tree.root)).toMatch(/Last synced/);
    expect(text(tree.root)).not.toMatch(/Last full sync/);
    act(() => { tree.unmount(); });
  });
});
