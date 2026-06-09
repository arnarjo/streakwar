/**
 * oauth-init
 *
 * Kicks off the OAuth dance for Strava, Garmin, or Fitbit.
 * Called from the app via: ${SUPABASE_URL}/functions/v1/oauth-init?provider=strava&user_id=<uuid>
 *
 * - Strava / Fitbit: OAuth 2.0 â€” redirect straight to provider authorization URL.
 * - Garmin: OAuth 1.0a â€” must fetch a request token first, then redirect.
 *
 * GARMIN SETUP (needs env vars):
 *   GARMIN_CONSUMER_KEY    â€” from developer.garmin.com
 *   GARMIN_CONSUMER_SECRET â€” from developer.garmin.com
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(
  supabaseUrl,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function createSignedState(data: object): Promise<string> {
  const payload = JSON.stringify(data);
  const secret = Deno.env.get('OAUTH_STATE_SECRET');
  if (!secret) throw new Error('OAUTH_STATE_SECRET not set');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return btoa(JSON.stringify({ payload, sig: sigHex }));
}

const CALLBACK_BASE = supabaseUrl + '/functions/v1/oauth-callback';

// â”€â”€â”€ OAuth 2.0 providers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const OAUTH2_CONFIGS: Record<string, {
  authUrl: string;
  clientId: string;
  scopes: string;
  extraParams?: Record<string, string>;
}> = {
  strava: {
    authUrl: 'https://www.strava.com/oauth/authorize',
    clientId: Deno.env.get('STRAVA_CLIENT_ID') ?? '',
    scopes: 'activity:read_all',
  },
  fitbit: {
    authUrl: 'https://www.fitbit.com/oauth2/authorize',
    clientId: Deno.env.get('FITBIT_CLIENT_ID') ?? '',
    scopes: 'activity profile',
    extraParams: { response_type: 'code', prompt: 'login consent' },
  },
};

// â”€â”€â”€ OAuth 1.0a helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  extraParams: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  tokenSecret = '',
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...extraParams,
  };

  const allParams = { ...oauthParams };
  const paramString = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&');

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = await hmacSha1(signingKey, baseString);

  oauthParams.oauth_signature = signature;

  const headerValue = 'OAuth ' + Object.entries(oauthParams)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ');

  return headerValue;
}

// â”€â”€â”€ Garmin OAuth 1.0a init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function handleGarminInit(userId: string): Promise<Response> {
  const consumerKey = Deno.env.get('GARMIN_CONSUMER_KEY') ?? '';
  const consumerSecret = Deno.env.get('GARMIN_CONSUMER_SECRET') ?? '';

  if (!consumerKey || !consumerSecret) {
    return new Response('Garmin credentials not configured', { status: 503 });
  }

  const requestTokenUrl = 'https://connect.garmin.com/oauth-service/oauth/request_token';
  const callbackUrl = `${CALLBACK_BASE}?provider=garmin`;

  const authHeader = await buildOAuth1Header(
    'POST', requestTokenUrl,
    { oauth_callback: callbackUrl },
    consumerKey, consumerSecret,
  );

  const res = await fetch(requestTokenUrl, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('Garmin request token failed:', res.status, body);
    return new Response('Garmin request token error', { status: 502 });
  }

  const body = await res.text();
  const params = new URLSearchParams(body);
  const oauthToken = params.get('oauth_token');
  const oauthTokenSecret = params.get('oauth_token_secret');

  if (!oauthToken || !oauthTokenSecret) {
    return new Response('Garmin returned empty tokens', { status: 502 });
  }

  // Store request token secret so the callback can retrieve it.
  // We use the device_connections row with is_active=false as a temp holder.
  // Tokens are encrypted; external_token_ref holds the plaintext oauthToken for lookup.
  await supabase.rpc('upsert_encrypted_device_tokens', {
    p_user_id: userId,
    p_provider: 'garmin',
    p_access_token: oauthToken,
    p_refresh_token: oauthTokenSecret,
    p_external_user_id: null,
    p_token_expires_at: null,
    p_is_active: false,
    p_scope: null,
  });
  // Also set external_token_ref for lookup in oauth-callback
  await supabase.from('device_connections')
    .update({ external_token_ref: oauthToken })
    .eq('user_id', userId)
    .eq('provider', 'garmin')
    .eq('is_active', false);

  const authorizeUrl = `https://connect.garmin.com/oauth-service/oauth/authorize?oauth_token=${oauthToken}`;
  return Response.redirect(authorizeUrl, 302);
}

// â”€â”€â”€ Main handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

serve(async (req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider');

  if (!provider) {
    return new Response('Missing provider', { status: 400 });
  }

  // Extract userId from JWT instead of query param
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return new Response('Unauthorized', { status: 401 });
  const userId = user.id;

  // Garmin uses OAuth 1.0a — special handling
  if (provider === 'garmin') {
    return handleGarminInit(userId);
  }

  const config = OAUTH2_CONFIGS[provider];
  if (!config) {
    return new Response(`Unknown provider: ${provider}`, { status: 400 });
  }

  const state = await createSignedState({ provider, userId, ts: Date.now() });
  const redirectUri = `${CALLBACK_BASE}?provider=${provider}`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scopes,
    state,
    response_type: 'code',
    ...(config.extraParams ?? {}),
  });

  return Response.redirect(`${config.authUrl}?${params.toString()}`, 302);
});
