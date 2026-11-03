# Data Model

All tables are in the `public` schema and follow the RLS convention in [auth.md](auth.md). Migrations in `supabase/migrations/` are the source of truth; this page explains the intent.

## `profiles`

One row per user, created by the `on_auth_user_created` trigger on `auth.users`.

| Column | Notes |
| --- | --- |
| `id` | Primary key; the `auth.users` id |
| `display_name` | Optional |
| `timezone` | IANA zone name, default `UTC`. Set from the browser on first load. Defines the user's "today" |
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
| `created_at`, `updated_at` | `updated_at` is maintained by the `set_updated_at()` trigger |

Unchecking a todo clears `completed_at`, and checking it again records the new time.

## `areas`

The generic grouping for todos. `type` is the `area_type` enum: `project`, `goal`, `habit`, `area`, or `other`.

| Column | Notes |
| --- | --- |
| `id`, `user_id` | Standard |
| `name` | Required, 1–100 characters. Unique per user and type, ignoring case, so a goal and a project can share a name |
| `type` | `area_type` |
| `parent_id` | Optional parent area. Any type can sit under any type |
| `color` | Optional `#rrggbb` |
| `description` | Optional |
| `archived_at` | Null means active |
| `created_at`, `updated_at` | `updated_at` is maintained by a trigger |

### Hierarchy rules

The `check_area_parent()` trigger enforces these, and `src/app/(app)/areas/actions.ts` turns the error codes into messages:

- A parent must exist and belong to the same user (`TD002`).
- A parent can't be the area itself or one of its descendants (`TD001`).
- Deleting a parent keeps its children, which become top-level.

### Archiving and deleting

- **Archiving** hides an area from filters, new-todo pickers, and parent pickers, but it stays on existing todos and appears under "Archived" on `/areas`. Edit forms keep listing archived areas already attached to that todo or area, because saving would otherwise silently detach them.
- **Deleting** removes the area and its links. The todos stay.

## `todo_areas`

Many-to-many link between todos and areas. Its insert policy also requires that the user can see both the todo and the area, so nobody can link to another user's rows. Rows are only inserted or deleted, never updated.

## `area_paths` view

Each area paired with itself (depth 0) and every ancestor (depth 1, 2, …). It's `security_invoker`, so RLS applies. The Review view uses it to roll completions up the hierarchy.

| `area_id` | `ancestor_id` | `depth` |
| --- | --- | --- |
| Marathon training | Marathon training | 0 |
| Marathon training | Get fit | 1 |

Area pages and the `?area=` filter on `/todos` show only todos attached directly to that area, not those on its descendants. Use `area_paths` when you need roll-up.

## `review_completed` function

Returns the caller's completed todos for a local date range with their areas and ancestors. See [review.md](review.md).

## Sample data

There's no seed file, because a seed would land in the one hosted database and users can't be created safely from SQL. To get data for trying the app or the Review view, create these on `/areas` and `/todos`:

1. Goal "Get fit", project "Marathon training" with parent "Get fit", and habit "Stretch".
2. Todo "Run 5k", attached to "Marathon training" and "Stretch".

To test past completions, backdate `completed_at` on one of your todos in Studio.

## Tests

`supabase/tests/*.test.sql` are self-checking SQL scripts, run with `npm run db:test`. Each one runs in a transaction that rolls back, so it's safe against the hosted project, and any failed check raises an exception and fails the run. They impersonate users with `set local role authenticated` plus `request.jwt.claims`.

They replace `supabase test db` and pgTAP, which would need local Docker or the pgTAP extension on the hosted project.

TypeScript unit tests (Vitest) live next to the code as `src/**/*.test.ts` and run with `npm test`.
