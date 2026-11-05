-- A habit doesn't get a new todo while one of its earlier todos is still open,
-- so an unfinished "Run" isn't joined by a second "Run". Completing (or
-- deleting) the open one lets the next page load create today's.
create or replace function public.ensure_habit_todos(p_on date default null)
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
    and not exists (
      select 1 from public.todos t
      where t.user_id = (select auth.uid())
        and t.habit_area_id = a.id
        and t.completed_at is null
    )
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
