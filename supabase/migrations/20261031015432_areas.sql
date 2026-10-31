create type public.area_type as enum ('project', 'goal', 'habit', 'area', 'other');

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  type public.area_type not null,
  -- Lets areas roll up, e.g. a project under a goal.
  parent_id uuid references public.areas (id) on delete set null,
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index areas_user_id_type_name_idx on public.areas (user_id, type, lower(name));
create index areas_parent_id_idx on public.areas (parent_id);

alter table public.areas enable row level security;

revoke all on public.areas from anon, public;
grant select, insert, update, delete on public.areas to authenticated;
grant all on public.areas to service_role;

create policy "Users can view their own areas"
  on public.areas for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own areas"
  on public.areas for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own areas"
  on public.areas for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own areas"
  on public.areas for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger set_areas_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

-- Rejects parents that belong to someone else and parents that would create a
-- cycle. The app maps these error codes to messages.
create function public.check_area_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.areas
    where id = new.parent_id and user_id = new.user_id
  ) then
    raise exception 'Parent area not found' using errcode = 'TD002';
  end if;

  if new.parent_id = new.id or exists (
    with recursive ancestors as (
      select id, parent_id from public.areas where id = new.parent_id
      union
      select a.id, a.parent_id
      from public.areas a
      join ancestors on a.id = ancestors.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'Area hierarchy cannot contain a cycle' using errcode = 'TD001';
  end if;

  return new;
end;
$$;

-- Trigger-only: keep it out of the Data API's RPC surface.
revoke execute on function public.check_area_parent() from public, anon, authenticated;

create trigger check_areas_parent
  before insert or update of parent_id on public.areas
  for each row execute function public.check_area_parent();

create table public.todo_areas (
  todo_id uuid not null references public.todos (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (todo_id, area_id)
);

create index todo_areas_area_id_idx on public.todo_areas (area_id);
create index todo_areas_user_id_idx on public.todo_areas (user_id);

alter table public.todo_areas enable row level security;

revoke all on public.todo_areas from anon, public;
grant select, insert, delete on public.todo_areas to authenticated;
grant all on public.todo_areas to service_role;

create policy "Users can view their own todo areas"
  on public.todo_areas for select to authenticated
  using ((select auth.uid()) = user_id);

-- RLS on the subqueries means they only find the user's own todos and areas.
create policy "Users can link their own todos and areas"
  on public.todo_areas for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.todos where id = todo_id)
    and exists (select 1 from public.areas where id = area_id)
  );

create policy "Users can unlink their own todos and areas"
  on public.todo_areas for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Every area paired with itself (depth 0) and each of its ancestors. The path
-- guard keeps this finite even if concurrent updates ever create a cycle.
create view public.area_paths
with (security_invoker = true)
as
with recursive paths as (
  select id as area_id, id as ancestor_id, parent_id, 0 as depth, array[id] as path
  from public.areas
  union all
  select paths.area_id, parent.id, parent.parent_id, paths.depth + 1, paths.path || parent.id
  from paths
  join public.areas parent on parent.id = paths.parent_id
  where not parent.id = any (paths.path)
)
select area_id, ancestor_id, depth from paths;

revoke all on public.area_paths from anon, public;
grant select on public.area_paths to authenticated;
grant select on public.area_paths to service_role;
