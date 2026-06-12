import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { navigationRef } from './navigationRef';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../theme';
import type { MainTabParamList, RootStackParamList } from './types';

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

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, string> = {
  Home:        '🏠',
  Challenges:  '💪',
  Leaderboard: '🏆',
  Profile:     '👤',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>
      {TAB_ICONS[name] ?? '●'}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 82,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle:  { marginBottom: 4, fontSize: 10 },
        tabBarItemStyle:   { paddingVertical: 4 },
        tabBarActiveTintColor:   C.primary,
        tabBarInactiveTintColor: C.muted,
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
  // Session/profile state comes from the single AuthProvider subscription —
  // no duplicate onAuthStateChange listener here.
  const { session, profile, loading, needsPasswordReset } = useAuth();

  // Show a blank splash while we resolve both session + profile.
  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  // Signed-in but no profile row yet (OAuth user on first sign-in).
  // Send them through the auth stack so they can pick a username.
  const isAuthenticated = !!session && profile != null;

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
