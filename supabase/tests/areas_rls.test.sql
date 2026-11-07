-- Self-checking and rolled back, so it's safe to run against the hosted project.
-- Any failed check raises an exception. Run with `npm run db:test`.
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.com', 'authenticated', 'authenticated');

set local role authenticated;

-- User B's data.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.todos (id, title) values ('00000000-0000-4000-8000-0000000000b1', 'B''s todo');
insert into public.areas (id, name) values ('00000000-0000-4000-8000-0000000000b2', 'B''s goal');

-- User A's data: category "child" under category "root".
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.todos (id, title) values ('00000000-0000-4000-8000-0000000000a1', 'A''s todo');
insert into public.areas (id, name) values ('00000000-0000-4000-8000-0000000000a2', 'root');
insert into public.areas (id, name, parent_id) values
  ('00000000-0000-4000-8000-0000000000a3', 'child', '00000000-0000-4000-8000-0000000000a2');
insert into public.todo_areas (todo_id, area_id) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a3');

do $$
declare
  affected int;
begin
  -- Isolation.
  if exists (select 1 from public.areas where name = 'B''s goal') then
    raise exception 'user A can read user B''s area';
  end if;
  if exists (select 1 from public.area_paths where area_id = '00000000-0000-4000-8000-0000000000b2') then
    raise exception 'user A can read user B''s area_paths';
  end if;

  update public.areas set name = 'hacked' where id = '00000000-0000-4000-8000-0000000000b2';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'user A updated user B''s area';
  end if;

  -- Cross-user links.
  begin
    insert into public.todo_areas (todo_id, area_id) values
      ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2');
    raise exception 'linked own todo to another user''s area';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.todo_areas (todo_id, area_id) values
      ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a2');
    raise exception 'linked another user''s todo to own area';
  exception
    when insufficient_privilege then null;
  end;

  -- Hierarchy rules.
  begin
    update public.areas set parent_id = '00000000-0000-4000-8000-0000000000a3'
    where id = '00000000-0000-4000-8000-0000000000a2';
    raise exception 'cycle was accepted';
  exception
    when sqlstate 'TD001' then null;
  end;

  begin
    update public.areas set parent_id = id where id = '00000000-0000-4000-8000-0000000000a2';
    raise exception 'self-parent was accepted';
  exception
    when sqlstate 'TD001' then null;
  end;

  begin
    update public.areas set parent_id = '00000000-0000-4000-8000-0000000000b2'
    where id = '00000000-0000-4000-8000-0000000000a2';
    raise exception 'another user''s area was accepted as a parent';
  exception
    when sqlstate 'TD002' then null;
  end;

  begin
    insert into public.areas (name) values ('ROOT');
    raise exception 'duplicate name was accepted';
  exception
    when unique_violation then null;
  end;

  -- Names are unique per user, whatever the deprecated type says.
  begin
    insert into public.areas (name, type) values ('root', 'project');
    raise exception 'duplicate name with another type was accepted';
  exception
    when unique_violation then null;
  end;

  -- Another user can use the same name.
  if exists (select 1 from public.areas where lower(name) = 'b''s goal') then
    raise exception 'saw another user''s area';
  end if;
  insert into public.areas (name) values ('B''s goal');

  -- area_paths.
  if (select jsonb_agg(jsonb_build_object('ancestor', ancestor_id, 'depth', depth) order by depth)
      from public.area_paths where area_id = '00000000-0000-4000-8000-0000000000a3')
     is distinct from jsonb_build_array(
       jsonb_build_object('ancestor', '00000000-0000-4000-8000-0000000000a3'::uuid, 'depth', 0),
       jsonb_build_object('ancestor', '00000000-0000-4000-8000-0000000000a2'::uuid, 'depth', 1)
     ) then
    raise exception 'area_paths should return self at depth 0 and parent at depth 1';
  end if;

  -- Deleting a parent keeps the child; deleting an area keeps its todos.
  delete from public.areas where id = '00000000-0000-4000-8000-0000000000a2';
  if (select parent_id from public.areas where id = '00000000-0000-4000-8000-0000000000a3') is not null then
    raise exception 'child should lose its parent, not be deleted';
  end if;

  delete from public.areas where id = '00000000-0000-4000-8000-0000000000a3';
  if exists (select 1 from public.todo_areas where todo_id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'deleting an area should remove its links';
  end if;
  if not exists (select 1 from public.todos where id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'deleting an area should keep its todos';
  end if;
end $$;

reset role;
do $$
begin
  if has_table_privilege('anon', 'public.areas', 'select')
     or has_table_privilege('anon', 'public.todo_areas', 'select')
     or has_table_privilege('anon', 'public.area_paths', 'select') then
    raise exception 'anon has access to area data';
  end if;
end $$;

rollback;
