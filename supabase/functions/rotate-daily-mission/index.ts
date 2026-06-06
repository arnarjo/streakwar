// supabase/functions/rotate-daily-mission/index.ts
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

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.error('CRON_SECRET not set');
    return new Response('Service unavailable', { status: 503 });
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  // Only run on Monday(1), Wednesday(3), Friday(5) UTC
  const dayOfWeek = today.getUTCDay();
  if (dayOfWeek !== 1 && dayOfWeek !== 3 && dayOfWeek !== 5) {
    return Response.json({ ok: true, skipped: true, reason: 'not a mission day', day: dayOfWeek });
  }

  // Idempotent: skip if today's daily challenge already exists
  const { data: existing } = await supabase
    .from('fitness_challenges')
    .select('id')
    .eq('is_global', true)
    .eq('renewal_type', 'daily')
    .eq('start_date', todayStr)
    .maybeSingle();

  if (existing) {
    return Response.json({ ok: true, skipped: true, reason: 'already exists', date: todayStr });
  }

  // Pick template deterministically by ISO week number
  const { data: templates, error: tErr } = await supabase
    .from('daily_mission_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (tErr || !templates || templates.length === 0) {
    console.error('Failed to fetch templates:', tErr);
    return Response.json({ ok: false, error: 'no templates' }, { status: 500 });
  }

  const weekOfYear = isoWeekNumber(today);
  const template = templates[weekOfYear % templates.length];

  const { error: insertErr } = await supabase.from('fitness_challenges').insert({
    name:                  template.name,
    description:           template.description,
    created_by:            null,
    start_date:            todayStr,
    end_date:              todayStr,
    status:                'active',
    scoring_modes:         template.scoring_modes,
    points_per_workout:    1,
    points_per_1000_steps: 1,
    points_per_km:         1,
    points_per_30min:      1,
    is_public:             true,
    is_global:             true,
    renewal_type:          'daily',
    tie_break_rule:        'most_recent_activity',
  });

  if (insertErr) {
    console.error('Insert failed:', insertErr);
    return Response.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  console.log(`Created daily mission "${template.name}" for ${todayStr} (week ${weekOfYear})`);
  return Response.json({ ok: true, name: template.name, date: todayStr });
});

/** Returns ISO week number (1–53) for a given Date */
function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
