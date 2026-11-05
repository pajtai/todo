-- Recurrence moves from habit areas onto tasks. A repeat rule now lives in a
-- `todo_series` row; every todo generated from it points back with
-- `todos.series_id`. A habit is just an area that repeating tasks can be
-- attached to, so "Exercise" can hold a daily run and a weekly swim.
--
-- Each new occurrence copies the title, notes, and areas of the series' most
-- recent todo, so editing a task carries forward.
--
-- The old columns (areas.recurrence, recurrence_days, habit_title, starts_on,
-- todos.habit_area_id, occurrence index) and functions (habit_occurrences,
-- habit_streaks) stay for now so the deployed app keeps working until the new
-- code ships. A later migration drops them.

create table public.todo_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- daily: every day. weekly: the weekday of starts_on. weekdays: the days in
  -- recurrence_days (0 = Sunday … 6 = Saturday, like extract(dow)).
  recurrence text not null check (recurrence in ('daily', 'weekly', 'weekdays')),
  recurrence_days smallint[],
  starts_on date not null,
  -- Set when the user stops repeating. Occurrences end on this day.
  ended_on date,
  created_at timestamptz not null default now(),
  constraint todo_series_days_valid check (
    (recurrence = 'weekdays') = (recurrence_days is not null)
    and (
      recurrence_days is null
      or (cardinality(recurrence_days) > 0 and recurrence_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
    )
  )
);

alter table public.todo_series enable row level security;

revoke all on public.todo_series from anon, public;
grant select, insert, update, delete on public.todo_series to authenticated;
grant all on public.todo_series to service_role;

create policy "Users can view their own series"
  on public.todo_series for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own series"
  on public.todo_series for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own series"
  on public.todo_series for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own series"
  on public.todo_series for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.todos
  add column series_id uuid references public.todo_series (id) on delete set null;

-- One todo per series per day. user_id is part of the key so a row pointing at
-- someone else's series can never collide with that user's own occurrence.
create unique index todos_series_occurrence_idx
  on public.todos (user_id, series_id, occurrence_date)
  where series_id is not null;

create index todos_series_id_idx on public.todos (series_id) where series_id is not null;

-- ---------------------------------------------------------------------------
-- Move existing habit rules onto series. The series reuses the area's id, so
-- the todos can be linked without a lookup table.

insert into public.todo_series (id, user_id, recurrence, recurrence_days, starts_on, ended_on)
select
  a.id,
  a.user_id,
  a.recurrence,
  a.recurrence_days,
  a.starts_on,
  (a.archived_at at time zone coalesce(p.timezone, 'UTC'))::date
from public.areas a
left join public.profiles p on p.id = a.user_id
where a.recurrence is not null;

update public.todos t
set series_id = t.habit_area_id
from public.todo_series s
where s.id = t.habit_area_id;

-- A habit that never generated a todo gets one, so the series has a task to
-- copy from. It's the next occurrence on or after today.
with seeds as (
  insert into public.todos (user_id, title, series_id, occurrence_date)
  select
    a.user_id,
    coalesce(a.habit_title, a.name),
    a.id,
    (
      select min(d)::date
      from generate_series(greatest(current_date, a.starts_on), greatest(current_date, a.starts_on) + 6, interval '1 day') d
      where public.habit_rule_matches(a.recurrence, a.recurrence_days, a.starts_on, d::date)
    )
  from public.areas a
  where a.recurrence is not null
    and a.archived_at is null
    and not exists (select 1 from public.todos t where t.series_id = a.id)
  returning id, series_id, user_id
)
insert into public.todo_areas (todo_id, area_id, user_id)
select id, series_id, user_id from seeds;

-- The habit areas no longer own a rule. Clearing it also stops the old
-- generator, so nothing creates todos twice while both versions are live.
update public.areas
set recurrence = null, recurrence_days = null, habit_title = null, starts_on = null
where recurrence is not null;

-- ---------------------------------------------------------------------------
-- Functions

-- The first day on or after p_from that the rule occurs on.
create function public.series_next_occurrence(
  p_recurrence text,
  p_days smallint[],
  p_starts_on date,
  p_from date
)
returns date
language sql
immutable
set search_path = ''
as $$
  select min(d)::date
  from generate_series(
    greatest(p_from, p_starts_on)::timestamp,
    (greatest(p_from, p_starts_on) + 6)::timestamp,
    interval '1 day'
  ) d
  where public.habit_rule_matches(p_recurrence, p_days, p_starts_on, d::date);
$$;

-- Same name as before so the deployed app's calls keep working. Creates the
-- day's todo for every active series that occurs that day and has no open
-- todo, copying title, notes, and areas from the series' most recent todo.
-- Idempotent. p_on overrides "today" (tests use it). Returns the number of
-- todos created.
create or replace function public.ensure_habit_todos(p_on date default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := coalesce(p_on, public.user_today());
  v_ids uuid[];
begin
  with created as (
    insert into public.todos (title, notes, series_id, occurrence_date)
    select latest.title, latest.notes, s.id, v_day
    from public.todo_series s
    cross join lateral (
      select t.title, t.notes
      from public.todos t
      where t.series_id = s.id
      order by t.occurrence_date desc nulls last, t.created_at desc
      limit 1
    ) latest
    where s.user_id = (select auth.uid())
      and s.ended_on is null
      and public.habit_occurs_on(s.recurrence, s.recurrence_days, s.starts_on, v_day)
      and not exists (
        select 1 from public.todos t
        where t.series_id = s.id and t.completed_at is null
      )
    on conflict (user_id, series_id, occurrence_date)
      where series_id is not null
      do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from created;

  -- A separate statement: the todo_areas insert policy must be able to see
  -- the new todos. Copies areas from the previous todo in the series.
  insert into public.todo_areas (todo_id, area_id)
  select n.id, ta.area_id
  from public.todos n
  cross join lateral (
    select p.id
    from public.todos p
    where p.series_id = n.series_id and p.id <> n.id
    order by p.occurrence_date desc nulls last, p.created_at desc
    limit 1
  ) prev
  join public.todo_areas ta on ta.todo_id = prev.id
  where n.id = any (v_ids)
  on conflict do nothing;

  return cardinality(v_ids);
end;
$$;

-- Sets, changes, or stops a todo's repeat rule. p_recurrence null stops it.
-- p_starts_on null keeps the current start, or uses today for a new rule.
-- Making a task repeat starts a series with this task as its current
-- occurrence (the next matching day), so no duplicate is generated.
create function public.set_todo_recurrence(
  p_todo_id uuid,
  p_recurrence text,
  p_days smallint[],
  p_starts_on date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := public.user_today();
  v_todo public.todos%rowtype;
  v_series public.todo_series%rowtype;
  v_start date;
begin
  select * into v_todo from public.todos where id = p_todo_id;
  if not found then
    raise exception 'Todo not found' using errcode = 'P0002';
  end if;
  if v_todo.series_id is not null then
    select * into v_series from public.todo_series where id = v_todo.series_id;
  end if;

  if p_recurrence is null then
    update public.todo_series set ended_on = v_today
    where id = v_todo.series_id and ended_on is null;
    return;
  end if;

  if v_series.id is not null and v_series.ended_on is null then
    update public.todo_series
    set recurrence = p_recurrence,
        recurrence_days = p_days,
        starts_on = coalesce(p_starts_on, starts_on)
    where id = v_series.id;
    return;
  end if;

  v_start := coalesce(p_starts_on, v_today);
  insert into public.todo_series (recurrence, recurrence_days, starts_on)
  values (p_recurrence, p_days, v_start)
  returning * into v_series;

  -- An open task becomes the next occurrence. A finished one only serves as
  -- the template; the generator creates the next occurrence on its day.
  update public.todos
  set series_id = v_series.id,
      occurrence_date = case
        when completed_at is null then public.series_next_occurrence(p_recurrence, p_days, v_start, v_today)
      end
  where id = p_todo_id;
end;
$$;

-- Every expected occurrence of the caller's series in [p_from, p_to], never
-- past today or the day the series ended, with whether it was completed.
-- One row per area the series' most recent todo is attached to (area_id is
-- null when it has none), so habits can sum their attached series.
create function public.series_occurrences(p_from date, p_to date)
returns table (series_id uuid, area_id uuid, day date, done boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (select public.user_today() as today)
  select
    s.id,
    ta.area_id,
    d::date,
    exists (
      select 1 from public.todos t
      where t.series_id = s.id
        and t.occurrence_date = d::date
        and t.completed_at is not null
    )
  from public.todo_series s
  cross join params
  -- Starts at the series' first recorded occurrence if that's earlier than
  -- starts_on, so recorded completions always count.
  cross join lateral (
    select least(s.starts_on, min(t.occurrence_date)) as day
    from public.todos t
    where t.series_id = s.id
  ) start
  cross join lateral (
    select t.id
    from public.todos t
    where t.series_id = s.id
    order by t.occurrence_date desc nulls last, t.created_at desc
    limit 1
  ) latest
  left join public.todo_areas ta on ta.todo_id = latest.id
  cross join lateral generate_series(
    greatest(p_from, start.day)::timestamp,
    least(p_to, params.today, coalesce(s.ended_on, 'infinity'::date))::timestamp,
    interval '1 day'
  ) d
  where public.habit_rule_matches(s.recurrence, s.recurrence_days, s.starts_on, d::date)
  order by s.id, d;
$$;

revoke execute on function public.series_next_occurrence(text, smallint[], date, date) from public, anon;
revoke execute on function public.set_todo_recurrence(uuid, text, smallint[], date) from public, anon;
revoke execute on function public.series_occurrences(date, date) from public, anon;
grant execute on function public.series_next_occurrence(text, smallint[], date, date) to authenticated, service_role;
grant execute on function public.set_todo_recurrence(uuid, text, smallint[], date) to authenticated, service_role;
grant execute on function public.series_occurrences(date, date) to authenticated, service_role;
