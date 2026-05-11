import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ACTIVATE_EVENTS  = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION']);
const DEACTIVATE_EVENTS = new Set(['EXPIRATION', 'BILLING_ISSUE']);

serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const event = body?.event;
  const userId: string | undefined = event?.app_user_id;
  const eventType: string | undefined = event?.type;

  if (!userId || !eventType) {
    return new Response('OK', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  if (ACTIVATE_EVENTS.has(eventType)) {
    const expirationMs: number | undefined = event?.expiration_at_ms;
    await supabase
      .from('profiles')
      .update({
        is_pro: true,
        pro_expires_at: expirationMs ? new Date(expirationMs).toISOString() : null,
      })
      .eq('id', userId);
  } else if (DEACTIVATE_EVENTS.has(eventType)) {
    await supabase
      .from('profiles')
      .update({ is_pro: false, pro_expires_at: null })
      .eq('id', userId);
  }
  // CANCELLATION: keep pro until pro_expires_at â€” no update needed

  return new Response('OK', { status: 200 });
});
