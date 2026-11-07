-- Areas become user-defined categories: no more predefined types (project,
-- goal, habit, area, other), and every category works the same way. Existing
-- areas keep their names, colors, parents, and todos.
--
-- `areas.type` is deprecated. It's kept, with a default, so the previously
-- deployed app (which still reads and writes it) keeps working. A later
-- migration should drop the column and the `area_type` enum.

alter table public.areas alter column type set default 'other';

-- Names were unique per user and type; with no types they're unique per user.
create unique index areas_user_id_name_idx on public.areas (user_id, lower(name));
drop index public.areas_user_id_type_name_idx;
