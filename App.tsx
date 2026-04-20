import 'react-native-url-polyfill/auto';
import './src/lib/backgroundSync';
import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { navigationRef } from './src/navigation/navigationRef';
import { supabase } from './src/lib/supabase';
import { registerBackgroundSync, persistUserId, clearUserId } from './src/lib/backgroundSync';
import { initHealthKit, teardownHealthKit } from './src/lib/healthKit';
import { initHealthConnect } from './src/lib/healthConnect';
import { scheduleStreakReminder } from './src/lib/streakNotification';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

function AppInner() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) bootHealthSync(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s?.user?.id) {
        await bootHealthSync(s.user.id);
      } else {
        teardownHealthKit();
        await clearUserId();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  usePushNotifications(session?.user?.id ?? '', navigationRef);

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
  );
}

async function bootHealthSync(userId: string) {
  await persistUserId(userId);
  await registerBackgroundSync();
  if (Platform.OS === 'ios') {
    await initHealthKit(userId);
  } else if (Platform.OS === 'android') {
    await initHealthConnect();
  }
  // Schedule tonight's streak reminder — streak count fetched lazily by the notification lib
  scheduleStreakReminder(0);
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0C1117' }}>
          <AppInner />
        </SafeAreaView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
