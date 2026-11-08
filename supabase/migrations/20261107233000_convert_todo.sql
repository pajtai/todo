-- Turns a todo into a project or a category: creates it from the todo's
-- title (name) and notes (description), then deletes the todo. One call, so
-- a failure leaves the todo as it was. Used by the inbox on /capture.
create function public.convert_todo(p_todo_id uuid, p_kind text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_title text;
  v_notes text;
  v_id uuid;
begin
  if p_kind not in ('project', 'category') then
    raise exception 'Unknown kind %', p_kind using errcode = '22023';
  end if;

  select btrim(title), notes into v_title, v_notes
  from public.todos where id = p_todo_id;
  if not found then
    raise exception 'Todo not found' using errcode = 'P0002';
  end if;

  if p_kind = 'project' then
    insert into public.projects (name, description)
    values (v_title, v_notes)
    returning id into v_id;
  else
    insert into public.areas (name, description)
    values (v_title, v_notes)
    returning id into v_id;
  end if;

  delete from public.todos where id = p_todo_id;
  return v_id;
end;
$$;

revoke execute on function public.convert_todo(uuid, text) from public, anon;
grant execute on function public.convert_todo(uuid, text) to authenticated, service_role;
