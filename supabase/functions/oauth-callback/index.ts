/**
 * oauth-callback
 *
 * Receives the authorization code redirect from Strava / Garmin / Fitbit,
 * exchanges it for tokens, stores them in device_connections, then redirects
 * the user back to the app via deep link.
 *
 * Deep link: streakwar://oauth-success   (configure in app.json scheme)
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
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

const OAUTH_STATE_SECRET = Deno.env.get('OAUTH_STATE_SECRET') ?? '';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
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

/**
 * Verify the HMAC-signed state issued by oauth-init
 * (base64url(payload).base64url(HMAC-SHA256(payload, OAUTH_STATE_SECRET))).
 * Returns the parsed payload, or null when the signature is invalid/expired —
 * an unsigned/forged state can no longer bind a provider account to an
 * arbitrary victim userId (account-linking CSRF).
 */
async function verifyState(stateRaw: string): Promise<{ provider: string; userId: string; ts: number } | null> {
  if (!OAUTH_STATE_SECRET) return null;
  const dot = stateRaw.indexOf('.');
  if (dot < 0) return null;
  try {
    const payload = b64urlDecode(stateRaw.slice(0, dot));
    const sig = b64urlDecode(stateRaw.slice(dot + 1));
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(OAUTH_STATE_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const expected = String.fromCharCode(
      ...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))),
    );
    if (!timingSafeEqual(sig, expected)) return null;
    const state = JSON.parse(payload);
    if (!state.userId || !state.ts || Date.now() - state.ts > STATE_MAX_AGE_MS) return null;
    return state;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') ?? '';

  // Garmin uses OAuth 1.0a — no code/state; binding is enforced by matching
  // the one-time request token stored for this user_id by oauth-init.
  if (provider === 'garmin') {
    const garminUserId = url.searchParams.get('user_id') ?? '';
    if (!garminUserId) {
      return Response.redirect('streakwar://oauth-error?reason=missing_user', 302);
    }
    return handleGarminCallback(req, garminUserId);
  }

  const code = url.searchParams.get('code') ?? '';
  const stateRaw = url.searchParams.get('state') ?? '';

  if (!code || !stateRaw) {
    return Response.redirect('streakwar://oauth-error?reason=missing_code', 302);
  }

  const state = await verifyState(stateRaw);
  if (!state) {
    return Response.redirect('streakwar://oauth-error?reason=bad_state', 302);
  }
  const userId = state.userId;

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

  // Register per-user Fitbit activity subscription
  if (provider === 'fitbit') {
    await ensureFitbitSubscription(tokens.access_token);
  }

  return Response.redirect('streakwar://oauth-success?provider=' + provider, 302);
});

// â”€â”€â”€ Garmin OAuth 1.0a â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function hmacSha1(signingKey: string, baseString: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(baseString));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function buildOAuth1Header(
  method: string,
  url: string,
  oauthToken: string,
  oauthVerifier: string,
  consumerKey: string,
  consumerSecret: string,
  tokenSecret: string,
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: oauthToken,
    oauth_verifier: oauthVerifier,
    oauth_version: '1.0',
  };

  const paramString = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&');

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = await hmacSha1(signingKey, baseString);

  oauthParams.oauth_signature = signature;
  return 'OAuth ' + Object.entries(oauthParams)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ');
}

async function handleGarminCallback(req: Request, userId: string): Promise<Response> {
  const url = new URL(req.url);
  const oauthToken = url.searchParams.get('oauth_token') ?? '';
  const oauthVerifier = url.searchParams.get('oauth_verifier') ?? '';

  if (!oauthToken || !oauthVerifier) {
    return Response.redirect('streakwar://oauth-error?reason=missing_garmin_params', 302);
  }

  // Retrieve the request token secret stored by oauth-init
  const { data: conn } = await supabase
    .from('device_connections')
    .select('access_token, refresh_token')
    .eq('user_id', userId)
    .eq('provider', 'garmin')
    .eq('is_active', false)
    .single();

  const requestTokenSecret = conn?.refresh_token ?? '';
  if (!requestTokenSecret) {
    return Response.redirect('streakwar://oauth-error?reason=missing_request_secret', 302);
  }

  // The callback's oauth_token must match the one-time request token stored
  // for this user by oauth-init — binds the callback to the initiating user.
  if (conn?.access_token !== oauthToken) {
    return Response.redirect('streakwar://oauth-error?reason=token_mismatch', 302);
  }

  const consumerKey = Deno.env.get('GARMIN_CONSUMER_KEY') ?? '';
  const consumerSecret = Deno.env.get('GARMIN_CONSUMER_SECRET') ?? '';
  const accessTokenUrl = 'https://connect.garmin.com/oauth-service/oauth/access_token';

  const authHeader = await buildOAuth1Header(
    'POST', accessTokenUrl,
    oauthToken, oauthVerifier,
    consumerKey, consumerSecret, requestTokenSecret,
  );

  const res = await fetch(accessTokenUrl, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) {
    console.error('Garmin access token failed:', res.status, await res.text());
    return Response.redirect('streakwar://oauth-error?reason=garmin_token_failed', 302);
  }

  const body = await res.text();
  const params = new URLSearchParams(body);
  const accessToken = params.get('oauth_token') ?? '';
  const accessTokenSecret = params.get('oauth_token_secret') ?? '';

  if (!accessToken) {
    return Response.redirect('streakwar://oauth-error?reason=garmin_empty_token', 302);
  }

  // Store access token (access_token) + secret (refresh_token field) â€” Garmin has no expiry
  const { error } = await supabase.from('device_connections').upsert({
    user_id: userId,
    provider: 'garmin',
    is_active: true,
    access_token: accessToken,
    refresh_token: accessTokenSecret,  // Garmin token secret, never expires
    token_expires_at: null,
    external_user_id: null,
    last_synced_at: null,
  }, { onConflict: 'user_id,provider' });

  if (error) {
    console.error('Garmin DB upsert failed:', error);
    return Response.redirect('streakwar://oauth-error?reason=db_error', 302);
  }

  return Response.redirect('streakwar://oauth-success?provider=garmin', 302);
}

async function ensureFitbitSubscription(accessToken: string) {
  // Fitbit subscriptions are per-user. Subscribe to the activities collection.
  // If already subscribed, Fitbit returns 200 or 409 â€” both are fine.
  await fetch('https://api.fitbit.com/1/user/-/activities/apiSubscriptions/1.json', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

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
      verify_token: Deno.env.get('STRAVA_VERIFY_TOKEN') ?? '',
    }),
  });
}
