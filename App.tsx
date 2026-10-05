import 'react-native-url-polyfill/auto';
import './src/lib/backgroundSync'; // defines the headless task before any component mounts
import React, { useEffect } from 'react';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { navigationRef } from './src/navigation/navigationRef';
import { supabase } from './src/lib/supabase';
import { Linking } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { C } from './src/theme';

function AppInner() {
  // Session comes from the single auth subscription owned by AuthProvider.
  const { session } = useAuth();
  const userId = session?.user?.id;

  // Handle deep links: password reset + OAuth callbacks
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url) return;
      // Only process the app's own auth deep links (scheme "streakwar" per
      // app.json — OAuth uses Linking.createURL('') → "streakwar://" and
      // password reset uses "streakwar://reset-password"). Feeding arbitrary
      // URLs into exchangeCodeForSession / setSession would let any deep link
      // carrying an access_token fragment fixate a session.
      if (!url.toLowerCase().startsWith('streakwar://')) return;
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

  // Local health-sync lifecycle (identity, background task, HealthKit) is
  // requested by AuthProvider from the single auth subscription and serialized
  // in src/lib/healthSyncLifecycle.ts — nothing here boots or tears it down.

  usePushNotifications(userId ?? '', navigationRef);

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
            <AppInner />
          </SafeAreaView>
        </SafeAreaProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
