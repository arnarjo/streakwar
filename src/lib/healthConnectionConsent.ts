import { supabase } from './supabase';
import { assertHealthSyncUser } from './healthSyncIdentity';

/** OS permissions are not consent to an in-app connection that was disconnected. */
export async function hasActiveHealthConnectConnection(userId: string): Promise<boolean> {
  await assertHealthSyncUser(userId);
  const { data, error } = await supabase.from('device_connections')
    .select('is_active').eq('user_id', userId).eq('provider', 'health_connect').maybeSingle();
  if (error) throw error; // Offline/unknown must never default to connected.
  await assertHealthSyncUser(userId);
  return data?.is_active === true;
}
