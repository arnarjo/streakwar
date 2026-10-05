import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { assertHealthSyncUser } from '../lib/healthSyncIdentity';
import { initHealthKit, syncRecentWorkouts } from '../lib/healthKit';
import { initHealthConnect, checkHealthConnectGranted, pollHealthConnect } from '../lib/healthConnect';
import { registerHealthSyncBackground, disconnectHealthSyncBackground } from '../lib/healthSyncLifecycle';
import { HealthSyncIncompleteError, formatConnectedSyncNote } from '../lib/healthSyncFeedback';
import { getHealthConnectBackgroundState, requestHealthConnectBackground, type HealthConnectBackgroundState } from '../lib/healthConnectBackground';

export type ProviderKey =
  | 'apple_health'
  | 'health_connect'
  | 'strava'
  | 'samsung_health';

export interface DeviceConnection {
  provider: ProviderKey;
  is_active: boolean;
  last_synced_at: string | null;
}

export const PROVIDER_META: Record<ProviderKey, { label: string; icon: string; platform: 'ios' | 'android' | 'both' }> = {
  apple_health:   { label: 'Apple Health',     icon: '🍎', platform: 'ios' },
  health_connect: { label: 'Health Connect',   icon: '💚', platform: 'android' },
  strava:         { label: 'Strava',            icon: '🟠', platform: 'both' },
  samsung_health: { label: 'Samsung Health',   icon: '📱', platform: 'android' },
};

export function useHealthSync(userId: string) {
  const [connections, setConnections] = useState<DeviceConnection[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [showBatteryWarning, setShowBatteryWarning] = useState(false);
  const [backgroundSyncUnavailable, setBackgroundSyncUnavailable] = useState(false);
  const [backgroundAccess, setBackgroundAccess] = useState<HealthConnectBackgroundState | 'checking'>('checking');
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [stateUserId, setStateUserId] = useState(userId);
  const scope = useMemo(() => Symbol(userId), [userId]);
  const activeScope = useRef<symbol | null>(null);
  const manualInFlight = useRef(false);
  const fetchRevision = useRef(0);
  const backgroundRevision = useRef(0);
  useLayoutEffect(() => {
    activeScope.current = scope;
    manualInFlight.current = false;
    return () => { activeScope.current = null; };
  }, [scope]);

  // Reset before exposing the previous account's connection/status to a render.
  if (stateUserId !== userId) {
    setStateUserId(userId);
    setConnections([]);
    setSyncing(false);
    setLastSynced(null);
    setBackgroundSyncUnavailable(false);
    setBackgroundAccess('checking');
    setPermissionNotice(null);
    setShowBatteryWarning(false);
  }

  const assertCurrent = useCallback(async () => {
    if (activeScope.current !== scope) throw new Error('Health sync account changed or screen closed.');
    await assertHealthSyncUser(userId);
    if (activeScope.current !== scope) throw new Error('Health sync account changed or screen closed.');
  }, [scope, userId]);

  const fetchConnections = useCallback(async () => {
    if (!userId) return;
    const revision = ++fetchRevision.current;
    const { data, error } = await supabase
      .from('device_connections')
      .select('provider, is_active, last_synced_at')
      .eq('user_id', userId);
    if (error) throw error;
    if (activeScope.current === scope && revision === fetchRevision.current) setConnections(data ?? []);
  }, [userId, scope]);

  useEffect(() => {
    fetchConnections().catch(() => {});
  }, [fetchConnections]);

  const hasHealthConnect = connections.some(c => c.provider === 'health_connect' && c.is_active);
  useEffect(() => {
    if (Platform.OS !== 'android' || !hasHealthConnect) return;
    let disposed = false;
    const refreshAccess = async () => {
      const current = ++backgroundRevision.current;
      const state = await getHealthConnectBackgroundState();
      if (!disposed && activeScope.current === scope && current === backgroundRevision.current) setBackgroundAccess(state);
    };
    void refreshAccess();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshAccess();
    });
    return () => { disposed = true; listener.remove(); };
  }, [hasHealthConnect, scope]);

  const enableBackgroundSync = useCallback(async () => {
    if (Platform.OS !== 'android' || !hasHealthConnect) throw new Error('Connect Health Connect first.');
    if (syncing || manualInFlight.current) throw new Error('Sync is already running.');
    manualInFlight.current = true;
    setSyncing(true);
    try {
      await assertCurrent();
      const state = await requestHealthConnectBackground();
      await assertCurrent();
      ++backgroundRevision.current;
      setBackgroundAccess(state);
      const registered = state === 'granted' && await registerHealthSyncBackground(userId, { persist: false });
      await assertCurrent();
      setBackgroundSyncUnavailable(!registered);
    } finally {
      if (activeScope.current === scope) {
        manualInFlight.current = false;
        setSyncing(false);
      }
    }
  }, [hasHealthConnect, syncing, assertCurrent, scope, userId]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const hcConn = connections.find(c => c.provider === 'health_connect' && c.is_active);
    if (!hcConn || !hcConn.last_synced_at) {
      setShowBatteryWarning(false);
      return;
    }
    const lastSync = new Date(hcConn.last_synced_at).getTime();
    const stale = Date.now() - lastSync > 30 * 60 * 1000;
    setShowBatteryWarning(stale);
  }, [connections]);

  // A permission grant or a poll attempt is not evidence that data was saved.
  const syncAndRecord = useCallback(async (): Promise<number> => {
    await assertCurrent();
    let count = 0;
    if (Platform.OS === 'android') {
      const result = await pollHealthConnect(userId);
      await assertCurrent();
      const missing = result.missingPermissions ?? [];
      setPermissionNotice(missing.length
        ? `Health Connect read access is missing for: ${missing.join(', ')}. Open Health Connect settings to enable it. Other data may have imported.`
        : null);
      if (!result.completed) {
        // Thrown only after assertCurrent() above, so a stale account never exposes this result.
        throw new HealthSyncIncompleteError(result);
      }
      // Steps insert/update is not a workout; without the per-type outcome there
      // is no safe count, so fail (and write no timestamp) instead of guessing.
      if (result.exercise?.status !== 'ok' || !Number.isInteger(result.exercise.written) || result.exercise.written < 0) {
        throw new Error('Sync did not complete. The sync outcome was unavailable. Please retry.');
      }
      count = result.exercise.written;
    } else if (Platform.OS === 'ios') {
      count = await syncRecentWorkouts(userId);
    } else {
      throw new Error('Health sync is not available on this platform.');
    }
    const finishedAt = new Date();
    await assertCurrent();
    const { data, error } = await supabase
      .from('device_connections')
      .update({ last_synced_at: finishedAt.toISOString() })
      .eq('user_id', userId)
      .eq('provider', Platform.OS === 'ios' ? 'apple_health' : 'health_connect')
      .eq('is_active', true)
      .select('provider');
    if (error) throw error;
    if (data?.length !== 1) throw new Error('Sync status was not saved to an active connection. Please reconnect and retry.');
    await assertCurrent();
    setLastSynced(finishedAt);
    return count;
  }, [userId, assertCurrent]);

  /** Connect a native health source (HealthKit on iOS / Health Connect on Android). */
  const connectNative = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!userId) return { success: false, message: 'Not logged in' };

    let granted = false;
    if (Platform.OS === 'ios') {
      granted = await initHealthKit(userId);
    } else if (Platform.OS === 'android') {
      granted = await initHealthConnect();
    }

    if (!granted) {
      const msg = Platform.OS === 'ios'
        ? 'Apple Health access denied. Please enable it in Settings > Health > Data Access & Devices.'
        : 'Health Connect access denied. Please ensure the Health Connect app is installed and permissions are granted.';
      return { success: false, message: msg };
    }

    const provider: ProviderKey = Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
    await assertCurrent();
    const { error } = await supabase.from('device_connections').upsert({
      user_id: userId,
      provider,
      is_active: true,
    }, { onConflict: 'user_id,provider' });
    if (error) throw error;

    await assertCurrent();
    const registered = await registerHealthSyncBackground(userId, { persist: true });
    await assertCurrent();
    setBackgroundSyncUnavailable(!registered);
    await fetchConnections();

    await assertCurrent();
    setSyncing(true);
    try {
      await syncAndRecord();
      await fetchConnections();
      return { success: true, message: 'Connected! Your recent workouts have been synced.' };
    } catch (syncError) {
      await assertCurrent();
      // The connection exists, but the initial import did not complete.
      // Do not send the caller back to the permission dialog or claim success.
      return { success: true, message: formatConnectedSyncNote(syncError) };
    } finally {
      if (activeScope.current === scope) setSyncing(false);
    }
  }, [userId, fetchConnections, syncAndRecord, assertCurrent, scope]);

  /**
   * Called after the user returns from Health Connect settings on Android.
   * Checks if ExerciseSession permission was granted and saves the connection.
   */
  const confirmHealthConnectConnection = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    console.log('[useHealthSync] Confirming Health Connect connection...');
    const granted = await checkHealthConnectGranted(true);
    console.log('[useHealthSync] Granted:', granted);
    if (!granted) return false;

    await assertCurrent();
    const { error } = await supabase.from('device_connections').upsert({
      user_id: userId,
      provider: 'health_connect',
      is_active: true,
    }, { onConflict: 'user_id,provider' });
    if (error) throw error;

    await assertCurrent();
    const registered = await registerHealthSyncBackground(userId, { persist: true });
    await assertCurrent();
    setBackgroundSyncUnavailable(!registered);
    await fetchConnections();

    await assertCurrent();
    setSyncing(true);
    try {
      await syncAndRecord();
      await fetchConnections();
    } catch {
      await assertCurrent();
      // This boolean confirms permissions/connection, not import success.
      // Keep the previous last-success value on a failed or skipped poll.
    } finally {
      if (activeScope.current === scope) setSyncing(false);
    }
    return true;
  }, [userId, fetchConnections, syncAndRecord, assertCurrent, scope]);

  /** Trigger a manual foreground sync */
  const syncNow = useCallback(async (): Promise<number> => {
    if (!userId) throw new Error('Sign in before syncing.');
    if (syncing || manualInFlight.current) throw new Error('Sync is already running.');
    const nativeProvider: ProviderKey = Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
    if (!connections.some(c => c.provider === nativeProvider && c.is_active)) {
      throw new Error('Connect a health source before syncing.');
    }
    manualInFlight.current = true;
    setSyncing(true);

    try {
      const count = await syncAndRecord();
      await fetchConnections();
      return count;
    } finally {
      if (activeScope.current === scope) {
        manualInFlight.current = false;
        setSyncing(false);
      }
    }
  }, [userId, fetchConnections, syncing, syncAndRecord, connections, scope]);

  /** Disconnect a provider */
  const disconnect = useCallback(async (provider: ProviderKey): Promise<void> => {
    await assertCurrent();
    const { error } = await supabase
      .from('device_connections')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('provider', provider);
    if (error) throw error;
    await assertCurrent();

    const nativeProv: ProviderKey = Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
    if (provider === nativeProv) {
      await disconnectHealthSyncBackground(userId);
      await assertCurrent();
      setBackgroundSyncUnavailable(false);
      setBackgroundAccess('checking');
      setPermissionNotice(null);
    }

    await fetchConnections();
  }, [userId, fetchConnections, assertCurrent]);

  function isConnected(provider: ProviderKey): boolean {
    return connections.some(c => c.provider === provider && c.is_active);
  }

  const nativeProvider: ProviderKey = Platform.OS === 'ios' ? 'apple_health' : 'health_connect';

  return {
    connections,
    syncing,
    lastSynced,
    isConnected,
    connectNative,
    confirmHealthConnectConnection,
    syncNow,
    disconnect,
    nativeProvider,
    showBatteryWarning,
    backgroundSyncUnavailable,
    backgroundAccess,
    enableBackgroundSync,
    permissionNotice,
    refresh: fetchConnections,
  };
}
