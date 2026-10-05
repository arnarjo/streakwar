import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { configurePurchases, logOutPurchases } from '../hooks/usePremium';
import { cancelStreakReminders } from '../lib/streakNotification';
import { requestHealthSyncOwner, whenHealthSyncSettled } from '../lib/healthSyncLifecycle';
import type { Profile } from '../types/database';
import type { AuthError, Session } from '@supabase/supabase-js';

// Warm up the browser on Android so OAuth opens faster.
WebBrowser.maybeCompleteAuthSession();

export interface AuthContextValue {
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  profileMissing: boolean;
  loading: boolean;
  needsPasswordReset: boolean;
  signUp: (
    email: string,
    password: string,
    username: string,
    fullName: string,
  ) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | Error | null }>;
  signInWithFacebook: () => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<{ error: AuthError | Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// --- Auth actions (stateless — they only talk to supabase) ---------------

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

async function signOut(): Promise<{ error: AuthError | Error | null }> {
  let error: AuthError | Error | null = null;
  try {
    ({ error } = await supabase.auth.signOut());
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
  }
  if (error) {
    // The session is still active (no SIGNED_OUT event), so do not tear down
    // the account's local health state. Never reject into the caller's onPress.
    Alert.alert('Sign out failed', 'We could not sign you out. Please check your connection and try again.');
    return { error };
  }
  // SIGNED_OUT already requested cleanup from the auth callback. Wait for the
  // serialized queue instead of running a second, independent cleanup that
  // could finish after another account has started.
  await whenHealthSyncSettled();
  return { error: null };
}

// --- Provider --------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  // Identity/revision guards: a profile response only applies if no newer
  // auth event, account change or unmount happened since it was requested.
  const identityRef = useRef<string | null>(null);
  const profileRevision = useRef(0);
  // User whose password-recovery session is pending; reset UI is tied to it.
  const recoveryUserRef = useRef<string | null>(null);
  // User whose profile result (row or authoritative absence) is currently applied.
  // Same-user events with a resolved profile refresh quietly: no loading flip, so
  // the authenticated navigation tree is not unmounted by token refreshes.
  const resolvedUserRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, revision: number, quiet: boolean) => {
    const isLatest = () => revision === profileRevision.current;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, total_points, streak_freeze_credits, bio, is_admin, created_at')
        .eq('id', userId)
        .single();
      if (!isLatest()) return;

      if (!error && data) {
        resolvedUserRef.current = userId;
        setProfile(data);
        setProfileMissing(false);
      } else if (quiet && error?.code !== 'PGRST116') {
        // Transient failure of a background refresh: keep the valid current profile.
      } else {
        // Authoritative absence (or a failed first load): nothing valid to keep.
        resolvedUserRef.current = error?.code === 'PGRST116' ? userId : null;
        setProfile(null);
        setProfileMissing(error?.code !== 'PGRST116'); // only flag missing if it's truly not found
      }
    } catch {
      if (!isLatest()) return;
      if (!quiet) {
        resolvedUserRef.current = null;
        setProfile(null);
        setProfileMissing(false);
      }
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount with the current session,
    // so we don't need a separate getSession() call. This is the ONLY auth
    // subscription in the app — every consumer reads this context instead of
    // opening its own. The callback must stay synchronous (Supabase holds its
    // auth lock while it runs): everything async is deferred to the lifecycle
    // queue or to un-awaited calls.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;

      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
        setLoading(false);
        recoveryUserRef.current = nextUserId;
        // The recovery session is not adopted as the signed-in user, but a
        // DIFFERENT previously signed-in account must stop being the identity:
        // drop its profile, ignore its in-flight responses and tear down its
        // local health state. The same user (or nobody) is left untouched.
        if (identityRef.current !== null && identityRef.current !== nextUserId) {
          identityRef.current = null;
          resolvedUserRef.current = null;
          profileRevision.current++;
          setSession(null);
          setProfile(null);
          setProfileMissing(false);
          void requestHealthSyncOwner(null);
          logOutPurchases();
          cancelStreakReminders().catch(() => {});
        }
        return;
      }
      if (event === 'USER_UPDATED') {
        setNeedsPasswordReset(false);
        recoveryUserRef.current = null;
      } else if (recoveryUserRef.current !== null && nextUserId !== recoveryUserRef.current) {
        // Recovery state must not outlive logout or an unrelated account.
        recoveryUserRef.current = null;
        setNeedsPasswordReset(false);
      }

      // Same identity whose profile is already resolved: refresh in the background.
      const quietRefresh = nextUserId !== null
        && nextUserId === identityRef.current
        && resolvedUserRef.current === nextUserId;

      if (nextUserId !== identityRef.current) {
        // Account changed (including A -> B without a null): drop the old
        // profile immediately and ignore any response still in flight.
        identityRef.current = nextUserId;
        resolvedUserRef.current = null;
        profileRevision.current++;
        setProfile(null);
        setProfileMissing(false);
      }
      // Health lifecycle follows auth directly (any source of SIGNED_OUT),
      // independent of profile loading. Same-user events are a no-op there.
      void requestHealthSyncOwner(nextUserId);

      setSession(session);
      if (session) {
        // Only configure purchases on actual sign-in events, not on every state change
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          configurePurchases(session.user.id);
        }
        if (!quietRefresh) setLoading(true);
        fetchProfile(session.user.id, ++profileRevision.current, quietRefresh);
      } else {
        logOutPurchases();
        cancelStreakReminders().catch(() => {});
        profileRevision.current++;
        setProfile(null);
        setProfileMissing(false);
        setLoading(false);
      }
    });

    const revision = profileRevision;
    const identity = identityRef;
    const resolved = resolvedUserRef;
    return () => {
      revision.current++;
      identity.current = null;
      resolved.current = null;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      userId: session?.user?.id ?? null,
      profile,
      profileMissing,
      loading,
      needsPasswordReset,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithFacebook,
      signOut,
    }),
    [session, profile, profileMissing, loading, needsPasswordReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
