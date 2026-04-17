-- StreakWar – Enforce max_participants at the database level
-- Run in Supabase SQL Editor after 007

-- BEFORE INSERT trigger that locks the challenge row (SELECT FOR UPDATE) before
-- counting current participants. The row lock serializes concurrent join attempts
-- for the same challenge, preventing the read-then-write race condition that
-- allows participant count to exceed max_participants.

create or replace function check_challenge_capacity()
returns trigger language plpgsql security definer as $$
declare
  v_max   integer;
  v_count integer;
begin
  -- Lock the challenge row for the duration of this transaction so concurrent
  -- inserts for the same challenge are serialized, not interleaved.
  select max_participants into v_max
    from fitness_challenges
   where id = new.challenge_id
     for update;

  -- Unlimited challenges skip the count check entirely.
  if v_max is null then return new; end if;

  select count(*) into v_count
    from challenge_participants
   where challenge_id = new.challenge_id;

  if v_count >= v_max then
    raise exception 'Challenge is full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger enforce_challenge_capacity
  before insert on challenge_participants
  for each row execute function check_challenge_capacity();
