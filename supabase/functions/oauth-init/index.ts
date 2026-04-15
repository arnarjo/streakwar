/**
 * oauth-init
 *
 * Kicks off the OAuth dance for Strava, Garmin, or Fitbit.
 * Called from the app via: ${SUPABASE_URL}/functions/v1/oauth-init?provider=strava&user_id=<uuid>
 *
 * Redirects the user's browser to the provider's authorization URL.
 * After the user grants access the provider redirects to oauth-callback.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const OAUTH_CONFIGS: Record<string, {
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
  garmin: {
    authUrl: 'https://connect.garmin.com/oauthConfirm',
    clientId: Deno.env.get('GARMIN_CONSUMER_KEY') ?? '',
    scopes: '',
  },
  fitbit: {
    authUrl: 'https://www.fitbit.com/oauth2/authorize',
    clientId: Deno.env.get('FITBIT_CLIENT_ID') ?? '',
    scopes: 'activity profile',
    extraParams: { response_type: 'code', prompt: 'login consent' },
  },
};

const CALLBACK_BASE = Deno.env.get('SUPABASE_URL') + '/functions/v1/oauth-callback';

serve(async (req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider');
  const userId = url.searchParams.get('user_id');

  if (!provider || !userId) {
    return new Response('Missing provider or user_id', { status: 400 });
  }

  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    return new Response(`Unknown provider: ${provider}`, { status: 400 });
  }

  const state = btoa(JSON.stringify({ provider, userId, ts: Date.now() }));
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
