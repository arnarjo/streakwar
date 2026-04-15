/**
 * fitbit-webhook
 *
 * Receives Fitbit subscription notifications (POST) and verification (GET).
 * Fitbit sends a list of user/collection pairs that have changed. We fetch
 * the activities since last sync for each affected user and create workout_posts.
 *
 * Fitbit docs: https://dev.fitbit.com/build/reference/web-api/subscriptions/
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FITBIT_VERIFY_CODE = Deno.env.get('FITBIT_VERIFY_CODE') ?? '';

// Fitbit activity type id → our ActivityType (best-effort mapping)
function fitbitActivityToType(logId: number, activityName: string): string {
  const name = activityName.toLowerCase();
  if (name.includes('run') || name.includes('jog')) return 'run';
  if (name.includes('walk') || name.includes('hike')) return 'walk';
  if (name.includes('bike') || name.includes('cycl') || name.includes('spin')) return 'cycle';
  if (name.includes('swim')) return 'swim';
  if (name.includes('weight') || name.includes('strength') || name.includes('lift')) return 'lift';
  if (name.includes('yoga')) return 'yoga';
  if (name.includes('hiit') || name.includes('interval') || name.includes('circuit')) return 'hiit';
  return 'other';
}

async function refreshFitbitToken(conn: any): Promise<string> {
  if (!conn.refresh_token) return conn.access_token;
  const tokenExpiry = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  if (tokenExpiry && tokenExpiry > new Date(Date.now() + 60_000)) {
    return conn.access_token; // still valid
  }
  const credentials = btoa(`${Deno.env.get('FITBIT_CLIENT_ID')}:${Deno.env.get('FITBIT_CLIENT_SECRET')}`);
  const res = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
  });
  const data = await res.json();
  if (data.access_token) {
    await supabase.from('device_connections').update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? conn.refresh_token,
      token_expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    }).eq('user_id', conn.user_id).eq('provider', 'fitbit');
    return data.access_token;
  }
  return conn.access_token;
}

serve(async (req) => {
  // ── GET: Fitbit subscriber verification ──────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const verify = url.searchParams.get('verify');
    if (verify === FITBIT_VERIFY_CODE) {
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 404 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let notifications: any[];
  try {
    notifications = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  // Fitbit sends an array of change notifications
  for (const note of notifications) {
    if (note.collectionType !== 'activities') continue;

    const fitbitUserId = note.ownerId;
    const { data: conn } = await supabase
      .from('device_connections')
      .select('*')
      .eq('provider', 'fitbit')
      .eq('external_user_id', fitbitUserId)
      .eq('is_active', true)
      .single();

    if (!conn) continue;

    const accessToken = await refreshFitbitToken(conn);
    const afterDate = conn.last_synced_at
      ? conn.last_synced_at.substring(0, 10)
      : new Date(Date.now() - 86400000).toISOString().substring(0, 10);

    // Fetch recent activities
    const actsRes = await fetch(
      `https://api.fitbit.com/1/user/-/activities/list.json?afterDate=${afterDate}&sort=asc&offset=0&limit=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!actsRes.ok) continue;

    const actsData = await actsRes.json();
    const activities = actsData.activities ?? [];

    for (const act of activities) {
      const externalId = `fitbit_${act.logId}`;

      // Dedup check
      const { data: existing } = await supabase
        .from('workout_posts')
        .select('id')
        .eq('external_activity_id', externalId)
        .eq('user_id', conn.user_id)
        .maybeSingle();
      if (existing) continue;

      const activityType = fitbitActivityToType(act.activityTypeId, act.activityName ?? '');
      const durationMin = act.duration ? Math.round(act.duration / 60000) : null;
      const distanceKm = act.distance ?? null;
      const calories = act.calories ?? null;
      const workoutDate = act.startTime
        ? act.startTime.substring(0, 10)
        : new Date().toISOString().substring(0, 10);

      const { data: participations } = await supabase
        .from('challenge_participants')
        .select('challenge_id, fitness_challenges!inner(status)')
        .eq('user_id', conn.user_id)
        .eq('fitness_challenges.status', 'active');

      const challengeId = participations?.[0]?.challenge_id ?? null;

      await supabase.from('workout_posts').insert({
        user_id: conn.user_id,
        activity_type: activityType,
        duration_minutes: durationMin,
        distance_km: distanceKm,
        calories,
        caption: act.activityName ?? null,
        challenge_id: challengeId,
        workout_date: workoutDate,
        source: 'fitbit',
        external_activity_id: externalId,
        points_awarded: 0,
        posted_at: new Date().toISOString(),
      });
    }

    // Update last_synced_at
    await supabase.from('device_connections').update({
      last_synced_at: new Date().toISOString(),
    }).eq('user_id', conn.user_id).eq('provider', 'fitbit');
  }

  // Fitbit expects 204
  return new Response(null, { status: 204 });
});
