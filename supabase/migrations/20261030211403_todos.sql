create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  notes text,
  due_on date,
  -- When the todo was done, not just whether: the Review view is built on this.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index todos_user_id_completed_at_idx on public.todos (user_id, completed_at);

alter table public.todos enable row level security;

revoke all on public.todos from anon, public;
grant select, insert, update, delete on public.todos to authenticated;
grant all on public.todos to service_role;

create policy "Users can view their own todos"
  on public.todos for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own todos"
  on public.todos for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own todos"
  on public.todos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own todos"
  on public.todos for delete to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger-only: keep it out of the Data API's RPC surface.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger set_todos_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();
