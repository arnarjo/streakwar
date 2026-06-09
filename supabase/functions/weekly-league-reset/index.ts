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

// Helper to chunk arrays for batch processing
const chunkArray = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
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
    const lastWeek = getLastMonday();
    const thisWeek = getCurrentMonday();

    // ── Step 1: Finalise last week's groups ───────────────────────
    const { data: lastGroups, error: lastGroupsError } = await supabase
      .from('league_groups')
      .select('id, tier')
      .eq('week_start', lastWeek);

    if (lastGroupsError) throw new Error(`Failed to fetch last week's groups: ${lastGroupsError.message}`);

    for (const group of lastGroups ?? []) {
      // Add type guard for tier
      if (!TIERS.includes(group.tier as Tier)) continue;

      const { data: rows, error: rowsError } = await supabase
        .rpc('get_league_group_leaderboard', {
          p_group_id: group.id,
          p_week_start: lastWeek,
        });

      if (rowsError) throw new Error(`Failed to get leaderboard for group ${group.id}: ${rowsError.message}`);
      if (!rows || rows.length === 0) continue;

      const promotionCutoff = Math.min(5, rows.length);
      const relegationCutoff = Math.max(rows.length - 5, 0);

      // Collect all updates and notifications for batch processing
      const membershipUpdates = [];
      const tierUpserts = [];
      const pushNotifications: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const member = rows[i];
        const rank = i + 1;
        const promoted = rank <= promotionCutoff && group.tier !== 'diamond';
        const relegated = rank > relegationCutoff && group.tier !== 'bronze';

        // Collect membership update
        membershipUpdates.push({
          user_id: member.user_id,
          week_start: lastWeek,
          final_rank: rank,
          promoted,
          relegated,
        });

        // Collect tier upsert
        const newTier = promoted
          ? nextTier(group.tier as Tier)
          : relegated
            ? prevTier(group.tier as Tier)
            : group.tier;

        tierUpserts.push({
          user_id: member.user_id,
          tier: newTier,
          updated_at: new Date().toISOString(),
        });

        // Prepare push notification info (will fetch tokens and batch later)
        pushNotifications.push({
          user_id: member.user_id,
          rank,
          promoted,
          relegated,
          tier: group.tier as Tier,
        });
      }

      // Batch update memberships
      if (membershipUpdates.length > 0) {
        const { error: batchUpdateError } = await supabase
          .from('league_memberships')
          .upsert(membershipUpdates, { onConflict: 'user_id,week_start' });

        if (batchUpdateError) throw new Error(`Failed to batch update memberships: ${batchUpdateError.message}`);
      }

      // Batch upsert tiers
      if (tierUpserts.length > 0) {
        const { error: batchUpsertError } = await supabase
          .from('user_league_tier')
          .upsert(tierUpserts, { onConflict: 'user_id' });

        if (batchUpsertError) throw new Error(`Failed to batch upsert tiers: ${batchUpsertError.message}`);
      }

      // Fetch all push tokens for this group in one query
      if (pushNotifications.length > 0) {
        const userIds = pushNotifications.map(n => n.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, push_token')
          .in('id', userIds);

        if (profilesError) throw new Error(`Failed to fetch profiles: ${profilesError.message}`);

        const tokenMap = new Map((profiles ?? []).map(p => [p.id, p.push_token]));

        // Build expo push notifications
        const expoNotifications = pushNotifications
          .filter(n => tokenMap.has(n.user_id) && tokenMap.get(n.user_id))
          .map(n => {
            const title = n.promoted
              ? `Promoted to ${nextTier(n.tier as Tier)} league! 🎉`
              : n.relegated
                ? `Relegated to ${prevTier(n.tier as Tier)} league`
                : `League week complete`;
            const body = n.promoted
              ? `You finished #${n.rank} — keep it up! 🔥`
              : n.relegated
                ? `Finish in the top half next week to move back up`
                : `You finished #${n.rank} in ${n.tier} league`;

            return {
              to: tokenMap.get(n.user_id)!,
              title,
              body,
              sound: 'default',
            };
          });

        // Send notifications in batches of 100 (Expo API limit)
        if (expoNotifications.length > 0) {
          for (const batch of chunkArray(expoNotifications, 100)) {
            try {
              await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch),
              });
            } catch (_) {
              // ignore batch push failures
            }
          }
        }
      }
    }

    // ── Step 2: Create new groups for this week ────────────────────
    // Get all users grouped by tier
    const { data: allTiers, error: allTiersError } = await supabase
      .from('user_league_tier')
      .select('user_id, tier');

    if (allTiersError) throw new Error(`Failed to fetch user tiers: ${allTiersError.message}`);

    const byTier: Record<Tier, string[]> = {
      bronze: [], silver: [], gold: [], platinum: [], diamond: [],
    };

    for (const row of allTiers ?? []) {
      byTier[row.tier as Tier].push(row.user_id);
    }

    // Add users not yet in any tier to bronze
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from('profiles')
      .select('id');

    if (allProfilesError) throw new Error(`Failed to fetch all profiles: ${allProfilesError.message}`);

    const tieredIds = new Set((allTiers ?? []).map(r => r.user_id));
    const newBronzeUsers = [];
    for (const p of allProfiles ?? []) {
      if (!tieredIds.has(p.id)) {
        byTier.bronze.push(p.id);
        newBronzeUsers.push({ user_id: p.id, tier: 'bronze' });
      }
    }

    // Batch upsert new users to bronze tier
    if (newBronzeUsers.length > 0) {
      const { error: newUserError } = await supabase.from('user_league_tier').upsert(newBronzeUsers, { onConflict: 'user_id' });
      if (newUserError) throw new Error(`Failed to add new users to bronze tier: ${newUserError.message}`);
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
        const { data: group, error: createGroupError } = await supabase
          .from('league_groups')
          .insert({ tier, week_start: thisWeek })
          .select()
          .single();

        if (createGroupError) throw new Error(`Failed to create group for tier ${tier}: ${createGroupError.message}`);
        if (!group) continue;

        // Add members
        const { error: addMembersError } = await supabase.from('league_memberships').insert(
          chunk.map(user_id => ({ user_id, group_id: group.id, week_start: thisWeek }))
        );

        if (addMembersError) throw new Error(`Failed to add members to group ${group.id}: ${addMembersError.message}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, week: thisWeek }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
