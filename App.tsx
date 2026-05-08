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
import { Platform, Linking } from 'react-native';
import type { Session } from '@supabase/supabase-js';

function AppInner() {
  const [session, setSession] = useState<Session | null>(null);

  // Handle deep links: password reset + OAuth callbacks
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url) return;
      // Let Supabase parse auth tokens or codes from the URL (handles both
      // PKCE ?code= and legacy #access_token= formats).
      try {
        await supabase.auth.exchangeCodeForSession(url);
      } catch {
        // Fragment-based tokens (older Supabase email links)
        const fragment = url.split('#')[1];
        if (fragment) {
          const p = new URLSearchParams(fragment);
          const access_token = p.get('access_token');
          const refresh_token = p.get('refresh_token');
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        }
      }
    };

    // App already running — deep link fires this event
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    // App launched via deep link
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });

    return () => sub.remove();
  }, []);

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
  // iOS: set up HealthKit observers (safe — callback-based, no Activity required)
  if (Platform.OS === 'ios') {
    await initHealthKit(userId);
  }
  // Android: do NOT call initHealthConnect() here — requestPermission() launches an
  // Android Activity and crashes when called from an auth callback. Permission is
  // requested only from ConnectDevicesScreen when the user explicitly taps "Connect".
  // Streak reminder is scheduled in usePushNotifications after permissions are granted.
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
