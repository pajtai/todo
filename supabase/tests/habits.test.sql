-- Self-checking and rolled back, so it's safe to run against the hosted project.
-- Any failed check raises an exception. Run with `npm run db:test`.
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.com', 'authenticated', 'authenticated');

-- UTC+14, so "today" usually differs from the UTC date.
update public.profiles set timezone = 'Pacific/Kiritimati'
where id = '00000000-0000-4000-8000-00000000000a';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into public.areas (id, name, type, recurrence, recurrence_days, starts_on, habit_title) values
  ('00000000-0000-4000-8000-0000000000a1', 'Daily', 'habit', 'daily', null, '2026-11-01', 'Do the daily thing'),
  -- Mon, Wed, Fri.
  ('00000000-0000-4000-8000-0000000000a2', 'MWF', 'habit', 'weekdays', '{1,3,5}', '2026-11-01', null),
  -- Starts on a Monday, so it repeats on Mondays.
  ('00000000-0000-4000-8000-0000000000a3', 'Weekly', 'habit', 'weekly', null, '2026-11-02', null);
insert into public.areas (id, name, type, recurrence, starts_on, archived_at) values
  ('00000000-0000-4000-8000-0000000000a4', 'Archived', 'habit', 'daily', '2026-11-01', now());

do $$
declare
  created int;
begin
  -- Constraints.
  begin
    insert into public.areas (name, type, recurrence, starts_on) values ('P', 'project', 'daily', '2026-11-01');
    raise exception 'recurrence accepted on a project';
  exception when check_violation then null;
  end;
  begin
    insert into public.areas (name, type, recurrence) values ('No start', 'habit', 'daily');
    raise exception 'recurrence accepted without starts_on';
  exception when check_violation then null;
  end;
  begin
    insert into public.areas (name, type, recurrence, recurrence_days, starts_on)
    values ('Bad days', 'habit', 'weekdays', '{7}', '2026-11-01');
    raise exception 'weekday 7 accepted';
  exception when check_violation then null;
  end;

  -- Wed 2026-11-04: Daily and MWF occur; Weekly (Mondays) and Archived don't.
  created := public.ensure_habit_todos('2026-11-04');
  if created <> 2 then
    raise exception 'expected 2 todos on Wed, got %', created;
  end if;
  if public.ensure_habit_todos('2026-11-04') <> 0 then
    raise exception 'second call created duplicates';
  end if;
  if (select count(*) from public.todos where occurrence_date = '2026-11-04') <> 2 then
    raise exception 'duplicate occurrence rows';
  end if;
  if not exists (
    select 1 from public.todos t
    join public.todo_areas ta on ta.todo_id = t.id and ta.area_id = t.habit_area_id
    where t.habit_area_id = '00000000-0000-4000-8000-0000000000a1'
      and t.title = 'Do the daily thing'
  ) then
    raise exception 'daily todo missing its title template or todo_areas link';
  end if;
  if exists (select 1 from public.todos where habit_area_id = '00000000-0000-4000-8000-0000000000a4') then
    raise exception 'archived habit generated a todo';
  end if;

  -- Weekday rules.
  perform public.ensure_habit_todos('2026-11-03'); -- Tuesday
  if exists (select 1 from public.todos where habit_area_id = '00000000-0000-4000-8000-0000000000a2' and occurrence_date = '2026-11-03') then
    raise exception 'MWF habit generated on a Tuesday';
  end if;
  perform public.ensure_habit_todos('2026-11-09'); -- Monday
  if not exists (select 1 from public.todos where habit_area_id = '00000000-0000-4000-8000-0000000000a3' and occurrence_date = '2026-11-09') then
    raise exception 'weekly habit missing on its weekday';
  end if;
  perform public.ensure_habit_todos('2026-11-10'); -- Tuesday
  if exists (select 1 from public.todos where habit_area_id = '00000000-0000-4000-8000-0000000000a3' and occurrence_date = '2026-11-10') then
    raise exception 'weekly habit generated on the wrong weekday';
  end if;
  if exists (select 1 from public.todos where occurrence_date < '2026-11-03') then
    raise exception 'past occurrences were backfilled';
  end if;

  -- "Today" comes from the profile's timezone.
  if public.user_today() <> (now() at time zone 'Pacific/Kiritimati')::date then
    raise exception 'user_today ignores the profile timezone';
  end if;
  perform public.ensure_habit_todos();
  if not exists (
    select 1 from public.todos
    where habit_area_id = '00000000-0000-4000-8000-0000000000a1'
      and occurrence_date = (now() at time zone 'Pacific/Kiritimati')::date
  ) then
    raise exception 'default call did not use the local today';
  end if;

  -- Changing a rule keeps existing occurrences.
  update public.todos set completed_at = now()
  where habit_area_id = '00000000-0000-4000-8000-0000000000a1' and occurrence_date = '2026-11-04';
  update public.areas set recurrence = 'weekdays', recurrence_days = '{0}'
  where id = '00000000-0000-4000-8000-0000000000a1';
  if not exists (
    select 1 from public.todos
    where habit_area_id = '00000000-0000-4000-8000-0000000000a1'
      and occurrence_date = '2026-11-04' and completed_at is not null
  ) then
    raise exception 'changing the rule removed a completed occurrence';
  end if;
end;
$$;

-- Streaks, relative to the real today.
insert into public.areas (id, name, type, recurrence, starts_on) values
  ('00000000-0000-4000-8000-0000000000a5', 'Streak', 'habit', 'daily', public.user_today() - 5);
insert into public.todos (title, habit_area_id, occurrence_date, completed_at) values
  ('s', '00000000-0000-4000-8000-0000000000a5', public.user_today() - 1, now()),
  ('s', '00000000-0000-4000-8000-0000000000a5', public.user_today() - 2, now()),
  ('s', '00000000-0000-4000-8000-0000000000a5', public.user_today() - 4, now()),
  -- Generated but not completed: still a miss.
  ('s', '00000000-0000-4000-8000-0000000000a5', public.user_today() - 3, null);

do $$
declare
  s record;
begin
  -- Days -5 and -3 missed, -4, -2, -1 done, today still open.
  select * into s from public.habit_streaks() where area_id = '00000000-0000-4000-8000-0000000000a5';
  if s.current_streak <> 2 or s.completed_30 <> 3 or s.expected_30 <> 5 then
    raise exception 'unexpected streak before today: %', s;
  end if;

  perform public.ensure_habit_todos();
  update public.todos set completed_at = now()
  where habit_area_id = '00000000-0000-4000-8000-0000000000a5' and occurrence_date = public.user_today();

  select * into s from public.habit_streaks() where area_id = '00000000-0000-4000-8000-0000000000a5';
  if s.current_streak <> 3 or s.completed_30 <> 4 or s.expected_30 <> 6 then
    raise exception 'unexpected streak after completing today: %', s;
  end if;

  if (select count(*) from public.habit_occurrences(public.user_today() - 2, public.user_today() + 5)
      where area_id = '00000000-0000-4000-8000-0000000000a5') <> 3 then
    raise exception 'habit_occurrences should stop at today';
  end if;
end;
$$;

-- Completions recorded before starts_on still count toward the streak.
insert into public.areas (id, name, type, recurrence, starts_on) values
  ('00000000-0000-4000-8000-0000000000a6', 'Backfilled', 'habit', 'daily', public.user_today());
insert into public.todos (title, habit_area_id, occurrence_date, completed_at) values
  ('b', '00000000-0000-4000-8000-0000000000a6', public.user_today() - 1, now()),
  ('b', '00000000-0000-4000-8000-0000000000a6', public.user_today() - 2, now()),
  ('b', '00000000-0000-4000-8000-0000000000a6', public.user_today(), now());

do $$
declare
  s record;
begin
  select * into s from public.habit_streaks() where area_id = '00000000-0000-4000-8000-0000000000a6';
  if s.current_streak <> 3 or s.expected_30 <> 3 then
    raise exception 'backfilled completions not counted: %', s;
  end if;
end;
$$;

-- Another user: can't see A's habits and can't block A's occurrences.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.todos (title, habit_area_id, occurrence_date) values
  ('squat', '00000000-0000-4000-8000-0000000000a2', '2026-11-06');

do $$
begin
  if public.ensure_habit_todos('2026-11-06') <> 0 then
    raise exception 'user B generated todos from user A''s habits';
  end if;
  if exists (select 1 from public.habit_occurrences('2026-01-01', '2026-12-31'))
    or exists (select 1 from public.habit_streaks()) then
    raise exception 'user B can see user A''s habit data';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
begin
  perform public.ensure_habit_todos('2026-11-06'); -- Friday
  if not exists (
    select 1 from public.todos
    where habit_area_id = '00000000-0000-4000-8000-0000000000a2' and occurrence_date = '2026-11-06'
  ) then
    raise exception 'another user''s row blocked an occurrence';
  end if;
end;
$$;

rollback;
