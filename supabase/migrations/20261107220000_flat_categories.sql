-- Categories no longer nest. Every subcategory becomes top-level (its todos
-- stay attached to it), and parent_id must stay null. The column is kept,
-- like other deprecated columns, until the old deployed code is gone.

update public.areas set parent_id = null where parent_id is not null;

alter table public.areas
  add constraint areas_no_parent check (parent_id is null);

-- The hierarchy rules (TD001–TD004) have nothing left to check.
drop trigger check_areas_parent on public.areas;
drop function public.check_area_parent();
