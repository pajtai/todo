-- Projects: a task's optional parent. Unlike categories (many per task), a task
-- belongs to at most one project. A task with no project, no category, and no
-- due date is in the inbox (/capture).

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite foreign key from todos, which keeps a todo's
  -- project owned by the same user.
  unique (id, user_id)
);

create unique index projects_user_id_name_idx on public.projects (user_id, lower(name));

alter table public.projects enable row level security;

revoke all on public.projects from anon, public;
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;

create policy "Users can view their own projects"
  on public.projects for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own projects"
  on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own projects"
  on public.projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- (project_id, user_id) must match a project of the same user, so nobody can
-- attach a todo to another user's project. Deleting a project keeps its todos
-- and only clears project_id.
alter table public.todos
  add column project_id uuid,
  add constraint todos_project_id_fkey
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on delete set null (project_id);

create index todos_project_id_idx on public.todos (project_id);

-- Same as in *_starred_todos.sql, plus copying `project_id`.
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
    insert into public.todos (title, notes, starred, project_id, series_id, occurrence_date)
    select latest.title, latest.notes, latest.starred, latest.project_id, s.id, v_day
    from public.todo_series s
    cross join lateral (
      select t.title, t.notes, t.starred, t.project_id
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
