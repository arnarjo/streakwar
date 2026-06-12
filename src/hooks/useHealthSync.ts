import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { initHealthKit, syncRecentWorkouts } from '../lib/healthKit';
import { initHealthConnect, checkHealthConnectGranted, pollHealthConnect } from '../lib/healthConnect';
import { persistUserId, clearUserId, unregisterBackgroundSync } from '../lib/backgroundSync';

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

  const fetchConnections = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('device_connections')
      .select('provider, is_active, last_synced_at')
      .eq('user_id', userId);
    setConnections(data ?? []);
  }, [userId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

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
    await supabase.from('device_connections').upsert({
      user_id: userId,
      provider,
      is_active: true,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    await persistUserId(userId);
    await fetchConnections();

    setSyncing(true);
    if (Platform.OS === 'ios') {
      await syncRecentWorkouts(userId);
    } else {
      await pollHealthConnect(userId);
    }
    setSyncing(false);
    setLastSynced(new Date());

    return { success: true, message: 'Connected! Your recent workouts have been synced.' };
  }, [userId, fetchConnections]);

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

    await supabase.from('device_connections').upsert({
      user_id: userId,
      provider: 'health_connect',
      is_active: true,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    await persistUserId(userId);
    await fetchConnections();

    setSyncing(true);
    await pollHealthConnect(userId);
    setSyncing(false);
    setLastSynced(new Date());
    return true;
  }, [userId, fetchConnections]);

  /** Trigger a manual foreground sync */
  const syncNow = useCallback(async (): Promise<number> => {
    if (!userId || syncing) return 0;
    const nativeProvider: ProviderKey = Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
    if (!connections.some(c => c.provider === nativeProvider && c.is_active)) return 0;
    setSyncing(true);

    let count = 0;
    let syncRan = false;
    if (Platform.OS === 'ios') {
      count = await syncRecentWorkouts(userId);
      syncRan = true;
    } else if (Platform.OS === 'android') {
      const result = await pollHealthConnect(userId);
      count = result.synced;
      // Skipped polls (permissions revoked) must not bump last_synced_at,
      // or the staleness warning would never fire.
      syncRan = result.ranWithPermissions;
    }

    if (syncRan) {
      await supabase
        .from('device_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('provider', Platform.OS === 'ios' ? 'apple_health' : 'health_connect');
    }
    await fetchConnections();

    setSyncing(false);
    setLastSynced(new Date());
    return count;
  }, [userId, fetchConnections, syncing]);

  /** Disconnect a provider */
  const disconnect = useCallback(async (provider: ProviderKey): Promise<void> => {
    await supabase
      .from('device_connections')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('provider', provider);

    const nativeProv: ProviderKey = Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
    if (provider === nativeProv) {
      await clearUserId();
      await unregisterBackgroundSync();
    }

    await fetchConnections();
  }, [userId, fetchConnections]);

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
    refresh: fetchConnections,
  };
}
