import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { receiver_id, emoji } = await req.json();
  if (!receiver_id) return new Response('Missing receiver_id', { status: 400 });

  const sender_id = user.id;
  if (sender_id === receiver_id) return new Response('Cannot nudge yourself', { status: 400 });

  // Rate limit: check if already nudged today
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from('nudges')
    .select('id')
    .eq('sender_id', sender_id)
    .eq('receiver_id', receiver_id)
    .eq('nudge_date', today)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ error: 'already_nudged_today' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { data: sender } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', sender_id)
    .single();

  const senderName = sender?.full_name ?? sender?.username ?? 'Someone';
  const notifBody = emoji
    ? `${senderName} sent you ${emoji}`
    : `${senderName} is cheering you on! 💪`;

  const message = emoji ? `${senderName} sent you ${emoji}` : `Get moving! 💪`;

  await supabase.from('nudges').insert({ sender_id, receiver_id, message, emoji: emoji ?? null });

  const { data: receiver } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', receiver_id)
    .single();

  if (receiver?.push_token) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        to: receiver.push_token,
        title: emoji ? `${emoji} Reaction` : '💪 Nudge!',
        body: notifBody,
        data: { type: 'nudge' },
        sound: 'default',
      }),
    });
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
