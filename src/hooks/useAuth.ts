import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { configurePurchases, logOutPurchases } from './usePremium';
import { cancelStreakReminders } from '../lib/streakNotification';
import { clearUserId, unregisterBackgroundSync } from '../lib/backgroundSync';
import { teardownHealthKit } from '../lib/healthKit';
import type { Profile } from '../types/database';
import type { Session } from '@supabase/supabase-js';

// Warm up the browser on Android so OAuth opens faster.
WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount with the current session,
    // so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        // Only configure purchases on actual sign-in events, not on every state change
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          configurePurchases(session.user.id);
        }
        fetchProfile(session.user.id);
      } else {
        logOutPurchases();
        cancelStreakReminders().catch(() => {});
        setProfile(null);
        setProfileMissing(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        // is_admin is intentionally excluded from the client-readable select.
        // Admin status must be verified server-side via JWT claims, not a client-readable profile field.
        .select('id, username, full_name, avatar_url, total_points, streak_freeze_credits, bio, created_at')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
        setProfileMissing(false);
      } else {
        setProfile(null);
        setProfileMissing(error?.code === 'PGRST116'); // only flag missing if it's truly not found
      }
    } catch {
      setProfile(null);
      setProfileMissing(false);
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, username: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: fullName } },
    });
    return { error };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signInWithProvider(provider: 'google' | 'facebook') {
    // Linking.createURL('') produces "streakwar://" (no trailing slash).
    // Linking.createURL('/') would produce "streakwar:///" which does NOT match
    // what Supabase redirects to, causing the session exchange to silently fail.
    const redirectUri = Linking.createURL('');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUri, skipBrowserRedirect: true },
    });

    if (error || !data.url) return { error: error ?? new Error('No OAuth URL returned') };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    // User dismissed or cancelled — not an error we should show to them.
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { error: null };
    }

    if (result.type === 'success' && result.url) {
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
      return { error: sessionError ?? null };
    }

    return { error: null };
  }

  async function signInWithGoogle() {
    return signInWithProvider('google');
  }

  async function signInWithFacebook() {
    return signInWithProvider('facebook');
  }

  async function resetPasswordForEmail(email: string) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'streakwar://reset-password',
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    clearUserId().catch(() => {});
    unregisterBackgroundSync().catch(() => {});
    teardownHealthKit();
  }

  return {
    session,
    profile,
    profileMissing,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithFacebook,
    signOut,
    resetPasswordForEmail,
  };
}
