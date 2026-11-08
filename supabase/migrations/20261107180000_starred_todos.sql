-- Stars on todos. A repeating task's star belongs to the whole series: starring
-- any of its todos stars all of them, and new occurrences copy the star from
-- the series' most recent todo, like title, notes, and areas.

alter table public.todos
  add column starred boolean not null default false;

-- Stars or unstars a todo, and every todo in its series if it repeats.
create function public.set_todo_starred(p_todo_id uuid, p_starred boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_series_id uuid;
begin
  select series_id into v_series_id from public.todos where id = p_todo_id;
  if not found then
    raise exception 'Todo not found' using errcode = 'P0002';
  end if;

  update public.todos
  set starred = p_starred
  where (id = p_todo_id or (v_series_id is not null and series_id = v_series_id))
    and starred is distinct from p_starred;
end;
$$;

revoke execute on function public.set_todo_starred(uuid, boolean) from public, anon;
grant execute on function public.set_todo_starred(uuid, boolean) to authenticated, service_role;

-- Same as in *_task_recurrence.sql, plus copying `starred`.
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
    insert into public.todos (title, notes, starred, series_id, occurrence_date)
    select latest.title, latest.notes, latest.starred, s.id, v_day
    from public.todo_series s
    cross join lateral (
      select t.title, t.notes, t.starred
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
