import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { configurePurchases, logOutPurchases } from './usePremium';
import { cancelStreakReminders } from '../lib/streakNotification';
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) { configurePurchases(session.user.id); fetchProfile(session.user.id); }
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) { configurePurchases(session.user.id); fetchProfile(session.user.id); }
      else { logOutPurchases(); cancelStreakReminders().catch(() => {}); setProfile(null); setProfileMissing(false); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data);
      setProfileMissing(false);
    } else {
      // No profile row yet (e.g. first OAuth sign-in before the trigger runs,
      // or the trigger hasn't created a row because username is unknown).
      setProfile(null);
      setProfileMissing(true);
    }

    setLoading(false);
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
  };
}
