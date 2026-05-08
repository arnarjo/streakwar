/**
 * strava-webhook
 *
 * Receives Strava webhook events (POST) and subscription verification (GET).
 * When a new activity is created for a connected user, it fetches the full
 * activity details and creates a workout_post, awarding challenge points.
 *
 * Strava docs: https://developers.strava.com/docs/webhooks/
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const STRAVA_VERIFY_TOKEN = Deno.env.get('STRAVA_VERIFY_TOKEN') ?? 'streakwar_strava';

// Strava activity type → our ActivityType
const STRAVA_TYPE_MAP: Record<string, string> = {
  Run: 'run', VirtualRun: 'run',
  Walk: 'walk', Hike: 'walk',
  Ride: 'cycle', VirtualRide: 'cycle', EBikeRide: 'cycle',
  Swim: 'swim',
  WeightTraining: 'lift', Crossfit: 'lift',
  Yoga: 'yoga',
  HIIT: 'hiit', Workout: 'hiit',
};

serve(async (req) => {
  // ── GET: Strava subscription verification challenge ──────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === STRAVA_VERIFY_TOKEN && challenge) {
      return Response.json({ 'hub.challenge': challenge });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: Activity event ─────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let event: any;
  try {
    event = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  // We only care about activity creates/updates
  if (event.object_type !== 'activity' || event.aspect_type !== 'create') {
    return Response.json({ ok: true });
  }

  const stravaAthleteId = String(event.owner_id);
  const stravaActivityId = String(event.object_id);

  // Find the StreakWar user with this Strava athlete id
  const { data: conn } = await supabase
    .from('device_connections')
    .select('user_id, access_token, refresh_token, token_expires_at')
    .eq('provider', 'strava')
    .eq('external_user_id', stravaAthleteId)
    .eq('is_active', true)
    .single();

  if (!conn) {
    return Response.json({ ok: true, skipped: 'no connected user' });
  }

  // Refresh token if expired (Strava tokens expire after 6 hours)
  let accessToken = conn.access_token;
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (Date.now() >= expiresAt - 60_000) {
    // Token expired or expires within 1 minute — refresh it
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get('STRAVA_CLIENT_ID'),
        client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
      }),
    });
    if (refreshRes.ok) {
      const tokens = await refreshRes.json();
      accessToken = tokens.access_token;
      await supabase.from('device_connections').update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? conn.refresh_token,
        token_expires_at: tokens.expires_at
          ? new Date(tokens.expires_at * 1000).toISOString()
          : null,
      })
        .eq('user_id', conn.user_id)
        .eq('provider', 'strava');
    } else {
      console.error('Strava token refresh failed:', await refreshRes.text());
      // Continue with existing token — might still work if clock drift
    }
  }

  // Check for duplicate
  const externalId = `strava_${stravaActivityId}`;
  const { data: existing } = await supabase
    .from('workout_posts')
    .select('id')
    .eq('external_activity_id', externalId)
    .eq('user_id', conn.user_id)
    .maybeSingle();

  if (existing) {
    return Response.json({ ok: true, skipped: 'duplicate' });
  }

  // Fetch full activity from Strava
  const actRes = await fetch(
    `https://www.strava.com/api/v3/activities/${stravaActivityId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!actRes.ok) {
    console.error('Failed to fetch Strava activity', await actRes.text());
    return new Response('Strava fetch failed', { status: 502 });
  }

  const act = await actRes.json();

  const activityType = STRAVA_TYPE_MAP[act.type] ?? 'other';
  const durationMin = act.moving_time ? Math.round(act.moving_time / 60) : null;
  const distanceKm = act.distance ? Math.round(act.distance / 10) / 100 : null;
  const calories = act.calories ?? null;
  const workoutDate = act.start_date_local
    ? act.start_date_local.substring(0, 10)
    : new Date().toISOString().substring(0, 10);

  // Find the user's active challenges to attach the workout
  const { data: participations } = await supabase
    .from('challenge_participants')
    .select('challenge_id, fitness_challenges!inner(status)')
    .eq('user_id', conn.user_id)
    .eq('fitness_challenges.status', 'active');

  const challengeId = participations?.[0]?.challenge_id ?? null;
  if (!challengeId) {
    console.log(`[Strava] No active challenge found for user ${conn.user_id}, logging anyway.`);
  }

  const { error } = await supabase.from('workout_posts').insert({
    user_id: conn.user_id,
    activity_type: activityType,
    duration_minutes: durationMin,
    distance_km: distanceKm,
    calories,
    caption: act.name ?? null,
    challenge_id: challengeId,
    workout_date: workoutDate,
    source: 'strava',
    external_activity_id: externalId,
    points_awarded: 0,
    posted_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Insert failed:', error);
    return new Response('DB error', { status: 500 });
  }

  // Update last_synced_at
  await supabase
    .from('device_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', conn.user_id)
    .eq('provider', 'strava');

  return Response.json({ ok: true });
});
