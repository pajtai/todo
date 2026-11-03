-- Completed todos whose completion falls on a local date in [p_from, p_to],
-- using the caller's profiles.timezone. Converting in SQL keeps late-night
-- completions on the right day.
--
-- `areas` holds every area attached to the todo plus all their ancestors, each
-- once, with `depth` = the shortest distance from an attached area (0 means
-- attached directly). `parent_id` lets the app rebuild the hierarchy.
--
-- security invoker, so RLS limits results to the caller's own rows.
create function public.review_completed(p_from date, p_to date)
returns table (
  todo_id uuid,
  title text,
  completed_at timestamptz,
  completed_local_date date,
  areas jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with tz as (
    select coalesce(
      (select timezone from public.profiles where id = (select auth.uid())),
      'UTC'
    ) as name
  )
  select
    t.id,
    t.title,
    t.completed_at,
    (t.completed_at at time zone tz.name)::date,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'name', a.name,
            'type', a.type,
            'color', a.color,
            'parent_id', a.parent_id,
            'depth', x.depth
          )
          order by x.depth, a.name
        )
        from (
          select p.ancestor_id, min(p.depth) as depth
          from public.todo_areas ta
          join public.area_paths p on p.area_id = ta.area_id
          where ta.todo_id = t.id
          group by p.ancestor_id
        ) x
        join public.areas a on a.id = x.ancestor_id
      ),
      '[]'::jsonb
    )
  from public.todos t
  cross join tz
  where t.completed_at >= (p_from::timestamp at time zone tz.name)
    and t.completed_at < ((p_to + 1)::timestamp at time zone tz.name)
  order by t.completed_at desc;
$$;

revoke execute on function public.review_completed(date, date) from public, anon;
grant execute on function public.review_completed(date, date) to authenticated, service_role;
