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

## Tests

`supabase/tests/*.test.sql` are self-checking SQL scripts, run with `npm run db:test`. Each one runs in a transaction that rolls back, so it's safe against the hosted project, and any failed check raises an exception and fails the run. They impersonate users with `set local role authenticated` plus `request.jwt.claims`.

They replace `supabase test db` and pgTAP, which would need local Docker or the pgTAP extension on the hosted project.
