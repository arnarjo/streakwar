/**
 * renew-challenges
 *
 * Runs daily (via Supabase cron or external scheduler).
 * 1. Updates challenge statuses based on current date.
 * 2. Creates the next instance of every recurring challenge that just ended.
 *
 * Schedule in Supabase Dashboard â†’ Edge Functions â†’ Cron:
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
  // Allow manual POST trigger with optional auth header
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Step 1 â€” refresh all challenge statuses
    await supabase.rpc('refresh_challenge_statuses');

    // Step 2 â€” find recurring challenges that just completed
    const today = new Date().toISOString().slice(0, 10);

    // No time-window restriction — NOT EXISTS in the loop prevents duplicate instances.
    // This ensures chains that were missed by the cron get caught on the next run.
    const { data: expired, error: fetchErr } = await supabase
      .from('fitness_challenges')
      .select('*')
      .neq('renewal_type', 'none')
      .eq('status', 'completed')
      .lte('end_date', today);

    if (fetchErr) {
      console.error('Failed to fetch expired recurring challenges:', fetchErr);
      return Response.json({ ok: false, error: fetchErr.message }, { status: 500 });
    }

    const renewed: string[] = [];

    for (const challenge of (expired ?? [])) {
      // Check if a next instance already exists (avoid double-renewal)
      const { data: alreadyRenewed } = await supabase
        .from('fitness_challenges')
        .select('id')
        .eq('parent_challenge_id', challenge.id)
        .maybeSingle();

      if (alreadyRenewed) continue;

      // Calculate next start/end dates
      const { startDate, endDate } = nextDateRange(
        challenge.renewal_type as 'weekly' | 'monthly',
        challenge.end_date,
      );

      const { error: insertErr } = await supabase.from('fitness_challenges').insert({
        name:                  nextName(challenge.name, challenge.renewal_type),
        description:           challenge.description,
        cover_image_url:       challenge.cover_image_url,
        created_by:            challenge.created_by,
        start_date:            startDate,
        end_date:              endDate,
        status:                startDate <= today ? 'active' : 'upcoming',
        scoring_modes:         challenge.scoring_modes,
        points_per_workout:    challenge.points_per_workout,
        points_per_1000_steps: challenge.points_per_1000_steps,
        points_per_km:         challenge.points_per_km,
        points_per_30min:      challenge.points_per_30min,
        backlog_days_allowed:  challenge.backlog_days_allowed,
        require_photo_proof:   challenge.require_photo_proof,
        is_teams_mode:         challenge.is_teams_mode,
        tie_break_rule:        challenge.tie_break_rule,
        is_public:             challenge.is_public,
        is_global:             challenge.is_global,
        renewal_type:          challenge.renewal_type,
        parent_challenge_id:   challenge.id,
        max_participants:      challenge.max_participants,
      });

      if (insertErr) {
        console.error(`Failed to renew challenge ${challenge.id}:`, insertErr);
      } else {
        renewed.push(challenge.id);
        console.log(`Renewed challenge "${challenge.name}" â†’ ${startDate} to ${endDate}`);
      }
    }

    return Response.json({
      ok: true,
      renewed: renewed.length,
      ids: renewed,
    });
  } catch (err) {
    console.error('renew-challenges error:', err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});

/** Calculate start/end for the next renewal period */
function nextDateRange(
  type: 'weekly' | 'monthly',
  previousEndDate: string,
): { startDate: string; endDate: string } {
  const prev = new Date(previousEndDate + 'T12:00:00Z'); // noon to avoid DST issues

  if (type === 'weekly') {
    const start = new Date(prev);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  // Monthly: 1st to last day of next calendar month
  const start = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
  const end = new Date(prev.getFullYear(), prev.getMonth() + 2, 0); // day 0 = last day of prev month
  return {
    startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`,
    endDate: end.toISOString().slice(0, 10),
  };
}

/** Strip trailing " ðŸ”¥" / " ðŸ†" variants and return a clean recurring name */
function nextName(name: string, renewalType: string): string {
  // Keep the base name unchanged â€” the UI appends "Vika X" labels dynamically
  return name;
}
