import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { navigationRef } from './navigationRef';

import OnboardingScreen           from '../screens/auth/OnboardingScreen';
import LoginScreen                from '../screens/auth/LoginScreen';
import SignupScreen               from '../screens/auth/SignupScreen';
import ResetPasswordScreen        from '../screens/auth/ResetPasswordScreen';

import HomeScreen                 from '../screens/HomeScreen';
import ChallengesScreen           from '../screens/ChallengesScreen';
import LeaderboardScreen          from '../screens/LeaderboardScreen';
import ProfileScreen              from '../screens/ProfileScreen';
import ChallengeDetailScreen      from '../screens/ChallengeDetailScreen';
import CreateChallengeScreen      from '../screens/CreateChallengeScreen';
import LogWorkoutScreen           from '../screens/LogWorkoutScreen';
import ConnectDevicesScreen       from '../screens/ConnectDevicesScreen';
import WeeklyRecapScreen          from '../screens/WeeklyRecapScreen';
import DiscoverScreen             from '../screens/DiscoverScreen';
import DiscoverChallengesScreen   from '../screens/DiscoverChallengesScreen';

export type RootStackParamList = {
  Main: undefined;
  ChallengeDetail: { challengeId: string };
  CreateChallenge: undefined;
  LogWorkout: undefined;
  ConnectDevices: undefined;
  WeeklyRecap: { week?: 'current' } | undefined;
  ResetPassword: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICON_FOCUSED: Record<string, IoniconsName> = {
  Home:        'home',
  Challenges:  'barbell',
  Leaderboard: 'trophy',
  Profile:     'person',
};

const TAB_ICON_UNFOCUSED: Record<string, IoniconsName> = {
  Home:        'home-outline',
  Challenges:  'barbell-outline',
  Leaderboard: 'trophy-outline',
  Profile:     'person-outline',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
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
  const [session, setSession] = useState<Session | null>(null);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  async function checkProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    setProfileExists(!error && data != null);
    setLoading(false);
  }

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount — no need for a separate getSession() call
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (_e === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
        setLoading(false);
        return;
      }
      if (_e === 'USER_UPDATED') {
        setNeedsPasswordReset(false);
      }
      setSession(s);
      if (s?.user?.id) {
        setLoading(true);
        checkProfile(s.user.id);
      } else {
        setProfileExists(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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
