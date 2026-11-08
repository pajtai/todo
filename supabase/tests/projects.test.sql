-- Self-checking and rolled back, so it's safe to run against the hosted project.
-- Any failed check raises an exception. Run with `npm run db:test`.
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.com', 'authenticated', 'authenticated');

set local role authenticated;

-- As user A: a project with a todo in it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into public.projects (id, name) values
  ('00000000-0000-4000-8000-0000000000f1', 'Kitchen remodel'),
  ('00000000-0000-4000-8000-0000000000f2', 'Taxes');
insert into public.todos (id, title, project_id) values
  ('00000000-0000-4000-8000-0000000000a1', 'Pick tiles', '00000000-0000-4000-8000-0000000000f1'),
  ('00000000-0000-4000-8000-0000000000a2', 'Water plants', '00000000-0000-4000-8000-0000000000f2');

do $$
begin
  begin
    insert into public.projects (name) values ('kitchen REMODEL');
    raise exception 'duplicate project name (ignoring case) was accepted';
  exception
    when unique_violation then null;
  end;

  begin
    insert into public.projects (name) values ('  ');
    raise exception 'whitespace-only project name was accepted';
  exception
    when check_violation then null;
  end;
end $$;

-- As user B: A's projects are invisible, and B can't attach a todo to one.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare
  affected int;
begin
  if exists (select 1 from public.projects) then
    raise exception 'user B can read user A''s projects';
  end if;

  update public.projects set name = 'hacked' where id = '00000000-0000-4000-8000-0000000000f1';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'user B updated user A''s project';
  end if;

  begin
    insert into public.todos (title, project_id)
    values ('sneaky', '00000000-0000-4000-8000-0000000000f1');
    raise exception 'user B attached a todo to user A''s project';
  exception
    when foreign_key_violation then null;
  end;

  -- B can use the same name as A.
  insert into public.projects (name) values ('Kitchen remodel');
end $$;

-- As user A: repeats copy the project; deleting a project keeps its todos.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare
  today date := public.user_today();
  copied uuid;
begin
  perform public.set_todo_recurrence('00000000-0000-4000-8000-0000000000a2', 'daily', null, null);
  update public.todos set completed_at = now() where id = '00000000-0000-4000-8000-0000000000a2';
  if public.ensure_habit_todos(today + 1) <> 1 then
    raise exception 'expected one new occurrence';
  end if;
  select project_id into copied from public.todos
  where occurrence_date = today + 1;
  if copied is distinct from '00000000-0000-4000-8000-0000000000f2' then
    raise exception 'new occurrence did not copy the project, got %', copied;
  end if;

  delete from public.projects where id = '00000000-0000-4000-8000-0000000000f1';
  if not exists (
    select 1 from public.todos
    where id = '00000000-0000-4000-8000-0000000000a1' and project_id is null
  ) then
    raise exception 'deleting a project should keep its todos and clear project_id';
  end if;
end $$;

-- convert_todo: a todo becomes a project or category; failures keep the todo.
do $$
declare
  new_id uuid;
begin
  insert into public.todos (id, title, notes) values
    ('00000000-0000-4000-8000-0000000000c1', ' Garden ', 'Raised beds'),
    ('00000000-0000-4000-8000-0000000000c2', 'Fitness', null),
    ('00000000-0000-4000-8000-0000000000c3', 'Taxes', null),
    ('00000000-0000-4000-8000-0000000000c4', repeat('x', 101), null);

  new_id := public.convert_todo('00000000-0000-4000-8000-0000000000c1', 'project');
  if not exists (
    select 1 from public.projects
    where id = new_id and name = 'Garden' and description = 'Raised beds'
  ) or exists (select 1 from public.todos where id = '00000000-0000-4000-8000-0000000000c1') then
    raise exception 'converting to a project should create it and delete the todo';
  end if;

  new_id := public.convert_todo('00000000-0000-4000-8000-0000000000c2', 'category');
  if not exists (select 1 from public.areas where id = new_id and name = 'Fitness')
     or exists (select 1 from public.todos where id = '00000000-0000-4000-8000-0000000000c2') then
    raise exception 'converting to a category should create it and delete the todo';
  end if;

  -- "Taxes" is already a project; a too-long title can't be a name.
  begin
    perform public.convert_todo('00000000-0000-4000-8000-0000000000c3', 'project');
    raise exception 'duplicate project name was accepted';
  exception
    when unique_violation then null;
  end;
  begin
    perform public.convert_todo('00000000-0000-4000-8000-0000000000c4', 'category');
    raise exception 'a 101-character category name was accepted';
  exception
    when check_violation then null;
  end;
  if (select count(*) from public.todos
      where id in ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c4')) <> 2 then
    raise exception 'a failed conversion should keep the todo';
  end if;
end $$;

-- As user B: can't convert A's todo.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$
begin
  perform public.convert_todo('00000000-0000-4000-8000-0000000000c3', 'project');
  raise exception 'user B converted user A''s todo';
exception
  when no_data_found then null;
end $$;

rollback;
