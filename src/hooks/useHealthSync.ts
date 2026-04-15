import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { initHealthKit, syncRecentWorkouts } from '../lib/healthKit';
import { initHealthConnect, pollHealthConnect } from '../lib/healthConnect';
import { persistUserId } from '../lib/backgroundSync';

export type ProviderKey =
  | 'apple_health'
  | 'health_connect'
  | 'strava'
  | 'garmin'
  | 'fitbit'
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
  garmin:         { label: 'Garmin Connect',   icon: '⌚', platform: 'both' },
  fitbit:         { label: 'Fitbit',            icon: '💙', platform: 'both' },
  samsung_health: { label: 'Samsung Health',   icon: '📱', platform: 'android' },
};

export function useHealthSync(userId: string) {
  const [connections, setConnections] = useState<DeviceConnection[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

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

  /** Connect a native health source (HealthKit / Health Connect) */
  async function connectNative(): Promise<{ success: boolean; message: string }> {
    if (!userId) return { success: false, message: 'Not logged in' };

    let granted = false;

    if (Platform.OS === 'ios') {
      granted = await initHealthKit(userId);
    } else if (Platform.OS === 'android') {
      granted = await initHealthConnect();
    }

    if (!granted) {
      return { success: false, message: 'Permission denied. Please allow access in your device settings.' };
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

    // Immediate first sync
    setSyncing(true);
    if (Platform.OS === 'ios') {
      await syncRecentWorkouts(userId);
    } else {
      await pollHealthConnect(userId);
    }
    setSyncing(false);
    setLastSynced(new Date());

    return { success: true, message: 'Connected! Your recent workouts have been synced.' };
  }

  /** Trigger a manual foreground sync */
  async function syncNow(): Promise<number> {
    if (!userId) return 0;
    setSyncing(true);

    let count = 0;
    if (Platform.OS === 'ios') {
      count = await syncRecentWorkouts(userId);
    } else if (Platform.OS === 'android') {
      count = await pollHealthConnect(userId);
    }

    if (count > 0) {
      await supabase
        .from('device_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('provider', Platform.OS === 'ios' ? 'apple_health' : 'health_connect');
      await fetchConnections();
    }

    setSyncing(false);
    setLastSynced(new Date());
    return count;
  }

  /** Disconnect a provider */
  async function disconnect(provider: ProviderKey): Promise<void> {
    await supabase
      .from('device_connections')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('provider', provider);
    await fetchConnections();
  }

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
    syncNow,
    disconnect,
    nativeProvider,
    refresh: fetchConnections,
  };
}
