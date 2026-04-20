-- StreakWar – Premium subscription columns
-- Run in Supabase SQL Editor after 008

alter table profiles
  add column if not exists is_pro boolean not null default false,
  add column if not exists pro_expires_at timestamptz;

-- RLS: only Pro users can create challenges with photo proof
drop policy if exists "photo_proof_requires_pro" on fitness_challenges;
create policy "photo_proof_requires_pro" on fitness_challenges
  for insert with check (
    require_photo_proof = false
    or exists (
      select 1 from profiles where id = auth.uid() and is_pro = true
    )
  );
