-- Expected occurrences start at the earlier of starts_on and the habit's first
-- occurrence row, so completions recorded before starts_on still count.

-- The recurrence rule alone, without any start bound. habit_occurs_on adds
-- the starts_on bound; habit_occurrences uses its own effective start.
create function public.habit_rule_matches(
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
  select case p_recurrence
    when 'daily' then true
    when 'weekly' then extract(dow from p_date) = extract(dow from p_starts_on)
    when 'weekdays' then extract(dow from p_date)::smallint = any (p_days)
    else false
  end;
$$;

create or replace function public.habit_occurs_on(
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
  select p_date >= p_starts_on
    and public.habit_rule_matches(p_recurrence, p_days, p_starts_on, p_date);
$$;

revoke execute on function public.habit_rule_matches(text, smallint[], date, date) from public, anon;
grant execute on function public.habit_rule_matches(text, smallint[], date, date) to authenticated, service_role;

create or replace function public.habit_occurrences(p_from date, p_to date)
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
  -- Starts at the habit's first recorded occurrence if that's earlier than
  -- starts_on (e.g. backfilled or after moving the start date), so recorded
  -- completions always count.
  cross join lateral (
    select least(a.starts_on, min(t.occurrence_date)) as day
    from public.todos t
    where t.habit_area_id = a.id
  ) start
  cross join lateral generate_series(
    greatest(p_from, start.day)::timestamp,
    least(
      p_to,
      params.today,
      coalesce((a.archived_at at time zone params.tz)::date, 'infinity'::date)
    )::timestamp,
    interval '1 day'
  ) d
  where a.type = 'habit'
    and a.recurrence is not null
    and public.habit_rule_matches(a.recurrence, a.recurrence_days, a.starts_on, d::date)
  order by a.id, d;
$$;

create or replace function public.habit_streaks()
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
      least(
        (select min(starts_on) from public.areas where recurrence is not null),
        (select min(occurrence_date) from public.todos where habit_area_id is not null),
        today.day
      ),
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
