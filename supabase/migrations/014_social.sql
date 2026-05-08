-- Nudges: "hvetja" button + leaderboard emoji reactions
create table if not exists nudges (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  message     text not null default 'Get moving! 💪',
  emoji       text,
  nudge_date  date not null default current_date,
  created_at  timestamptz default now(),
  seen        boolean default false,
  unique(sender_id, receiver_id, nudge_date)
);
alter table nudges enable row level security;
create policy "nudge_insert"  on nudges for insert with check (auth.uid() = sender_id);
create policy "nudge_select"  on nudges for select  using  (auth.uid() = receiver_id or auth.uid() = sender_id);
create policy "nudge_update"  on nudges for update  using  (auth.uid() = receiver_id);

-- Streak milestones (auto-inserted client-side when streak crosses threshold)
create table if not exists streak_milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles(id) on delete cascade not null,
  streak_count int not null,
  achieved_at  timestamptz default now(),
  unique(user_id, streak_count)
);
alter table streak_milestones enable row level security;
create policy "milestone_read"   on streak_milestones for select using (true);
create policy "milestone_insert" on streak_milestones for insert with check (auth.uid() = user_id);

-- Reactions on streak milestones
create table if not exists milestone_reactions (
  id           uuid primary key default gen_random_uuid(),
  milestone_id uuid references streak_milestones(id) on delete cascade not null,
  user_id      uuid references profiles(id) on delete cascade not null,
  reaction     text not null,
  created_at   timestamptz default now(),
  unique(milestone_id, user_id)
);
alter table milestone_reactions enable row level security;
create policy "milestone_reaction_read"   on milestone_reactions for select using (true);
create policy "milestone_reaction_insert" on milestone_reactions for insert with check (auth.uid() = user_id);
create policy "milestone_reaction_delete" on milestone_reactions for delete using  (auth.uid() = user_id);
