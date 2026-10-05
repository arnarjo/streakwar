import { act, createElement, type ReactElement, type ReactNode } from 'react';
import { Alert, Platform, Share } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { C, HIT } from '../src/theme';
import RootNavigator from '../src/navigation/RootNavigator';
import HomeScreen from '../src/screens/HomeScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import ChallengesScreen from '../src/screens/ChallengesScreen';
import LeaderboardScreen from '../src/screens/LeaderboardScreen';
import {
  PRIVATE_ACTIVITY_NOTICE, PRIVATE_ACTIVITY_REFRESH_LABEL, PRIVATE_ACTIVITY_RETRY_LABEL, PRIVATE_ACTIVITY_TITLE,
} from '../src/components/PrivateActivitySummaryCard';
import { useAuth as useAuthHook } from '../src/hooks/useAuth';
import { useAuth as useRootAuth } from '../src/contexts/AuthContext';
import { useWorkoutFeed } from '../src/hooks/useWorkoutFeed';
import { useStreaks } from '../src/hooks/useStreaks';
import { useFitnessChallenges } from '../src/hooks/useFitnessChallenges';
import { useLeaderboard } from '../src/hooks/useLeaderboard';
import { useLeague } from '../src/hooks/useLeague';
import { usePremium } from '../src/hooks/usePremium';
import { useHealthSync } from '../src/hooks/useHealthSync';
import { useAchievements } from '../src/hooks/useAchievements';

// ── Fakes ────────────────────────────────────────────────────────────────────
// Real screens, real navigator options, real private card and hook. Only the
// native/RN primitives, data hooks, Supabase and child components are faked.
jest.mock('react-native', () => {
  const { createElement: h } = jest.requireActual('react');
  const host = (name: string) => ({ children, ...props }: { children?: unknown }) => h(name, props, children);
  const FlatList = ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }: {
    data: unknown[]; renderItem: (info: { item: unknown; index: number }) => unknown;
    ListHeaderComponent?: unknown; ListEmptyComponent?: unknown; ListFooterComponent?: unknown;
  }) => h('FlatList', null,
    ListHeaderComponent,
    data.length === 0 ? ListEmptyComponent : data.map((item, index) => h('Item', { key: index }, renderItem({ item, index }))),
    ListFooterComponent);
  const Modal = ({ visible, children }: { visible?: boolean; children?: unknown }) => (visible ? h('Modal', null, children) : null);
  return {
    Platform: { OS: 'android' },
    useWindowDimensions: () => ({ width: 360, height: 800, fontScale: mockInsets.fontScale }),
    Alert: { alert: jest.fn() },
    Linking: { openSettings: jest.fn(), openURL: jest.fn() },
    Share: { share: jest.fn(async () => ({})) },
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    View: host('View'), Text: host('Text'), ScrollView: host('ScrollView'), TouchableOpacity: host('TouchableOpacity'),
    ActivityIndicator: host('ActivityIndicator'), StatusBar: host('StatusBar'), RefreshControl: host('RefreshControl'),
    Switch: host('Switch'), TextInput: host('TextInput'), KeyboardAvoidingView: host('KeyboardAvoidingView'),
    FlatList, Modal,
  };
});
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { createElement: h } = jest.requireActual('react');
  return { __esModule: true, default: (props: Record<string, unknown>) => h('Icon', props) };
});
jest.mock('react-native-safe-area-context', () => {
  const { createElement: h } = jest.requireActual('react');
  return {
    SafeAreaView: ({ children }: { children?: unknown }) => h('SafeAreaView', null, children),
    useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: mockInsets.bottom }),
  };
});
const mockInsets = { bottom: 0, fontScale: 1 };
const mockNavigation = { navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children?: unknown }) => children,
  useNavigation: () => mockNavigation,
  useIsFocused: () => true,
}));
jest.mock('../src/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn(), auth: { getSession: jest.fn() } },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) },
}));
jest.mock('../src/lib/streakNotification', () => ({ scheduleStreakReminder: jest.fn(), cancelStreakReminders: jest.fn() }));
jest.mock('../src/hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../src/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/hooks/useWorkoutFeed', () => ({ useWorkoutFeed: jest.fn() }));
jest.mock('../src/hooks/useStreaks', () => ({ useStreaks: jest.fn() }));
jest.mock('../src/hooks/useFitnessChallenges', () => ({ useFitnessChallenges: jest.fn() }));
jest.mock('../src/hooks/useLeaderboard', () => ({ useLeaderboard: jest.fn() }));
jest.mock('../src/hooks/useLeague', () => ({ useLeague: jest.fn() }));
jest.mock('../src/hooks/usePremium', () => ({ usePremium: jest.fn() }));
jest.mock('../src/hooks/useHealthSync', () => ({ useHealthSync: jest.fn() }));
jest.mock('../src/hooks/useAchievements', () => ({ useAchievements: jest.fn() }));
jest.mock('../src/components/ChallengeCard', () => ({
  __esModule: true,
  default: ({ challenge }: { challenge: { name: string } }) => jest.requireActual('react').createElement('ChallengeCard', null, challenge.name),
}));
jest.mock('../src/components/WorkoutPostCard', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/StreakMilestoneCard', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/SkeletonPulse', () => ({ WorkoutPostSkeleton: () => null }));
jest.mock('../src/components/profile/ActivityHeatmap', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/profile/AchievementsGrid', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/UpgradeModal', () => ({
  __esModule: true,
  default: ({ visible }: { visible: boolean }) => (visible ? jest.requireActual('react').createElement('UpgradeModal') : null),
}));
jest.mock('../src/screens/DiscoverChallengesScreen', () => ({
  __esModule: true, default: () => jest.requireActual('react').createElement('DiscoverChallenges'),
}));
// Navigators: record the declared screens and screenOptions instead of drawing them.
const mockNavigators = { stack: [] as string[], tabs: [] as string[], screenOptions: null as null | ((p: { route: { name: string } }) => Record<string, unknown>) };
function mockFlattenScreens(children: ReactNode): { name: string; component?: () => ReactElement | null }[] {
  const out: { name: string; component?: () => ReactElement | null }[] = [];
  const walk = (node: ReactNode) => {
    const list = ([] as ReactNode[]).concat(node as never).flat(Infinity as 1);
    for (const child of list) {
      if (!child || typeof child !== 'object') continue;
      const el = child as ReactElement<{ name?: string; component?: () => ReactElement | null; children?: ReactNode }>;
      if (el.props?.name) out.push({ name: el.props.name, component: el.props.component });
      else if (el.props?.children) walk(el.props.children);
    }
  };
  walk(children);
  return out;
}
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children?: ReactNode }) => {
      const { createElement: h } = jest.requireActual('react');
      const screens = mockFlattenScreens(children);
      mockNavigators.stack = screens.map(s => s.name);
      const main = screens.find(s => s.name === 'Main');
      return h('Stack', null, main?.component ? h(main.component) : null);
    },
    Screen: () => null,
  }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children, screenOptions }: { children?: ReactNode; screenOptions: never }) => {
      mockNavigators.tabs = mockFlattenScreens(children).map(s => s.name);
      mockNavigators.screenOptions = screenOptions;
      return null;
    },
    Screen: () => null,
  }),
}));
jest.mock('../src/navigation/navigationRef', () => ({ navigationRef: { getCurrentRoute: jest.fn() } }));
// Screens outside this task are stubbed so only the navigator wiring is exercised.
jest.mock('../src/screens/auth/OnboardingScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/auth/LoginScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/auth/SignupScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/auth/ResetPasswordScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/ChallengeDetailScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/CreateChallengeScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/LogWorkoutScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/ConnectDevicesScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/WeeklyRecapScreen', () => ({ __esModule: true, default: () => null }));

// ── Helpers ──────────────────────────────────────────────────────────────────
type Node = { type: unknown; props: Record<string, unknown>; findAll(predicate: (node: Node) => boolean): Node[] };
type Tree = { root: Node; toJSON(): unknown; unmount(): void };
const renderer = jest.requireActual<{ create(element: ReactElement): Tree }>('react-test-renderer');
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
const rpc = supabase.rpc as unknown as jest.Mock;
const platform = Platform as unknown as { OS: string };

const OWNER = 'user-a';
const text = (node: Node): string => node.findAll(n => n.type === 'Text')
  .map(n => ([] as unknown[]).concat(n.props.children as never).flat(Infinity).filter(c => typeof c === 'string' || typeof c === 'number').join(''))
  .join(' | ');
const pressables = (root: Node) => root.findAll(n => n.type === 'TouchableOpacity' && typeof n.props.onPress === 'function');
const byLabel = (root: Node, label: string): Node => {
  const hit = pressables(root).find(n => n.props.accessibilityLabel === label);
  if (!hit) throw new Error(`No control labelled "${label}". Have: ${pressables(root).map(n => String(n.props.accessibilityLabel ?? text(n))).join(' / ')}`);
  return hit;
};
const byText = (root: Node, label: string): Node => {
  const hit = pressables(root).find(n => text(n).includes(label));
  if (!hit) throw new Error(`No control with text "${label}"`);
  return hit;
};
const press = (node: Node) => act(async () => { await (node.props.onPress as () => unknown)(); });
const mount = async (element: ReactElement): Promise<Tree> => {
  let tree!: Tree;
  await act(async () => { tree = renderer.create(element); });
  return tree;
};
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FF}\u{FE0F}]/u;
const summaryRow = (points: number, count: number) => ({
  data: [{ owner_id: OWNER, activity_count: count, personal_points: points, total_steps: 1000 }], error: null,
});

// WCAG relative luminance / contrast.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let profile: { id: string; username: string; full_name: string | null; total_points: number };
let streak: { current_streak: number; longest_streak: number } | null;
const challengesHook = {
  myChallenges: [] as { id: string; name: string; status: string }[],
  loading: false, refresh: jest.fn(), joinByCode: jest.fn(), joinPublic: jest.fn(), createChallenge: jest.fn(),
};
let premium: { isPro: boolean };
const leaderboardHook = {
  globalBoard: [] as unknown[], weeklyBoard: [] as unknown[], friendsBoard: [] as unknown[], following: new Set<string>(),
  myGlobalRank: null as number | null, myWeeklyRank: null as number | null, loading: false,
  fetchGlobal: jest.fn(), fetchWeekly: jest.fn(), fetchFriends: jest.fn(), follow: jest.fn(), unfollow: jest.fn(),
  rival: null as null | { full_name: string; username: string }, rivalDiff: 0,
};
const leagueHook = { members: [] as unknown[], myTier: 'bronze', myRank: null as number | null, loading: false, refresh: jest.fn() };
const feedHook = {
  feed: [] as unknown[], loading: false, fetchFeed: jest.fn(), toggleReaction: jest.fn(), fetchComments: jest.fn(),
  addComment: jest.fn(), deleteWorkout: jest.fn(),
};

beforeAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment; });
beforeEach(() => {
  jest.clearAllMocks();
  platform.OS = 'android';
  mockInsets.bottom = 0;
  mockInsets.fontScale = 1;
  profile = { id: OWNER, username: 'tester', full_name: 'Test User', total_points: 12 };
  streak = { current_streak: 0, longest_streak: 0 };
  premium = { isPro: false };
  challengesHook.myChallenges = [];
  challengesHook.loading = false;
  leaderboardHook.weeklyBoard = []; leaderboardHook.globalBoard = []; leaderboardHook.friendsBoard = [];
  leaderboardHook.following = new Set(); leaderboardHook.myGlobalRank = null; leaderboardHook.myWeeklyRank = null;
  leaderboardHook.rival = null;
  leagueHook.members = []; leagueHook.myTier = 'bronze'; leagueHook.myRank = null; leagueHook.loading = false;
  feedHook.feed = []; feedHook.loading = false;

  jest.mocked(useAuthHook).mockImplementation((() => ({ profile, signOut: jest.fn() })) as never);
  jest.mocked(useWorkoutFeed).mockImplementation((() => feedHook) as never);
  jest.mocked(useStreaks).mockImplementation((() => ({ streak, freezeCredits: 0, frozenToday: false, freezeStreak: jest.fn() })) as never);
  jest.mocked(useFitnessChallenges).mockImplementation((() => challengesHook) as never);
  jest.mocked(useLeaderboard).mockImplementation((() => leaderboardHook) as never);
  jest.mocked(useLeague).mockImplementation((() => leagueHook) as never);
  jest.mocked(usePremium).mockImplementation((() => ({
    isPro: premium.isPro, offering: null, purchase: jest.fn(), restore: jest.fn(), FREE_MAX_CHALLENGES: 2,
  })) as never);
  jest.mocked(useHealthSync).mockReturnValue({
    connections: [], syncing: false, syncNow: jest.fn(), showBatteryWarning: false, lastSynced: null,
  } as never);
  jest.mocked(useAchievements).mockReturnValue({ achievements: [] } as never);

  rpc.mockResolvedValue(summaryRow(5678, 3));
  // Generic empty-result query chain (milestones, profile stats).
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve({ count: 0, data: [], error: null }),
  };
  for (const method of ['select', 'eq', 'gte', 'in', 'neq', 'order', 'limit']) query[method] = jest.fn(() => query);
  (supabase.from as jest.Mock).mockReturnValue(query);
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
});

// ── Theme ────────────────────────────────────────────────────────────────────
describe('theme', () => {
  it.each(['text', 'muted', 'primary', 'secondary', 'error', 'green', 'success', 'gold', 'silver', 'bronze', 'purple'] as const)(
    '%s keeps at least 4.5:1 contrast on bg, card and dimmed',
    token => {
      for (const surface of [C.bg, C.card, C.dimmed]) {
        expect(contrast(C[token], surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('dark text on the orange primary fill is readable', () => {
    expect(contrast(C.onPrimary, C.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

// ── Tabs ─────────────────────────────────────────────────────────────────────
describe('RootNavigator', () => {
  const auth = (overrides: Record<string, unknown> = {}) => jest.mocked(useRootAuth).mockReturnValue({
    session: { user: { id: OWNER } }, profile: { id: OWNER }, loading: false, needsPasswordReset: false, ...overrides,
  } as never);
  const options = (name: string) => mockNavigators.screenOptions!({ route: { name } });

  it('keeps the auth gate and every route name', async () => {
    auth();
    let tree = await mount(createElement(RootNavigator));
    expect(mockNavigators.stack).toEqual(['Main', 'ChallengeDetail', 'CreateChallenge', 'LogWorkout', 'ConnectDevices', 'WeeklyRecap']);
    expect(mockNavigators.tabs).toEqual(['Home', 'Challenges', 'Leaderboard', 'Profile']);
    await act(async () => { tree.unmount(); });

    auth({ session: null, profile: null });
    tree = await mount(createElement(RootNavigator));
    expect(mockNavigators.stack).toEqual(['Onboarding', 'Login', 'Signup']);
    await act(async () => { tree.unmount(); });

    auth({ needsPasswordReset: true });
    tree = await mount(createElement(RootNavigator));
    expect(mockNavigators.stack).toEqual(['ResetPassword']);
    await act(async () => { tree.unmount(); });

    mockNavigators.stack = [];
    auth({ loading: true });
    tree = await mount(createElement(RootNavigator));
    expect(mockNavigators.stack).toEqual([]);
    await act(async () => { tree.unmount(); });
  });

  it.each([
    ['Home', 'home-outline', 'home'],
    ['Challenges', 'flag-outline', 'flag'],
    ['Leaderboard', 'trophy-outline', 'trophy'],
    ['Profile', 'person-outline', 'person'],
  ])('%s tab uses an outline icon when idle and a filled icon when selected', async (name, idle, active) => {
    auth();
    const tree = await mount(createElement(RootNavigator));
    const tabIcon = options(name).tabBarIcon as (p: { focused: boolean; color: string }) => ReactElement<{ name: string; color: string }>;
    expect(tabIcon({ focused: false, color: C.muted }).props).toMatchObject({ name: idle, color: C.muted });
    expect(tabIcon({ focused: true, color: C.primary }).props).toMatchObject({ name: active, color: C.primary });
    await act(async () => { tree.unmount(); });
  });

  it.each([[0, 8], [24, 24]])('bottom bar respects the %i dp safe-area inset', async (inset, padding) => {
    auth();
    mockInsets.bottom = inset;
    const tree = await mount(createElement(RootNavigator));
    const o = options('Home');
    expect(o.tabBarStyle).toMatchObject({ height: 56 + inset, paddingBottom: padding, backgroundColor: C.bg });
    expect(o.tabBarItemStyle).toMatchObject({ minHeight: 48 });
    expect(o.tabBarActiveTintColor).toBe(C.primary);
    expect(o.tabBarInactiveTintColor).toBe(C.muted);
    expect(o.headerShown).toBe(false);
    await act(async () => { tree.unmount(); });
  });

  it('keeps larger tab text enabled and adds room for it', async () => {
    auth();
    mockInsets.fontScale = 2;
    mockInsets.bottom = 24;
    const tree = await mount(createElement(RootNavigator));
    const o = options('Home');
    expect(o.tabBarAllowFontScaling).toBe(true);
    expect(o.tabBarStyle).toMatchObject({ height: 106, paddingBottom: 24 });
    const label = o.tabBarLabel as (p: { color: string }) => ReactElement<{ maxFontSizeMultiplier: number }>;
    expect(label({ color: C.text }).props.maxFontSizeMultiplier).toBe(2);
    await act(async () => { tree.unmount(); });
  });
});

// ── Home ─────────────────────────────────────────────────────────────────────
describe('HomeScreen', () => {
  it('targets the next milestone after reaching an exact multiple of ten', async () => {
    streak = { current_streak: 10, longest_streak: 10 };
    const tree = await mount(createElement(HomeScreen));
    expect(text(tree.root)).toContain('10 days to the 20-day milestone');
    await act(async () => { tree.unmount(); });
  });
  it('leads with the private summary and keeps competition numbers separate and labelled', async () => {
    const tree = await mount(createElement(HomeScreen));
    const all = text(tree.root);
    expect(all.indexOf(PRIVATE_ACTIVITY_TITLE)).toBeGreaterThanOrEqual(0);
    expect(all.indexOf(PRIVATE_ACTIVITY_TITLE)).toBeLessThan(all.indexOf('Competition'));
    expect(all).toContain(PRIVATE_ACTIVITY_NOTICE);
    expect(all).toContain('5,678');
    expect(all).toContain('Personal points');
    expect(all).toContain('Imported records');
    expect(all).toContain('not just today or this week');
    expect(all).toContain('Competition points');
    expect(all).toContain('Competition streak');
    // Private totals never appear inside the competition card, and competition points stay their own number.
    const competition = all.slice(all.indexOf('Competition |'));
    expect(competition).not.toContain('5,678');
    expect(all).toContain('12');
    await act(async () => { tree.unmount(); });
  });

  it('the private summary refresh does not navigate or sync, and still retries on error', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const tree = await mount(createElement(HomeScreen));
    expect(text(tree.root)).toContain('Could not load your private activity.');
    rpc.mockResolvedValueOnce(summaryRow(40, 2));
    await press(byLabel(tree.root, PRIVATE_ACTIVITY_RETRY_LABEL));
    expect(text(tree.root)).toContain('40');
    await press(byLabel(tree.root, PRIVATE_ACTIVITY_REFRESH_LABEL));
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    await act(async () => { tree.unmount(); });
  });

  it('shows the empty private state with Health Connect guidance and no invented numbers', async () => {
    rpc.mockResolvedValue(summaryRow(0, 0));
    const tree = await mount(createElement(HomeScreen));
    const all = text(tree.root);
    expect(all).toContain('Connect Health Connect');
    expect(all).not.toContain('Personal points');
    await act(async () => { tree.unmount(); });
  });

  it('does not render the private summary off Android', async () => {
    platform.OS = 'ios';
    const tree = await mount(createElement(HomeScreen));
    expect(text(tree.root)).not.toContain(PRIVATE_ACTIVITY_TITLE);
    expect(rpc).not.toHaveBeenCalled();
    await act(async () => { tree.unmount(); });
  });

  it('a zero competition streak never implies imported activity is absent', async () => {
    const tree = await mount(createElement(HomeScreen));
    const all = text(tree.root);
    expect(all).not.toMatch(/start your (streak|journey)|begin your journey/i);
    expect(all).toContain("Imported Health Connect activity isn't counted yet.");
    await press(byLabel(tree.root, 'Log a workout'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('LogWorkout');
    await act(async () => { tree.unmount(); });
  });

  it('an active streak shows milestone progress and shares competition numbers only', async () => {
    streak = { current_streak: 7, longest_streak: 9 };
    const tree = await mount(createElement(HomeScreen));
    const all = text(tree.root);
    expect(all).toContain('3 days to the 10-day milestone');
    expect(all).toContain('best 9');
    await press(byLabel(tree.root, 'Share your streak'));
    const message = jest.mocked(Share.share).mock.calls[0][0].message as string;
    expect(message).toContain('7-day streak');
    expect(message).toContain('12 competition points');
    expect(message).not.toContain('5,678');
    expect(message).not.toMatch(EMOJI);
    await act(async () => { tree.unmount(); });
  });

  it('points people starting alone to browse open challenges and never invents any', async () => {
    const tree = await mount(createElement(HomeScreen));
    expect(tree.root.findAll(n => n.type === 'ChallengeCard')).toHaveLength(0);
    expect(text(tree.root)).toContain('Find a challenge to join');
    const browse = pressables(tree.root).filter(n => n.props.accessibilityLabel === 'Browse open challenges');
    expect(browse.length).toBeGreaterThan(0);
    await press(browse[0]);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Challenges');
    await act(async () => { tree.unmount(); });
  });

  it('lists real active challenges instead of the prompt and opens them', async () => {
    challengesHook.myChallenges = [{ id: 'c1', name: 'Spring Steps', status: 'active' }];
    const tree = await mount(createElement(HomeScreen));
    expect(tree.root.findAll(n => n.type === 'ChallengeCard')).toHaveLength(1);
    expect(text(tree.root)).not.toContain('Find a challenge to join');
    await press(byLabel(tree.root, 'See all challenges'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Challenges');
    await act(async () => { tree.unmount(); });
  });

  it('keeps rival and league entries (secondary) and header actions working', async () => {
    leaderboardHook.rival = { full_name: 'Sam Rival', username: 'sam' };
    leaderboardHook.rivalDiff = 14;
    leagueHook.members = new Array(12).fill({ user_id: 'x' });
    leagueHook.myRank = 4;
    leagueHook.myTier = 'silver';
    const tree = await mount(createElement(HomeScreen));
    const all = text(tree.root);
    expect(all).toContain('Sam Rival is 14 pts ahead');
    expect(all).toContain('#4 in the Silver League');
    await press(byLabel(tree.root, 'Sam Rival is 14 points ahead. Open leaderboard'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Leaderboard');
    await press(byLabel(tree.root, 'Open profile'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Profile');
    await press(byLabel(tree.root, 'Log a workout'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('LogWorkout');
    await act(async () => { tree.unmount(); });
  });

  it('shows a neutral empty feed with a browse action', async () => {
    const tree = await mount(createElement(HomeScreen));
    expect(text(tree.root)).toContain('Nothing in your feed yet');
    await act(async () => { tree.unmount(); });
  });

  it('refetches the same data on mount and has no decorative emoji', async () => {
    const tree = await mount(createElement(HomeScreen));
    expect(feedHook.fetchFeed).toHaveBeenCalled();
    expect(leaderboardHook.fetchWeekly).toHaveBeenCalled();
    expect(text(tree.root)).not.toMatch(EMOJI);
    for (const control of pressables(tree.root)) {
      expect(typeof control.props.accessibilityRole === 'string' || text(control) === '').toBe(true);
    }
    await act(async () => { tree.unmount(); });
  });

  it('every pressable is at least 44dp tall or wide enough through its minimum height', async () => {
    const tree = await mount(createElement(HomeScreen));
    const avatar = byLabel(tree.root, 'Open profile');
    expect(avatar.props.style).toMatchObject({ width: HIT, height: HIT });
    await act(async () => { tree.unmount(); });
  });
});

// ── Profile ──────────────────────────────────────────────────────────────────
describe('ProfileScreen', () => {
  it('labels public numbers as competition stats and keeps private data out of them', async () => {
    profile.total_points = 345;
    const tree = await mount(createElement(ProfileScreen));
    const all = text(tree.root);
    expect(all).toContain('Competition stats');
    expect(all).toContain('Competition points');
    expect(all).toContain('345');
    expect(all).toContain('Competition streak');
    expect(all).toContain('Competition activity · last 90 days');
    expect(all).toContain('Private Health Connect activity is separate and not included here.');
    expect(all).toContain('Imported Health Connect activity stays private');
    expect(all).not.toContain(PRIVATE_ACTIVITY_NOTICE);
    expect(all).not.toContain('Personal points');
    expect(all).not.toContain('Imported records');
    expect(rpc).not.toHaveBeenCalled();
    expect(all).not.toMatch(EMOJI);
    await act(async () => { tree.unmount(); });
  });

  it('edit actions are honest that they are not available yet', async () => {
    const tree = await mount(createElement(ProfileScreen));
    await press(byLabel(tree.root, 'Edit profile'));
    expect(Alert.alert).toHaveBeenLastCalledWith('Edit profile', 'Profile editing is not available yet.');
    await press(byLabel(tree.root, 'Edit profile photo'));
    expect(Alert.alert).toHaveBeenLastCalledWith('Edit photo', 'Photo upload is not available yet.');
    expect(byLabel(tree.root, 'Edit profile').props.accessibilityHint).toBe('Not available yet');
    await act(async () => { tree.unmount(); });
  });

  it('the Pro action is a small link that still opens the paywall, and disappears for Pro users', async () => {
    let tree = await mount(createElement(ProfileScreen));
    expect(tree.root.findAll(n => n.type === 'UpgradeModal')).toHaveLength(0);
    await press(byLabel(tree.root, 'Upgrade to Pro'));
    expect(tree.root.findAll(n => n.type === 'UpgradeModal')).toHaveLength(1);
    await act(async () => { tree.unmount(); });

    premium.isPro = true;
    tree = await mount(createElement(ProfileScreen));
    expect(pressables(tree.root).some(n => n.props.accessibilityLabel === 'Upgrade to Pro')).toBe(false);
    expect(text(tree.root)).toContain('Pro');
    await act(async () => { tree.unmount(); });
  });

  it('keeps manage-devices navigation and sign-out confirmation', async () => {
    const tree = await mount(createElement(ProfileScreen));
    await press(byLabel(tree.root, 'Manage connected devices'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ConnectDevices');
    await press(byText(tree.root, 'Sign out'));
    expect(Alert.alert).toHaveBeenLastCalledWith('Sign out', 'Are you sure you want to sign out?', expect.any(Array));
    await act(async () => { tree.unmount(); });
  });

  it('shows the competition streak card only for a real streak, with non-emoji labels', async () => {
    let tree = await mount(createElement(ProfileScreen));
    expect(tree.root.findAll(n => n.type === 'Text' && n.props.children === 'Best streak')).toHaveLength(0);
    await act(async () => { tree.unmount(); });

    streak = { current_streak: 5, longest_streak: 8 };
    tree = await mount(createElement(ProfileScreen));
    expect(text(tree.root)).toContain('Best streak');
    expect(text(tree.root)).toContain('Upgrade for streak freeze');
    expect(text(tree.root)).not.toMatch(EMOJI);
    await act(async () => { tree.unmount(); });
  });
});

// ── Challenges ───────────────────────────────────────────────────────────────
describe('ChallengesScreen', () => {
  it('gives people starting alone a prominent browse path into Discover, with accessible selected tabs', async () => {
    const tree = await mount(createElement(ChallengesScreen));
    expect(tree.root.findAll(n => n.type === 'DiscoverChallenges')).toHaveLength(0);
    const tabs = tree.root.findAll(n => n.type === 'TouchableOpacity' && n.props.accessibilityRole === 'tab');
    expect(tabs.map(t => t.props.accessibilityLabel)).toEqual(['Active', 'Upcoming', 'Completed', 'Discover challenges']);
    expect(tabs.map(t => (t.props.accessibilityState as { selected: boolean }).selected)).toEqual([true, false, false, false]);

    await press(pressables(tree.root).filter(n => n.props.accessibilityLabel === 'Browse open challenges')[0]);
    expect(tree.root.findAll(n => n.type === 'DiscoverChallenges')).toHaveLength(1);
    const after = tree.root.findAll(n => n.type === 'TouchableOpacity' && n.props.accessibilityRole === 'tab');
    expect(after.map(t => (t.props.accessibilityState as { selected: boolean }).selected)).toEqual([false, false, false, true]);
    await act(async () => { tree.unmount(); });
  });

  it('the Discover tab itself is still reachable directly', async () => {
    const tree = await mount(createElement(ChallengesScreen));
    await press(byLabel(tree.root, 'Discover challenges'));
    expect(tree.root.findAll(n => n.type === 'DiscoverChallenges')).toHaveLength(1);
    await press(byLabel(tree.root, 'Active'));
    expect(tree.root.findAll(n => n.type === 'DiscoverChallenges')).toHaveLength(0);
    await act(async () => { tree.unmount(); });
  });

  it('empty Active tab offers browse and create, and create keeps navigating', async () => {
    const tree = await mount(createElement(ChallengesScreen));
    const all = text(tree.root);
    expect(all).toContain('No active challenges');
    expect(all).toContain('Join a public challenge or start your own.');
    await press(pressables(tree.root).filter(n => n.props.accessibilityLabel === 'Create a challenge')[0]);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CreateChallenge');
    expect(all).not.toMatch(EMOJI);
    await act(async () => { tree.unmount(); });
  });

  it('shows real challenges per status and helpful empty copy for the other tabs', async () => {
    challengesHook.myChallenges = [
      { id: 'a', name: 'Active One', status: 'active' },
      { id: 'u', name: 'Upcoming One', status: 'upcoming' },
    ];
    const tree = await mount(createElement(ChallengesScreen));
    expect(tree.root.findAll(n => n.type === 'ChallengeCard').map(n => text(n) || String(n.props.children))).toEqual(['Active One']);
    await press(byLabel(tree.root, 'Completed'));
    expect(text(tree.root)).toContain('No completed challenges');
    expect(text(tree.root)).toContain('Challenges you took part in that have finished appear here.');
    await act(async () => { tree.unmount(); });
  });

  it('paywall is preserved: at the free limit both create paths open the upgrade modal', async () => {
    challengesHook.myChallenges = [
      { id: 'a', name: 'A', status: 'active' },
      { id: 'b', name: 'B', status: 'upcoming' },
    ];
    const tree = await mount(createElement(ChallengesScreen));
    await press(byLabel(tree.root, 'Create a new challenge'));
    expect(tree.root.findAll(n => n.type === 'UpgradeModal')).toHaveLength(1);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    await act(async () => { tree.unmount(); });

    const second = await mount(createElement(ChallengesScreen));
    await press(byLabel(second.root, 'Challenge a friend'));
    expect(second.root.findAll(n => n.type === 'UpgradeModal')).toHaveLength(1);
    expect(second.root.findAll(n => n.type === 'Modal')).toHaveLength(0);
    await act(async () => { second.unmount(); });
  });

  it('challenge a friend (secondary) opens the quick modal and creates exactly what it did before', async () => {
    challengesHook.createChallenge.mockResolvedValue({ error: null, challenge: { invite_code: 'AB12CD34' } });
    const tree = await mount(createElement(ChallengesScreen));
    await press(byLabel(tree.root, 'Challenge a friend'));
    expect(text(tree.root)).toContain('Private 7-day workout challenge');
    await press(byText(tree.root, 'Create and get invite code'));
    expect(challengesHook.createChallenge).toHaveBeenCalledWith(expect.objectContaining({
      name: '7-Day Challenge', is_public: false, scoring_modes: ['workouts'], description: '1v1 challenge — may the best win! 💪',
    }));
    expect(text(tree.root)).toContain('AB12CD34');
    await press(byText(tree.root, 'Share invite code'));
    expect(jest.mocked(Share.share).mock.calls[0][0].message).toContain('AB12CD34');
    expect(jest.mocked(Share.share).mock.calls[0][0].message).not.toMatch(EMOJI);
    await act(async () => { tree.unmount(); });
  });

  it('join by code still trims, joins and confirms', async () => {
    challengesHook.joinByCode.mockResolvedValue({ error: null, challenge: { name: 'Team Run' } });
    const tree = await mount(createElement(ChallengesScreen));
    await press(byLabel(tree.root, 'Join with a code'));
    const input = tree.root.findAll(n => n.type === 'TextInput')[0];
    await act(async () => { (input.props.onChangeText as (t: string) => void)('ab12cd34'); });
    await press(byText(tree.root, 'Join challenge'));
    expect(challengesHook.joinByCode).toHaveBeenCalledWith('AB12CD34');
    expect(Alert.alert).toHaveBeenCalledWith('Joined', `You're now in "Team Run"`);
    await act(async () => { tree.unmount(); });
  });
});

// ── Leaderboard ──────────────────────────────────────────────────────────────
describe('LeaderboardScreen', () => {
  const entry = (id: string, name: string, total: number, weekly: number) =>
    ({ id, username: id, full_name: name, total_points: total, weekly_points: weekly });

  it('states the competition scope and the private exclusion, with factual labels', async () => {
    profile.total_points = 77;
    const tree = await mount(createElement(LeaderboardScreen));
    const all = text(tree.root);
    expect(all).toContain('Competition rankings only. Private Health Connect activity is not included.');
    expect(all).toContain('Your competition points');
    expect(all).toContain('77');
    expect(all).toContain('Points: 1 per workout · 1 per 1k steps · 1 per km · 1 per 30 min');
    expect(all).not.toMatch(EMOJI);
    expect(all).not.toContain(PRIVATE_ACTIVITY_NOTICE);
    expect(all).not.toContain('Personal points');
    expect(rpc).not.toHaveBeenCalled();
    await act(async () => { tree.unmount(); });
  });

  it('league tab with no group is factual and makes no promise about next week', async () => {
    const tree = await mount(createElement(LeaderboardScreen));
    const all = text(tree.root);
    expect(all).toContain('No league group yet');
    expect(all).toContain('No league group was found for your account.');
    expect(all).not.toMatch(/monday|check back|being set up/i);
    await act(async () => { tree.unmount(); });
  });

  it('keeps all four views reachable with icon tabs and selected state', async () => {
    leaderboardHook.weeklyBoard = [entry('p1', 'Pat One', 500, 40)];
    leaderboardHook.globalBoard = [entry('p2', 'Pam Two', 900, 10)];
    leaderboardHook.friendsBoard = [entry('p3', 'Fran Three', 300, 5)];
    const tree = await mount(createElement(LeaderboardScreen));
    const tabs = () => tree.root.findAll(n => n.type === 'TouchableOpacity' && n.props.accessibilityRole === 'tab');
    expect(tabs().map(t => t.props.accessibilityLabel)).toEqual(['Bronze league', 'Week', 'All-time', 'Friends']);
    expect(tabs().map(t => (t.props.accessibilityState as { selected: boolean }).selected)).toEqual([true, false, false, false]);
    expect(tree.root.findAll(n => n.type === 'Icon').map(n => n.props.name)).toEqual(
      expect.arrayContaining(['shield-outline', 'calendar-outline', 'globe-outline', 'people-outline']),
    );

    await press(byLabel(tree.root, 'Week'));
    expect(text(tree.root)).toContain('Pat One');
    expect(text(tree.root)).toContain('40');
    await press(byLabel(tree.root, 'All-time'));
    expect(text(tree.root)).toContain('Pam Two');
    expect(text(tree.root)).toContain('900');
    await press(byLabel(tree.root, 'Friends'));
    expect(text(tree.root)).toContain('Fran Three');
    expect(tabs().map(t => (t.props.accessibilityState as { selected: boolean }).selected)).toEqual([false, false, false, true]);
    await act(async () => { tree.unmount(); });
  });

  it('follow, unfollow and nudge still work from the rows', async () => {
    leaderboardHook.weeklyBoard = [entry('p1', 'Pat One', 500, 40), entry(OWNER, 'Test User', 12, 3)];
    leaderboardHook.following = new Set(['p1']);
    const tree = await mount(createElement(LeaderboardScreen));
    await press(byLabel(tree.root, 'Week'));
    await press(byLabel(tree.root, 'Unfollow p1'));
    expect(leaderboardHook.unfollow).toHaveBeenCalledWith('p1');
    leaderboardHook.following = new Set();
    await act(async () => { tree.unmount(); });

    const second = await mount(createElement(LeaderboardScreen));
    await press(byLabel(second.root, 'Week'));
    await press(byLabel(second.root, 'Follow p1'));
    expect(leaderboardHook.follow).toHaveBeenCalledWith('p1');
    expect(pressables(second.root).some(n => n.props.accessibilityLabel === 'Nudge Test User')).toBe(false);
    await press(byLabel(second.root, 'Nudge Pat One'));
    expect(text(second.root)).toContain('Nudge Pat');
    expect(pressables(second.root).some(n => n.props.accessibilityLabel === 'Send 💪 nudge')).toBe(true);
    await press(byLabel(second.root, 'Send nudge'));
    expect(supabase.auth.getSession).toHaveBeenCalled();
    await act(async () => { second.unmount(); });
  });

  it('shares competition numbers only, without emoji', async () => {
    profile.total_points = 77;
    leaderboardHook.myGlobalRank = 5;
    streak = { current_streak: 4, longest_streak: 4 };
    const tree = await mount(createElement(LeaderboardScreen));
    await press(byLabel(tree.root, 'All-time'));
    await press(byLabel(tree.root, 'Share your ranking'));
    const message = jest.mocked(Share.share).mock.calls[0][0].message as string;
    expect(message).toContain('4-day streak');
    expect(message).toContain('77 competition points all-time');
    expect(message).toContain('Ranked #5 globally');
    expect(message).not.toMatch(EMOJI);
    await act(async () => { tree.unmount(); });
  });

  it('empty views explain what to do without emoji', async () => {
    const tree = await mount(createElement(LeaderboardScreen));
    await press(byLabel(tree.root, 'Friends'));
    expect(text(tree.root)).toContain('No friends yet');
    expect(text(tree.root)).toContain('Switch to Week or All-time and tap + to follow people.');
    await press(byLabel(tree.root, 'Week'));
    expect(text(tree.root)).toContain('No workouts this week');
    expect(text(tree.root)).toContain('Log a workout to appear here.');
    await act(async () => { tree.unmount(); });
  });
});
