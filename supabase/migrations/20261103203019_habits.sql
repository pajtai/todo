-- Habit recurrence. A habit-type area with a recurrence rule gets one todo per
-- occurrence, generated lazily by ensure_habit_todos() when the user loads a
-- page. Only today's occurrence is ever generated; missed days are derived
-- from the rule (habit_occurrences), not from rows.

alter table public.areas
  -- daily: every day. weekly: the weekday of starts_on. weekdays: the days in
  -- recurrence_days (0 = Sunday … 6 = Saturday, like extract(dow)).
  add column recurrence text check (recurrence in ('daily', 'weekly', 'weekdays')),
  add column recurrence_days smallint[],
  -- Title for generated todos; the area name when null.
  add column habit_title text check (char_length(btrim(habit_title)) between 1 and 500),
  add column starts_on date;

alter table public.areas
  add constraint areas_recurrence_only_for_habits check (
    type = 'habit'
    or (recurrence is null and recurrence_days is null and habit_title is null and starts_on is null)
  ),
  add constraint areas_recurrence_needs_start check (
    recurrence is null or starts_on is not null
  ),
  add constraint areas_recurrence_days_valid check (
    (recurrence = 'weekdays') = (recurrence_days is not null)
    and (
      recurrence_days is null
      or (cardinality(recurrence_days) > 0 and recurrence_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
    )
  );

alter table public.todos
  add column habit_area_id uuid references public.areas (id) on delete set null,
  add column occurrence_date date;

-- One todo per habit per day. user_id is part of the key so a row pointing at
-- someone else's area id can never collide with that user's own occurrence.
create unique index todos_habit_occurrence_idx
  on public.todos (user_id, habit_area_id, occurrence_date)
  where habit_area_id is not null;

-- The caller's local date.
create function public.user_today()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select timezone from public.profiles where id = (select auth.uid())),
    'UTC'
  ))::date;
$$;

create function public.habit_occurs_on(
  p_recurrence text,
  p_days smallint[],
  p_starts_on date,
  p_date date
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_date >= p_starts_on and case p_recurrence
    when 'daily' then true
    when 'weekly' then extract(dow from p_date) = extract(dow from p_starts_on)
    when 'weekdays' then extract(dow from p_date)::smallint = any (p_days)
    else false
  end;
$$;

-- Creates today's todo for every active habit that occurs today, linked to the
-- habit area. Idempotent. p_on overrides "today" (tests use it). Returns the
-- number of todos created.
create function public.ensure_habit_todos(p_on date default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := coalesce(p_on, public.user_today());
  v_created integer;
begin
  insert into public.todos (title, habit_area_id, occurrence_date)
  select coalesce(a.habit_title, a.name), a.id, v_day
  from public.areas a
  where a.type = 'habit'
    and a.archived_at is null
    and a.recurrence is not null
    and public.habit_occurs_on(a.recurrence, a.recurrence_days, a.starts_on, v_day)
  on conflict (user_id, habit_area_id, occurrence_date)
    where habit_area_id is not null
    do nothing;
  get diagnostics v_created = row_count;

  -- A separate statement: the todo_areas insert policy must be able to see
  -- the new todos. Also restores a link the user removed by hand.
  insert into public.todo_areas (todo_id, area_id)
  select t.id, t.habit_area_id
  from public.todos t
  -- RLS limits this join to the caller's own areas.
  join public.areas a on a.id = t.habit_area_id
  where t.occurrence_date = v_day
  on conflict do nothing;

  return v_created;
end;
$$;

-- Every expected occurrence of the caller's recurring habits in
-- [p_from, p_to], never past today or past the day the habit was archived,
-- with whether its todo was completed.
create function public.habit_occurrences(p_from date, p_to date)
returns table (area_id uuid, day date, done boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      public.user_today() as today,
      coalesce(
        (select timezone from public.profiles where id = (select auth.uid())),
        'UTC'
      ) as tz
  )
  select
    a.id,
    d::date,
    exists (
      select 1 from public.todos t
      where t.habit_area_id = a.id
        and t.occurrence_date = d::date
        and t.completed_at is not null
    )
  from public.areas a
  cross join params
  cross join lateral generate_series(
    greatest(p_from, a.starts_on)::timestamp,
    least(
      p_to,
      params.today,
      coalesce((a.archived_at at time zone params.tz)::date, 'infinity'::date)
    )::timestamp,
    interval '1 day'
  ) d
  where a.type = 'habit'
    and a.recurrence is not null
    and public.habit_occurs_on(a.recurrence, a.recurrence_days, a.starts_on, d::date)
  order by a.id, d;
$$;

-- Per recurring habit: the current streak (consecutive completed occurrences
-- ending today; today's occurrence doesn't break it until the day is over),
-- and completions over the last 30 days. Today counts toward expected_30 only
-- once it's done.
create function public.habit_streaks()
returns table (
  area_id uuid,
  current_streak integer,
  completed_30 integer,
  expected_30 integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (select public.user_today() as day),
  occ as (
    select o.*, today.day as today
    from today, public.habit_occurrences(
      (select coalesce(min(starts_on), today.day) from public.areas where recurrence is not null),
      today.day
    ) o
  ),
  last_miss as (
    select area_id, max(day) filter (where not done and day < today) as day
    from occ
    group by area_id
  )
  select
    occ.area_id,
    (count(*) filter (where occ.done and occ.day > coalesce(last_miss.day, '-infinity'::date)))::integer,
    (count(*) filter (where occ.done and occ.day > occ.today - 30))::integer,
    (count(*) filter (where occ.day > occ.today - 30 and (occ.done or occ.day < occ.today)))::integer
  from occ
  join last_miss using (area_id)
  group by occ.area_id;
$$;

revoke execute on function public.user_today() from public, anon;
revoke execute on function public.habit_occurs_on(text, smallint[], date, date) from public, anon;
revoke execute on function public.ensure_habit_todos(date) from public, anon;
revoke execute on function public.habit_occurrences(date, date) from public, anon;
revoke execute on function public.habit_streaks() from public, anon;
grant execute on function public.user_today() to authenticated, service_role;
grant execute on function public.habit_occurs_on(text, smallint[], date, date) to authenticated, service_role;
grant execute on function public.ensure_habit_todos(date) to authenticated, service_role;
grant execute on function public.habit_occurrences(date, date) to authenticated, service_role;
grant execute on function public.habit_streaks() to authenticated, service_role;
