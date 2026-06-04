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
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount with the current session,
    // so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
        setLoading(false);
        return;
      }
      if (event === 'USER_UPDATED') {
        setNeedsPasswordReset(false);
      }
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
        .select('id, username, full_name, avatar_url, total_points, streak_freeze_credits, bio, is_admin, created_at')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
        setProfileMissing(false);
      } else {
        setProfile(null);
        setProfileMissing(error?.code !== 'PGRST116'); // only flag missing if it's truly not found
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

  async function signOut() {
    await supabase.auth.signOut();
    clearUserId().catch(() => {});
    unregisterBackgroundSync().catch(() => {});
    teardownHealthKit();
  }

  // profileExists: true only when the user is signed in AND has a profiles row.
  const profileExists = profile !== null && !profileMissing;

  return {
    session,
    profile,
    profileMissing,
    profileExists,
    loading,
    needsPasswordReset,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithFacebook,
    signOut,
  };
}
