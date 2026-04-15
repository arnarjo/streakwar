// Runs every Monday at 00:01 UTC (set up cron in Supabase Dashboard)
// 1. Calculates final ranks for last week
// 2. Promotes/relegates users
// 3. Creates new league groups for this week
// 4. Sends push notifications

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;
type Tier = typeof TIERS[number];

function getLastMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff - 7);
  return monday.toISOString().slice(0, 10);
}

function getCurrentMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().slice(0, 10);
}

function nextTier(tier: Tier): Tier {
  const idx = TIERS.indexOf(tier);
  return TIERS[Math.min(idx + 1, TIERS.length - 1)];
}

function prevTier(tier: Tier): Tier {
  const idx = TIERS.indexOf(tier);
  return TIERS[Math.max(idx - 1, 0)];
}

Deno.serve(async () => {
  const lastWeek = getLastMonday();
  const thisWeek = getCurrentMonday();

  // ── Step 1: Finalise last week's groups ───────────────────────
  const { data: lastGroups } = await supabase
    .from('league_groups')
    .select('id, tier')
    .eq('week_start', lastWeek);

  for (const group of lastGroups ?? []) {
    const { data: rows } = await supabase
      .rpc('get_league_group_leaderboard', {
        p_group_id: group.id,
        p_week_start: lastWeek,
      });

    if (!rows || rows.length === 0) continue;

    const promotionCutoff = Math.min(5, rows.length);
    const relegationCutoff = Math.max(rows.length - 5, 0);

    for (let i = 0; i < rows.length; i++) {
      const member = rows[i];
      const rank = i + 1;
      const promoted = rank <= promotionCutoff && group.tier !== 'diamond';
      const relegated = rank > relegationCutoff && group.tier !== 'bronze';

      // Update membership final rank
      await supabase
        .from('league_memberships')
        .update({ final_rank: rank, promoted, relegated })
        .eq('user_id', member.user_id)
        .eq('week_start', lastWeek);

      // Update user's tier
      const newTier = promoted
        ? nextTier(group.tier as Tier)
        : relegated
          ? prevTier(group.tier as Tier)
          : group.tier;

      await supabase
        .from('user_league_tier')
        .upsert({ user_id: member.user_id, tier: newTier, updated_at: new Date().toISOString() });

      // Send push notification
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', member.user_id)
        .maybeSingle();

      if ((profile as any)?.push_token) {
        const title = promoted
          ? `Promoted to ${nextTier(group.tier as Tier)} league! 🎉`
          : relegated
            ? `Relegated to ${prevTier(group.tier as Tier)} league`
            : `League week complete`;
        const body = promoted
          ? `You finished #${rank} — keep it up! 🔥`
          : relegated
            ? `Finish in the top half next week to move back up`
            : `You finished #${rank} in ${group.tier} league`;

        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: (profile as any).push_token,
            title,
            body,
            sound: 'default',
          }),
        });
      }
    }
  }

  // ── Step 2: Create new groups for this week ────────────────────
  // Get all users grouped by tier
  const { data: allTiers } = await supabase
    .from('user_league_tier')
    .select('user_id, tier');

  const byTier: Record<Tier, string[]> = {
    bronze: [], silver: [], gold: [], platinum: [], diamond: [],
  };

  for (const row of allTiers ?? []) {
    byTier[row.tier as Tier].push(row.user_id);
  }

  // Add users not yet in any tier to bronze
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id');

  const tieredIds = new Set((allTiers ?? []).map(r => r.user_id));
  for (const p of allProfiles ?? []) {
    if (!tieredIds.has(p.id)) {
      byTier.bronze.push(p.id);
      await supabase.from('user_league_tier').upsert({ user_id: p.id, tier: 'bronze' });
    }
  }

  // Bucket each tier into groups of 20
  for (const tier of TIERS) {
    const users = byTier[tier];
    // Shuffle for fairness
    for (let i = users.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [users[i], users[j]] = [users[j], users[i]];
    }

    for (let i = 0; i < users.length; i += 20) {
      const chunk = users.slice(i, i + 20);
      if (chunk.length === 0) continue;

      // Create group
      const { data: group } = await supabase
        .from('league_groups')
        .insert({ tier, week_start: thisWeek })
        .select()
        .single();

      if (!group) continue;

      // Add members
      await supabase.from('league_memberships').insert(
        chunk.map(user_id => ({ user_id, group_id: group.id, week_start: thisWeek }))
      );
    }
  }

  return new Response(JSON.stringify({ ok: true, week: thisWeek }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
