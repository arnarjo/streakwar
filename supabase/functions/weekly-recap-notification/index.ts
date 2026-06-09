// Runs every Monday at 08:00 UTC
// Sends "Your weekly recap is ready" push notification to all users

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.error('CRON_SECRET env var is not set');
    return new Response('Service unavailable', { status: 503 });
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { data: tokens, error } = await supabase
      .from('user_device_tokens')
      .select('user_id, push_token, profiles(full_name, username)')
      .not('push_token', 'is', null);

    if (error) throw error;

    let sent = 0;

    for (const row of tokens ?? []) {
      const profile = (row as any).profiles;
      const name = profile?.full_name?.split(' ')[0] ?? profile?.username ?? 'there';

      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: row.push_token,
            title: 'Your weekly recap is ready 📊',
            body: `See how you did this week, ${name}!`,
            sound: 'default',
            data: { screen: 'WeeklyRecap' },
          }),
        });
        sent++;
      } catch (_) {
        // ignore individual push failures
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
