-- Self-checking and rolled back, so it's safe to run against the hosted project.
-- Any failed check raises an exception. Run with `npm run db:test`.
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.com', 'authenticated', 'authenticated');

-- User A is in Los Angeles (UTC-7 in mid-October).
update public.profiles set timezone = 'America/Los_Angeles'
where id = '00000000-0000-4000-8000-00000000000a';

set local role authenticated;

-- User B: a completion on the same day, which A must never see.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.todos (id, title, completed_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'B''s todo', '2026-10-15 19:00:00+00');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.areas (id, name, type) values ('00000000-0000-4000-8000-0000000000a2', 'root', 'goal');
insert into public.areas (id, name, type, parent_id) values
  ('00000000-0000-4000-8000-0000000000a3', 'child', 'project', '00000000-0000-4000-8000-0000000000a2');
insert into public.todos (id, title, completed_at) values
  -- 23:30 on Oct 15 in Los Angeles, which is already Oct 16 in UTC.
  ('00000000-0000-4000-8000-0000000000a1', 'late', '2026-10-16 06:30:00+00'),
  -- Noon on Oct 15 in Los Angeles, in "child" under "root".
  ('00000000-0000-4000-8000-0000000000a4', 'nested', '2026-10-15 19:00:00+00'),
  ('00000000-0000-4000-8000-0000000000a5', 'open', null);
insert into public.todo_areas (todo_id, area_id) values
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a3');

do $$
declare
  late record;
  nested_areas jsonb;
begin
  -- Timezone boundary: the late completion is on the local Oct 15, not Oct 16.
  select * into late from public.review_completed('2026-10-15', '2026-10-15')
  where todo_id = '00000000-0000-4000-8000-0000000000a1';
  if late is null then
    raise exception '23:30 local completion missing from its local day';
  end if;
  if late.completed_local_date <> '2026-10-15' then
    raise exception 'completed_local_date is %, expected 2026-10-15', late.completed_local_date;
  end if;
  if late.areas <> '[]'::jsonb then
    raise exception 'unassigned todo has areas: %', late.areas;
  end if;
  if exists (
    select 1 from public.review_completed('2026-10-16', '2026-10-16')
    where todo_id = '00000000-0000-4000-8000-0000000000a1'
  ) then
    raise exception '23:30 local completion leaked into the UTC day';
  end if;

  -- Roll-up: the attached area is depth 0 and its parent is depth 1.
  select areas into nested_areas from public.review_completed('2026-10-15', '2026-10-15')
  where todo_id = '00000000-0000-4000-8000-0000000000a4';
  if jsonb_array_length(nested_areas) <> 2
    or nested_areas -> 0 ->> 'name' <> 'child' or (nested_areas -> 0 ->> 'depth')::int <> 0
    or nested_areas -> 1 ->> 'name' <> 'root' or (nested_areas -> 1 ->> 'depth')::int <> 1
    or nested_areas -> 0 ->> 'parent_id' <> '00000000-0000-4000-8000-0000000000a2'
  then
    raise exception 'unexpected areas for nested todo: %', nested_areas;
  end if;

  -- Only A's completed todos, and nothing outside the range.
  if (select count(*) from public.review_completed('2026-10-15', '2026-10-15')) <> 2 then
    raise exception 'expected exactly 2 completions on Oct 15';
  end if;
  if exists (
    select 1 from public.review_completed('2026-01-01', '2026-12-31')
    where todo_id in ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a5')
  ) then
    raise exception 'review included another user''s todo or an open todo';
  end if;
end;
$$;

-- Anonymous callers can't use the function at all.
reset role;
set local role anon;
do $$
begin
  perform public.review_completed('2026-10-15', '2026-10-15');
  raise exception 'anon could call review_completed';
exception
  when insufficient_privilege then null;
end;
$$;

rollback;
