-- StreakWar – Multi-type reactions + Trash talk
-- Run after 005

-- workout_reactions already exists — no schema change needed,
-- reaction column is already text. Just confirm it exists:
-- create table if not exists workout_reactions (already in 001)

-- ── Challenge trash talk ───────────────────────────────────────
create table if not exists challenge_messages (
  id           uuid primary key default uuid_generate_v4(),
  challenge_id uuid references fitness_challenges(id) on delete cascade not null,
  sender_id    uuid references profiles(id) on delete cascade not null,
  message_key  text not null,
  created_at   timestamptz default now()
);

alter table challenge_messages enable row level security;
drop policy if exists "Challenge messages readable by participants" on challenge_messages;
create policy "Challenge messages readable by participants" on challenge_messages
  for select using (
    exists (
      select 1 from challenge_participants
      where challenge_id = challenge_messages.challenge_id
        and user_id = auth.uid()
    )
  );
drop policy if exists "Challenge messages insertable by participants" on challenge_messages;
create policy "Challenge messages insertable by participants" on challenge_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from challenge_participants
      where challenge_id = challenge_messages.challenge_id
        and user_id = auth.uid()
    )
  );

create index if not exists idx_challenge_messages_challenge on challenge_messages(challenge_id, created_at desc);
