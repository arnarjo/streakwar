/**
 * oauth-callback
 *
 * Receives the authorization code redirect from Strava / Garmin / Fitbit,
 * exchanges it for tokens, stores them in device_connections, then redirects
 * the user back to the app via deep link.
 *
 * Deep link: streakwar://oauth-success   (configure in app.json scheme)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;    // Strava: unix epoch
  expires_in?: number;    // Fitbit: seconds from now
  athlete?: { id: number };         // Strava
  user_id?: string;                 // Fitbit
}

async function exchangeStrava(code: string): Promise<TokenResponse> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('STRAVA_CLIENT_ID'),
      client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
    }),
  });
  return res.json();
}

async function exchangeFitbit(code: string): Promise<TokenResponse> {
  const credentials = btoa(`${Deno.env.get('FITBIT_CLIENT_ID')}:${Deno.env.get('FITBIT_CLIENT_SECRET')}`);
  const res = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback?provider=fitbit`,
    }),
  });
  return res.json();
}

serve(async (req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') ?? '';
  const code = url.searchParams.get('code') ?? '';
  const stateRaw = url.searchParams.get('state') ?? '';

  if (!code || !stateRaw) {
    return Response.redirect('streakwar://oauth-error?reason=missing_code', 302);
  }

  let userId: string;
  try {
    const state = JSON.parse(atob(stateRaw));
    userId = state.userId;
  } catch {
    return Response.redirect('streakwar://oauth-error?reason=bad_state', 302);
  }

  let tokens: TokenResponse;
  let externalUserId: string | null = null;
  let expiresAt: Date | null = null;

  try {
    if (provider === 'strava') {
      tokens = await exchangeStrava(code);
      externalUserId = String(tokens.athlete?.id ?? '');
      if (tokens.expires_at) expiresAt = new Date(tokens.expires_at * 1000);
    } else if (provider === 'fitbit') {
      tokens = await exchangeFitbit(code);
      externalUserId = tokens.user_id ?? null;
      if (tokens.expires_in) expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    } else {
      return Response.redirect(`streakwar://oauth-error?reason=unknown_provider`, 302);
    }
  } catch (err) {
    console.error('Token exchange failed:', err);
    return Response.redirect('streakwar://oauth-error?reason=exchange_failed', 302);
  }

  const { error } = await supabase.from('device_connections').upsert({
    user_id: userId,
    provider,
    is_active: true,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_expires_at: expiresAt?.toISOString() ?? null,
    external_user_id: externalUserId,
    last_synced_at: null,
  }, { onConflict: 'user_id,provider' });

  if (error) {
    console.error('DB upsert failed:', error);
    return Response.redirect('streakwar://oauth-error?reason=db_error', 302);
  }

  // Register Strava webhook subscription if not already done
  if (provider === 'strava') {
    await ensureStravaWebhookSubscription();
  }

  return Response.redirect('streakwar://oauth-success?provider=' + provider, 302);
});

async function ensureStravaWebhookSubscription() {
  const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/strava-webhook`;
  // Check existing subscriptions
  const res = await fetch(`https://www.strava.com/api/v3/push_subscriptions?client_id=${Deno.env.get('STRAVA_CLIENT_ID')}&client_secret=${Deno.env.get('STRAVA_CLIENT_SECRET')}`);
  const subs = await res.json();
  if (Array.isArray(subs) && subs.length > 0) return; // already subscribed

  await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('STRAVA_CLIENT_ID'),
      client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
      callback_url: callbackUrl,
      verify_token: Deno.env.get('STRAVA_VERIFY_TOKEN') ?? 'streakwar_strava',
    }),
  });
}
