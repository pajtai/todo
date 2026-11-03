# Review

`/review` lists completed todos for a period and shows which areas they belong to. It's the main reason the app exists.

## Data: `review_completed(p_from date, p_to date)`

A `security invoker` SQL function (migration `*_review.sql`), so RLS limits it to the caller's rows. It returns one row per completed todo whose **local** completion date is in `[p_from, p_to]`:

| Column | Notes |
| --- | --- |
| `todo_id`, `title`, `completed_at` | From `todos` |
| `completed_local_date` | `completed_at` converted to the caller's `profiles.timezone` |
| `areas` | JSON array of every directly attached area **and all its ancestors**, each listed once: `id`, `name`, `type`, `color`, `parent_id`, `depth` (0 = attached directly, 1+ = ancestor) |

The conversion to local time happens in SQL (`completed_at at time zone tz`), so a todo finished at 23:30 local time lands on that local day, not the UTC one. The period bounds are converted the same way.

## Periods

All dates are local calendar dates, as `YYYY-MM-DD`. "Today" is computed from `profiles.timezone`.

| URL | Period |
| --- | --- |
| `/review` | This week (weeks run Monday–Sunday) |
| `?period=day` / `?period=month` | Today / this month |
| `?date=2026-10-26` | The day, week, or month containing that date |
| `?from=2026-10-01&to=2026-10-15` | Custom range, capped at 366 days. Reversed bounds are swapped |

Prev and next arrows step by one period (for a custom range, by its length). Invalid values fall back to the defaults.

## Grouping and roll-up

The `review_completed` rows are grouped in TypeScript (`src/lib/review.ts`, unit-tested in `src/lib/review.test.ts`, run with `npm test`):

- **By area** (default, `?group=area`): a tree that follows `parent_id`. Each area's count is the number of distinct todos in it **or any area below it**, so a todo in "Marathon training" also counts toward "Get fit". Todos are listed under the area they're attached to directly. Todos with no area go under "Unassigned".
- **By type** (`?group=type`): for each area type, the areas of that type with the todos that roll up to them.
- **By day** (`?group=day`): newest day first, each todo with breadcrumbs such as "Get fit › Marathon training".

A todo attached to several areas appears under each of them, so the counts in the tree can add up to more than the total.

## Filters

- `?type=habit`: todos with any area of that type, attached directly or as an ancestor.
- `?area=<id>`: todos in that area **including its descendants**. Area pages link here. Archived areas stay selectable, because reviews are historical.

The summary line counts per type with the same roll-up rule.
