/**
 * renew-challenges
 *
 * Runs daily (via Supabase cron or external scheduler).
 * Delegates entirely to the process_recurring_challenges() SQL function
 * (migration 018), which refreshes challenge statuses and creates the next
 * instance of every completed recurring challenge that has no child yet.
 *
 * The renewal logic used to be duplicated here in TypeScript and had already
 * diverged from the SQL (it kept the 2-day window bug that 018 fixed) — the
 * single source of truth is now the database function.
 *
 * Schedule in Supabase Dashboard → Edge Functions → Cron:
 *   0 1 * * *   (daily at 01:00 UTC)
 *
 * Or invoke manually:
 *   supabase functions invoke renew-challenges --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { error } = await supabase.rpc('process_recurring_challenges');
    if (error) {
      console.error('process_recurring_challenges failed:', error);
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('renew-challenges error:', err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
