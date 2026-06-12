/**
 * garmin-webhook
 *
 * Receives Garmin Health API activity push notifications.
 * Garmin uses a ping-back model: when an activity is uploaded, it POSTs a
 * summary to this endpoint. No polling required on our side.
 *
 * Garmin Health API docs: https://developer.garmin.com/gc-developer-program/
 *
 * NOTE: Garmin uses OAuth 1.0a. The oauth-callback function must be extended
 * with OAuth 1.0a support to handle the Garmin token exchange.
 * The webhook payload validation uses HMAC-SHA1 with the consumer secret.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const GARMIN_CONSUMER_SECRET = Deno.env.get('GARMIN_CONSUMER_SECRET') ?? '';

async function hmacSha1Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// Garmin activity type string â†’ our ActivityType
function garminTypeToActivity(type: string): string {
  const t = (type ?? '').toLowerCase();
  if (t.includes('running') || t.includes('trail_running')) return 'run';
  if (t.includes('walking') || t.includes('hiking')) return 'walk';
  if (t.includes('cycling') || t.includes('biking') || t.includes('indoor_cycling')) return 'cycle';
  if (t.includes('swimming') || t.includes('pool_swim') || t.includes('open_water')) return 'swim';
  if (t.includes('strength') || t.includes('gym') || t.includes('weight')) return 'lift';
  if (t.includes('yoga') || t.includes('pilates')) return 'yoga';
  if (t.includes('hiit') || t.includes('cardio')) return 'hiit';
  return 'sport';
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();

  // Verify Garmin signature — fail-closed: when the consumer secret is
  // configured, a missing or mismatched signature is rejected.
  // Garmin includes x-garmin-signature header with HMAC-SHA1 of the body.
  if (GARMIN_CONSUMER_SECRET) {
    const signature = req.headers.get('x-garmin-signature');
    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }
    const expected = await hmacSha1Hex(GARMIN_CONSUMER_SECRET, body);
    if (!timingSafeEqual(signature, expected)) {
      return new Response('Invalid signature', { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  // Garmin payload structure: { activities: [...] }
  const activities = payload.activities ?? [];

  // StreakWar user ids resolved from device_connections (NOT Garmin external ids)
  const syncedUserIds = new Set<string>();

  for (const act of activities) {
    const garminUserId = act.userId ?? act.userAccessToken;
    if (!garminUserId) continue;

    const { data: conn } = await supabase
      .from('device_connections')
      .select('user_id')
      .eq('provider', 'garmin')
      .eq('external_user_id', String(garminUserId))
      .eq('is_active', true)
      .single();

    if (!conn) continue;

    syncedUserIds.add(conn.user_id);

    const externalId = `garmin_${act.activityId}`;
    const { data: existing } = await supabase
      .from('workout_posts')
      .select('id')
      .eq('external_activity_id', externalId)
      .eq('user_id', conn.user_id)
      .maybeSingle();
    if (existing) continue;

    const activityType = garminTypeToActivity(act.activityType ?? '');
    const durationMin = act.durationInSeconds ? Math.round(act.durationInSeconds / 60) : null;
    const distanceKm = act.distanceInMeters ? Math.round(act.distanceInMeters / 10) / 100 : null;
    const calories = act.activeKilocalories ?? null;
    const steps = act.steps ?? null;
    const workoutDate = act.startTimeLocal
      ? String(act.startTimeLocal).substring(0, 10)
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
      steps,
      caption: act.activityName ?? null,
      challenge_id: challengeId,
      workout_date: workoutDate,
      source: 'garmin',
      external_activity_id: externalId,
      points_awarded: 0,
      posted_at: new Date().toISOString(),
    });
  }

  if (syncedUserIds.size > 0) {
    await supabase.from('device_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('provider', 'garmin')
      .in('user_id', [...syncedUserIds]);
  }

  return new Response('OK', { status: 200 });
});
