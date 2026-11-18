# Data Model

All tables are in the `public` schema and follow the RLS convention in [auth.md](auth.md). Migrations in `supabase/migrations/` are the source of truth; this page explains the intent.

## `profiles`

One row per user, created by the `on_auth_user_created` trigger on `auth.users`.

| Column | Notes |
| --- | --- |
| `id` | Primary key; the `auth.users` id |
| `display_name` | Optional |
| `timezone` | IANA zone name, default `UTC`. Set from the browser on first load. Defines the user's "today" |
| `theme` | `light`, `dark`, or null (follow the device). Set by the header toggle. See [theme.md](theme.md) |
| `created_at` | |

## `todos`

| Column | Notes |
| --- | --- |
| `id` | Primary key |
| `user_id` | Owner; defaults to `auth.uid()` |
| `title` | Required; 1–500 characters after trimming whitespace |
| `notes` | Optional |
| `due_on` | Optional date, with no time or timezone |
| `completed_at` | Null means open. A timestamp, not a boolean, because the Review view needs to know when a todo was done |
| `project_id` | Optional parent project. A composite foreign key on `(project_id, user_id)` keeps it the same user's project; deleting the project sets it to null. New occurrences of a repeating todo copy it |
| `starred` | Default false. On a repeating todo the star belongs to the whole series: `set_todo_starred(todo, starred)` updates every todo in it, and new occurrences copy it. Open lists show starred todos first |
| `series_id`, `occurrence_date` | Set on repeating todos: the `todo_series` row with the rule, and the day this todo is for. Unique per user, series, and date. See [habits.md](habits.md) |
| `habit_area_id` | **Deprecated**, no longer written. Kept until the old deployed code is gone |
| `created_at`, `updated_at` | `updated_at` is maintained by the `set_updated_at()` trigger |

Unchecking a todo clears `completed_at`, and checking it again records the new time.

## `projects`

A task's optional parent: a todo belongs to at most one project, unlike categories, which are many-to-many. Added by `*_projects.sql`. Owner-only RLS, like `todos`. Managed on `/plan`.

| Column | Notes |
| --- | --- |
| `id`, `user_id` | Standard. `unique (id, user_id)` is the target of the todos foreign key |
| `name` | Required, 1–100 characters. Unique per user, ignoring case |
| `description` | Optional |
| `archived_at` | Null means active. Archived projects leave the edit form's Project picker (unless already on that todo) and move to "Archived projects" on `/plan` |
| `created_at`, `updated_at` | `updated_at` is maintained by a trigger |

Deleting a project keeps its todos; they just lose `project_id`.

`convert_todo(todo, 'project' | 'category')` replaces a todo with a project or category of the same name (notes become the description), atomically. See [screens.md](screens.md#converting-an-inbox-task).

## `areas`

The grouping for todos. The UI, routes (`/categories`, `/categories/[id]`), and URL params (`?category=`) say **category**; the code and schema still say "area" (`areas`, `AreaChip`, `area_id`).

Old links keep working: `next.config.ts` redirects `/areas` and `/areas/:id` to `/categories`, and `/review` still accepts the old `?area=` param. `/todos` redirects to `/do` (see [screens.md](screens.md)).

Every category is user-defined, works the same way, and is flat: categories don't nest. Any category can hold repeating tasks and shows their streak (see [habits.md](habits.md)).

Until November 2026 areas had a predefined type (project, goal, habit, domain, other) and the UI called them Intentions. Migration `*_categories.sql` dropped types from the app; existing areas kept their names, colors, parents, and todos.

| Column | Notes |
| --- | --- |
| `id`, `user_id` | Standard |
| `name` | Required, 1–100 characters. Unique per user, ignoring case |
| `type` | **Deprecated** `area_type` enum, default `other`, no longer read or written. Kept until the old deployed code is gone; a later migration should drop it and the enum |
| `parent_id` | **Deprecated**, always null (check constraint `areas_no_parent`). Kept until the old deployed code is gone |
| `color` | Optional `#rrggbb` |
| `description` | Optional |
| `archived_at` | Null means active |
| `recurrence`, `recurrence_days`, `habit_title`, `starts_on` | **Deprecated** habit rule, always null. See below |
| `created_at`, `updated_at` | `updated_at` is maintained by a trigger |

### No nesting

Categories used to nest one level deep (`parent_id`, enforced by the `check_area_parent()` trigger). Migration `*_flat_categories.sql` made every subcategory top-level, keeping its todos, added `areas_no_parent`, and dropped the trigger. To group tasks under something bigger, use a project.

### Archiving and deleting

- **Archiving** hides a category from filters and new-todo pickers, but it stays on existing todos and appears under "Archived" on `/categories`. Edit forms keep listing archived areas already attached to that todo or area, because saving would otherwise silently detach them.
- **Deleting** removes the area and its links. The todos stay.

## `todo_areas`

Many-to-many link between todos and areas. Its insert policy also requires that the user can see both the todo and the area, so nobody can link to another user's rows. Rows are only inserted or deleted, never updated.

## `area_paths` view

Each area paired with itself (depth 0) and its ancestors (depth 1+). Since categories no longer nest, every area now has only its depth-0 row; the view and `review_completed` still return ancestors; Review shows only the directly attached ones. It's `security_invoker`, so RLS applies.

| `area_id` | `ancestor_id` | `depth` |
| --- | --- | --- |
| Marathon training | Marathon training | 0 |


## Embedding areas in todo queries

`todos` relates to `areas` two ways: through `todo_areas` and through `habit_area_id`. So a PostgREST embed has to name the join table: `areas!todo_areas(...)`. A bare `areas(...)` fails as ambiguous.

## `todo_series`

A repeat rule for a task: `recurrence`, `recurrence_days`, `starts_on`, and `ended_on` (set when the user stops repeating). Owner-only RLS, like `todos`. See [habits.md](habits.md).

## Recurrence functions

`user_today()`, `ensure_habit_todos()`, `set_todo_recurrence()`, `set_todo_starred()`, `series_occurrences()`, and `series_next_occurrence()`. See [habits.md](habits.md).

The old `habit_occurrences()` and `habit_streaks()` functions, and the `areas` columns `recurrence`, `recurrence_days`, `habit_title`, and `starts_on`, are **deprecated**. Their data was moved to `todo_series` and cleared. They're kept so the previously deployed app doesn't error, and a later migration should drop them once the new code is deployed.

## `review_completed` function

Returns the caller's completed todos for a local date range with their areas and ancestors. See [review.md](review.md).

## Sample data

There's no seed file, because a seed would land in the one hosted database and users can't be created safely from SQL. To get data for trying the app or the Review view, create these on `/categories`, `/capture`, and `/plan`:

1. Categories "Marathon training" and "Stretch", and a project "Kitchen remodel".
2. Todo "Run 5k", attached to "Marathon training" and "Stretch". Edit it and set it to repeat daily to see a streak on those categories' pages.

To test past completions, backdate `completed_at` on one of your todos in Studio.

## Tests

`supabase/tests/*.test.sql` are self-checking SQL scripts, run with `npm run db:test`. Each one runs in a transaction that rolls back, so it's safe against the hosted project, and any failed check raises an exception and fails the run. They impersonate users with `set local role authenticated` plus `request.jwt.claims`.

They replace `supabase test db` and pgTAP, which would need local Docker or the pgTAP extension on the hosted project.

TypeScript unit tests (Vitest) live next to the code as `src/**/*.test.ts` and run with `npm test`.
