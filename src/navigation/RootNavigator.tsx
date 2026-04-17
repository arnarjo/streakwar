import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { navigationRef } from './navigationRef';

import OnboardingScreen      from '../screens/auth/OnboardingScreen';
import LoginScreen           from '../screens/auth/LoginScreen';
import SignupScreen          from '../screens/auth/SignupScreen';

import HomeScreen            from '../screens/HomeScreen';
import ChallengesScreen      from '../screens/ChallengesScreen';
import LeaderboardScreen     from '../screens/LeaderboardScreen';
import ProfileScreen         from '../screens/ProfileScreen';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import CreateChallengeScreen from '../screens/CreateChallengeScreen';
import LogWorkoutScreen      from '../screens/LogWorkoutScreen';
import ConnectDevicesScreen  from '../screens/ConnectDevicesScreen';
import WeeklyRecapScreen     from '../screens/WeeklyRecapScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <View style={{ flex: 1, backgroundColor: '#0C1117' }} />;

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => {
        const route = navigationRef.getCurrentRoute();
        if (route?.name) onRouteChange?.(route.name);
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
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
