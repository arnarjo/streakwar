import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../hooks/useAuth';
import { navigationRef } from './navigationRef';

export type RootStackParamList = {
  Main:            undefined;
  ChallengeDetail: { challengeId: string };
  CreateChallenge: undefined;
  LogWorkout:      undefined;
  ConnectDevices:  undefined;
  WeeklyRecap:     undefined;
  ResetPassword:   undefined;
  Onboarding:      undefined;
  Login:           undefined;
  Signup:          undefined;
};

export type MainTabParamList = {
  Home:        undefined;
  Challenges:  undefined;
  Leaderboard: undefined;
  Profile:     undefined;
};

import OnboardingScreen      from '../screens/auth/OnboardingScreen';
import LoginScreen           from '../screens/auth/LoginScreen';
import SignupScreen          from '../screens/auth/SignupScreen';
import ResetPasswordScreen   from '../screens/auth/ResetPasswordScreen';

import HomeScreen            from '../screens/HomeScreen';
import ChallengesScreen      from '../screens/ChallengesScreen';
import LeaderboardScreen     from '../screens/LeaderboardScreen';
import ProfileScreen         from '../screens/ProfileScreen';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import CreateChallengeScreen from '../screens/CreateChallengeScreen';
import LogWorkoutScreen      from '../screens/LogWorkoutScreen';
import ConnectDevicesScreen  from '../screens/ConnectDevicesScreen';
import WeeklyRecapScreen     from '../screens/WeeklyRecapScreen';

export type RootStackParamList = {
  Main: undefined;
  ChallengeDetail: { challengeId: string };
  CreateChallenge: undefined;
  LogWorkout: undefined;
  ConnectDevices: undefined;
  WeeklyRecap: undefined;
  ResetPassword: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Challenges: undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<MainTabParamList>();

// SVG path data for each tab icon (24×24 viewport, stroke-based)
const TAB_SVG: Record<string, React.ReactNode> = {
  Home: (
    <Path
      d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1V9.5z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  Challenges: (
    <>
      <Path
        d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M13 2v7h7" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 13h6M9 17h4" strokeLinecap="round" />
    </>
  ),
  Leaderboard: (
    <>
      <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  Profile: (
    <>
      <Circle cx="12" cy="8" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

function TabIcon({ name, color }: { name: string; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      {TAB_SVG[name] ?? <Circle cx="12" cy="12" r="5" />}
    </Svg>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color }) => <TabIcon name={route.name} color={color} />,
        tabBarStyle: {
          backgroundColor: '#0C1117',
          borderTopColor: 'rgba(255,255,255,0.07)',
          borderTopWidth: 1,
          height: 82,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle:  { marginBottom: 4, fontSize: 10 },
        tabBarItemStyle:   { paddingVertical: 4 },
        tabBarActiveTintColor:   '#F97316',
        tabBarInactiveTintColor: '#4A6070',
      })}
    >
      <Tab.Screen name="Home"        component={HomeScreen} />
      <Tab.Screen name="Challenges"  component={ChallengesScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profile"     component={ProfileScreen} />
    </Tab.Navigator>
  );
}

type Props = { onRouteChange?: (name: string) => void };

export default function RootNavigator({ onRouteChange }: Props) {
  const { session, loading, profileExists, needsPasswordReset } = useAuth();

  // Show a blank splash while we resolve both session + profile.
  if (loading) return <View style={{ flex: 1, backgroundColor: '#0C1117' }} />;

  // Signed-in but no profile row yet (OAuth user on first sign-in).
  // Send them through the auth stack so they can pick a username.
  const isAuthenticated = !!session && profileExists === true;

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => {
        const route = navigationRef.getCurrentRoute();
        if (route?.name) onRouteChange?.(route.name);
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {needsPasswordReset ? (
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        ) : isAuthenticated ? (
          <>
            <Stack.Screen name="Main"            component={MainTabs} />
            <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
            <Stack.Screen name="CreateChallenge" component={CreateChallengeScreen}
              options={{ presentation: 'modal' }} />
            <Stack.Screen name="LogWorkout"      component={LogWorkoutScreen}
              options={{ presentation: 'modal' }} />
            <Stack.Screen name="ConnectDevices"  component={ConnectDevicesScreen} />
            <Stack.Screen name="WeeklyRecap"     component={WeeklyRecapScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login"      component={LoginScreen} />
            <Stack.Screen name="Signup"     component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
