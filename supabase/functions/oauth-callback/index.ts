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

async function verifyAndParseState(stateRaw: string): Promise<{provider: string, userId: string, ts: number}> {
  const { payload, sig } = JSON.parse(atob(stateRaw));
  const secret = Deno.env.get('OAUTH_STATE_SECRET');
  if (!secret) throw new Error('OAUTH_STATE_SECRET not set');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const sigBytes = Uint8Array.from(sig.match(/../g)!.map((h: string) => parseInt(h, 16)));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
  if (!valid) throw new Error('Invalid state signature');
  const data = JSON.parse(payload);
  // Check state is not older than 10 minutes
  if (Date.now() - data.ts > 10 * 60 * 1000) throw new Error('State expired');
  return data;
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
  if (!res.ok) throw new Error(await res.text());
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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

serve(async (req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') ?? '';

  // Garmin uses OAuth 1.0a — no state param, handle before any OAuth 2.0 logic
  if (provider === 'garmin') {
    const oauthToken = url.searchParams.get('oauth_token') ?? '';
    if (!oauthToken) {
      return Response.redirect('streakwar://oauth-error?reason=missing_garmin_params', 302);
    }
    // Look up the userId from the pending (is_active=false) device_connection row
    // that was created during oauth-init when the request token was stored.
    // Uses external_token_ref (plaintext) for lookup; decrypts refresh_token as request_token_secret.
    const { data: tokenRows } = await supabase
      .rpc('find_garmin_pending', { p_oauth_token: oauthToken });
    const tokenRow = tokenRows?.[0] ?? null;
    if (!tokenRow) {
      return Response.redirect('streakwar://oauth-error?reason=missing_request_secret', 302);
    }
    return handleGarminCallback(req, tokenRow.user_id, tokenRow.request_token_secret);
  }

  const code = url.searchParams.get('code') ?? '';
  const stateRaw = url.searchParams.get('state') ?? '';

  if (!code || !stateRaw) {
    return Response.redirect('streakwar://oauth-error?reason=missing_code', 302);
  }

  let userId: string;
  try {
    const state = await verifyAndParseState(stateRaw);
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

  const { error } = await supabase.rpc('upsert_encrypted_device_tokens', {
    p_user_id: userId,
    p_provider: provider,
    p_access_token: tokens.access_token,
    p_refresh_token: tokens.refresh_token ?? null,
    p_external_user_id: externalUserId,
    p_token_expires_at: expiresAt?.toISOString() ?? null,
    p_is_active: true,
    p_scope: null,
  });

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

async function handleGarminCallback(req: Request, userId: string, requestTokenSecret: string): Promise<Response> {
  const url = new URL(req.url);
  const oauthToken = url.searchParams.get('oauth_token') ?? '';
  const oauthVerifier = url.searchParams.get('oauth_verifier') ?? '';

  if (!oauthToken || !oauthVerifier) {
    return Response.redirect('streakwar://oauth-error?reason=missing_garmin_params', 302);
  }

  // requestTokenSecret was already decrypted by find_garmin_pending in the caller
  if (!requestTokenSecret) {
    return Response.redirect('streakwar://oauth-error?reason=missing_request_secret', 302);
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

  // Store access token (access_token) + secret (refresh_token field) — Garmin has no expiry
  const { error } = await supabase.rpc('upsert_encrypted_device_tokens', {
    p_user_id: userId,
    p_provider: 'garmin',
    p_access_token: accessToken,
    p_refresh_token: accessTokenSecret,  // Garmin token secret, never expires
    p_external_user_id: null,
    p_token_expires_at: null,
    p_is_active: true,
    p_scope: null,
  });

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
      verify_token: Deno.env.get('STRAVA_VERIFY_TOKEN') ?? 'streakwar_strava',
    }),
  });
}
