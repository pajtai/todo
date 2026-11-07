-- Self-checking and rolled back, so it's safe to run against the hosted project.
-- Any failed check raises an exception. Run with `npm run db:test`.
--
-- Repeat rules live on tasks (todo_series); habits are areas tasks attach to.
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.com', 'authenticated', 'authenticated');

-- UTC+14, so "today" usually differs from the UTC date.
update public.profiles set timezone = 'Pacific/Kiritimati'
where id = '00000000-0000-4000-8000-00000000000a';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into public.areas (id, name) values
  ('00000000-0000-4000-8000-0000000000e1', 'Exercise');
insert into public.todos (id, title, notes) values
  ('00000000-0000-4000-8000-0000000000d1', 'Run', 'Easy pace'),
  ('00000000-0000-4000-8000-0000000000d2', 'Swim', null),
  ('00000000-0000-4000-8000-0000000000d3', 'Water plants', null);
insert into public.todo_areas (todo_id, area_id) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000e1');

do $$
declare
  run_series uuid;
  swim_series uuid;
  latest record;
  today date := public.user_today();
  monday date;
begin
  -- Any task can repeat. An open task becomes the next occurrence.
  perform public.set_todo_recurrence('00000000-0000-4000-8000-0000000000d1', 'daily', null, '2026-11-01');
  perform public.set_todo_recurrence('00000000-0000-4000-8000-0000000000d2', 'weekly', null, '2026-11-02'); -- Mondays
  select series_id into run_series from public.todos where id = '00000000-0000-4000-8000-0000000000d1';
  select series_id into swim_series from public.todos where id = '00000000-0000-4000-8000-0000000000d2';
  if run_series is null or swim_series is null or run_series = swim_series then
    raise exception 'tasks did not get their own series';
  end if;
  if (select occurrence_date from public.todos where id = '00000000-0000-4000-8000-0000000000d1') <> today then
    raise exception 'daily task should be today''s occurrence';
  end if;
  if extract(dow from (select occurrence_date from public.todos where id = '00000000-0000-4000-8000-0000000000d2')) <> 1 then
    raise exception 'weekly task should be on its weekday';
  end if;

  -- Constraints.
  begin
    perform public.set_todo_recurrence('00000000-0000-4000-8000-0000000000d3', 'weekdays', '{7}', null);
    raise exception 'weekday 7 accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.set_todo_recurrence('00000000-0000-4000-8000-0000000000d3', 'hourly', null, null);
    raise exception 'unknown recurrence accepted';
  exception when check_violation then null;
  end;

  -- An open todo blocks the next occurrence.
  if public.ensure_habit_todos(today + 1) <> 0 then
    raise exception 'generated while the series had an open todo';
  end if;

  -- Completing it unblocks the next one, copying title, notes, and areas.
  update public.todos set completed_at = now() where id = '00000000-0000-4000-8000-0000000000d1';
  if public.ensure_habit_todos(today + 1) <> 1 then
    raise exception 'completing the run did not unblock the next one';
  end if;
  if public.ensure_habit_todos(today + 1) <> 0 then
    raise exception 'second call created duplicates';
  end if;
  select t.* into latest from public.todos t
  where t.series_id = run_series and t.occurrence_date = today + 1;
  if latest.title <> 'Run' or latest.notes <> 'Easy pace' or not exists (
    select 1 from public.todo_areas
    where todo_id = latest.id and area_id = '00000000-0000-4000-8000-0000000000e1'
  ) then
    raise exception 'new occurrence did not copy title, notes, and areas: %', latest;
  end if;

  -- Edits carry forward.
  update public.todos set title = 'Run 5k', completed_at = now() where id = latest.id;
  perform public.ensure_habit_todos(today + 2);
  if (select title from public.todos where series_id = run_series and occurrence_date = today + 2) <> 'Run 5k' then
    raise exception 'edited title did not carry forward';
  end if;
  update public.todos set completed_at = now() where series_id = run_series;

  -- Weekly: only on its weekday.
  select occurrence_date into monday from public.todos where id = '00000000-0000-4000-8000-0000000000d2';
  update public.todos set completed_at = now() where id = '00000000-0000-4000-8000-0000000000d2';
  perform public.ensure_habit_todos(monday + 2); -- Wednesday
  if exists (select 1 from public.todos where series_id = swim_series and occurrence_date = monday + 2) then
    raise exception 'weekly task generated on the wrong weekday';
  end if;
  perform public.ensure_habit_todos(monday + 7);
  if not exists (select 1 from public.todos where series_id = swim_series and occurrence_date = monday + 7) then
    raise exception 'weekly task missing on its weekday';
  end if;

  -- Changing the rule updates the series in place.
  perform public.set_todo_recurrence(latest.id, 'weekdays', '{1,3}', null);
  if (select recurrence from public.todo_series where id = run_series) <> 'weekdays'
    or (select starts_on from public.todo_series where id = run_series) <> '2026-11-01' then
    raise exception 'rule change did not update the series or lost its start';
  end if;

  -- Stopping ends the series; nothing more is generated.
  perform public.set_todo_recurrence(latest.id, null, null, null);
  if (select ended_on from public.todo_series where id = run_series) <> today then
    raise exception 'stopping did not end the series today';
  end if;
  if public.ensure_habit_todos(today + 30) <> 0 then
    raise exception 'ended series generated a todo';
  end if;

  -- Repeating again starts a new series. A finished task is only a template.
  perform public.set_todo_recurrence(latest.id, 'daily', null, null);
  if (select series_id from public.todos where id = latest.id) = run_series then
    raise exception 'repeating an ended task reused the ended series';
  end if;
  if (select occurrence_date from public.todos where id = latest.id) is not null then
    raise exception 'a completed task should not become an occurrence';
  end if;
end;
$$;

-- Occurrences and completion, relative to the real today.
insert into public.todo_series (id, recurrence, starts_on) values
  ('00000000-0000-4000-8000-0000000000f1', 'daily', public.user_today() - 5);
insert into public.todos (id, title, series_id, occurrence_date, completed_at) values
  ('00000000-0000-4000-8000-0000000000c1', 's', '00000000-0000-4000-8000-0000000000f1', public.user_today() - 4, now()),
  ('00000000-0000-4000-8000-0000000000c2', 's', '00000000-0000-4000-8000-0000000000f1', public.user_today() - 2, now()),
  ('00000000-0000-4000-8000-0000000000c3', 's', '00000000-0000-4000-8000-0000000000f1', public.user_today() - 1, now());
insert into public.todo_areas (todo_id, area_id) values
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000e1');

do $$
declare
  total int;
  done int;
begin
  select count(*), count(*) filter (where o.done) into total, done
  from public.series_occurrences(public.user_today() - 10, public.user_today() + 5) o
  where o.series_id = '00000000-0000-4000-8000-0000000000f1';
  -- Days -5 through today, never the future.
  if total <> 6 or done <> 3 then
    raise exception 'unexpected occurrences: % rows, % done', total, done;
  end if;
  if exists (
    select 1 from public.series_occurrences(public.user_today() - 10, public.user_today())
    where series_id = '00000000-0000-4000-8000-0000000000f1'
      and area_id is distinct from '00000000-0000-4000-8000-0000000000e1'
  ) then
    raise exception 'occurrences not attributed to the latest todo''s area';
  end if;
end;
$$;

-- Another user: can't see or use A's series.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
begin
  if public.ensure_habit_todos('2026-11-20') <> 0 then
    raise exception 'user B generated todos from user A''s series';
  end if;
  if exists (select 1 from public.todo_series)
    or exists (select 1 from public.series_occurrences('2026-01-01', '2026-12-31')) then
    raise exception 'user B can see user A''s series';
  end if;
  begin
    perform public.set_todo_recurrence('00000000-0000-4000-8000-0000000000d3', 'daily', null, null);
    raise exception 'user B changed user A''s todo';
  exception when no_data_found then null;
  end;
end;
$$;

rollback;
