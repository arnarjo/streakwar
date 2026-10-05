-- Preparation only until executed against a fresh disposable local stack.
-- NEVER run in hosted SQL Editor. The wrapper fixes host/port and strips PG overrides.
begin;
set local statement_timeout = '10s';
set local lock_timeout = '3s';

do $$
begin
  if current_setting('streakwar.test_environment', true) is distinct from 'synthetic-local-only' then
    raise exception 'Refusing unmarked database. Provision a disposable local stack first.';
  end if;
  if exists (select 1 from auth.users) then
    raise exception 'Refusing non-empty auth database. Never clear an existing database to pass this guard.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated' and not rolsuper and not rolbypassrls) then
    raise exception 'Authenticated role missing or bypasses RLS';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in ('device_connections', 'workout_posts') and c.relrowsecurity) <> 2 then
    raise exception 'Expected both health tables to have RLS enabled';
  end if;
end $$;

-- The repository signup trigger creates profiles; no auth API, email or provider call.
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'health-a@example.invalid', '{"username":"synthetic_health_a"}'),
  ('10000000-0000-4000-8000-000000000002', 'health-b@example.invalid', '{"username":"synthetic_health_b"}');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.device_connections (user_id, provider, is_active)
values (auth.uid(), 'health_connect', true);
insert into public.workout_posts (user_id, activity_type, source, external_activity_id, duration_minutes)
values (auth.uid(), 'running', 'health_connect', 'synthetic-workout-1', 30);

do $$
declare affected integer;
begin
  if (select count(*) from public.device_connections) <> 1 then raise exception 'Owner cannot read connection'; end if;
  if (select count(*) from public.workout_posts) <> 1 then raise exception 'Owner cannot read workout'; end if;
  update public.device_connections set last_synced_at = now() where user_id = auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner connection status update did not affect one row'; end if;
  begin
    insert into public.device_connections (user_id, provider)
    values ('10000000-0000-4000-8000-000000000002', 'health_connect');
    raise exception 'Cross-account connection insert unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.workout_posts (user_id, activity_type, source, external_activity_id)
    values ('10000000-0000-4000-8000-000000000002', 'running', 'health_connect', 'forbidden');
    raise exception 'Cross-account workout insert unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.workout_posts (user_id, activity_type, source, external_activity_id)
    values (auth.uid(), 'running', 'health_connect', 'synthetic-workout-1');
    raise exception 'Duplicate workout unexpectedly allowed';
  exception when unique_violation then null;
  end;
  -- Characterize migration 002: IDs collide across sources for the SAME user.
  -- This is existing behavior, not approval of a future ingestion contract.
  begin
    insert into public.workout_posts (user_id, activity_type, source, external_activity_id)
    values (auth.uid(), 'running', 'strava', 'synthetic-workout-1');
    raise exception 'Expected existing cross-source uniqueness constraint';
  exception when unique_violation then null;
  end;
end $$;

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
declare affected integer;
begin
  if exists (select 1 from public.device_connections) then raise exception 'B can read A connection'; end if;
  if exists (select 1 from public.workout_posts) then raise exception 'B can read A private standalone workout'; end if;
  update public.device_connections set is_active = false
    where user_id = '10000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B can change A connection'; end if;
  update public.workout_posts set steps = 9999
    where user_id = '10000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B can change A workout'; end if;
  delete from public.workout_posts where user_id = '10000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'B can delete A workout'; end if;
end $$;

-- Same external ID for a DIFFERENT user must be allowed.
insert into public.workout_posts (user_id, activity_type, source, external_activity_id, duration_minutes)
values (auth.uid(), 'running', 'health_connect', 'synthetic-workout-1', 30);

set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  if exists (select 1 from public.device_connections) then raise exception 'Anonymous connection read allowed'; end if;
  if exists (select 1 from public.workout_posts) then raise exception 'Anonymous workout read allowed'; end if;
end $$;

reset role;
rollback;
\echo 'PASS: local synthetic health ownership and dedup assertions; fixtures rolled back.'
