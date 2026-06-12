import type {
  CompositeNavigationProp,
  NavigatorScreenParams,
  RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { WorkoutPost } from '../types/database';

/** Routes inside the bottom tab navigator ("Main"). */
export type MainTabParamList = {
  Home: undefined;
  Challenges: undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

/** Every route registered in RootNavigator's stack. */
export type RootStackParamList = {
  // Auth stack
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  ResetPassword: undefined;
  // App stack
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  ChallengeDetail: { challengeId: string };
  CreateChallenge: undefined;
  LogWorkout: { challengeId?: string; editWorkout?: WorkoutPost } | undefined;
  ConnectDevices: undefined;
  WeeklyRecap: { week?: string } | undefined;
};

/** Navigation prop for screens registered directly on the root stack. */
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Navigation prop for screens inside the tab navigator: can navigate to
 * sibling tabs AND to root-stack routes (ChallengeDetail, LogWorkout, ...).
 */
export type AppNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type RootStackRouteProp<T extends keyof RootStackParamList> = RouteProp<
  RootStackParamList,
  T
>;
