-- Self-checking and rolled back, so it's safe to run against the hosted project.
-- Any failed check raises an exception. Run with `npm run db:test`.
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'test-a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'test-b@example.com', 'authenticated', 'authenticated');

set local role authenticated;

-- As user A: create a todo; user_id defaults to the signed-in user.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into public.todos (id, title)
values ('00000000-0000-4000-8000-0000000000a1', 'A''s todo');

do $$
begin
  if (select user_id from public.todos where id = '00000000-0000-4000-8000-0000000000a1')
     is distinct from '00000000-0000-4000-8000-00000000000a' then
    raise exception 'user_id should default to the signed-in user';
  end if;
end $$;

-- As user B: A's todo is invisible and can't be changed or deleted.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare
  affected int;
begin
  if exists (select 1 from public.todos) then
    raise exception 'user B can read user A''s todo';
  end if;

  update public.todos set title = 'hacked' where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'user B updated user A''s todo';
  end if;

  delete from public.todos where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'user B deleted user A''s todo';
  end if;

  begin
    insert into public.todos (title, user_id)
    values ('forged', '00000000-0000-4000-8000-00000000000a');
    raise exception 'user B created a todo owned by user A';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.todos (title) values ('   ');
    raise exception 'whitespace-only title was accepted';
  exception
    when check_violation then null;
  end;
end $$;

-- As user A: the todo is untouched, and A can still change it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare
  affected int;
begin
  if (select title from public.todos where id = '00000000-0000-4000-8000-0000000000a1') <> 'A''s todo' then
    raise exception 'user A''s todo was changed by user B';
  end if;

  update public.todos set completed_at = now() where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'user A could not update their own todo';
  end if;

  delete from public.todos where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'user A could not delete their own todo';
  end if;
end $$;

-- Signed-out requests have no access at all.
reset role;
do $$
begin
  if has_table_privilege('anon', 'public.todos', 'select') then
    raise exception 'anon can read todos';
  end if;
end $$;

rollback;
