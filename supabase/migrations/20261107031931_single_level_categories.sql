-- Categories nest one level deep: a category can have a parent, but that
-- parent can't have one (no grandparents).

-- Flatten anything deeper: attach each nested category to its top-level
-- ancestor. Runs before the new rule, so the old trigger checks it.
with recursive up as (
  select id as area_id, parent_id as ancestor_id
  from public.areas
  where parent_id is not null
  union
  select up.area_id, a.parent_id
  from up
  join public.areas a on a.id = up.ancestor_id
  where a.parent_id is not null
)
update public.areas child
set parent_id = up.ancestor_id
from up
join public.areas root on root.id = up.ancestor_id and root.parent_id is null
where child.id = up.area_id
  and child.parent_id <> up.ancestor_id;

create or replace function public.check_area_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Area hierarchy cannot contain a cycle' using errcode = 'TD001';
  end if;

  if not exists (
    select 1 from public.areas
    where id = new.parent_id and user_id = new.user_id
  ) then
    raise exception 'Parent area not found' using errcode = 'TD002';
  end if;

  if exists (
    select 1 from public.areas
    where id = new.parent_id and parent_id is not null
  ) then
    raise exception 'A parent category cannot have a parent' using errcode = 'TD003';
  end if;

  if exists (select 1 from public.areas where parent_id = new.id) then
    raise exception 'A category with subcategories cannot have a parent' using errcode = 'TD004';
  end if;

  return new;
end;
$$;
