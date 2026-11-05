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

- **By area** (default, `?group=area`): a grid (`review/review-grid.tsx`) with one column per day of the period, newest on the left and one row per area and todo. Area rows follow `parent_id`, and each can be collapsed or expanded (plus "Collapse all"). A todo row has a filled box on the day it was done. An area row's box is filled (in the area's color, with a number when more than one) when any todo in it **or any area below it** was done that day, so a todo in "Marathon training" also fills "Get fit". The count beside an area uses the same roll-up. Todos are listed under the area they're attached to directly. Todos with no area go under "Unassigned". Long periods scroll sideways with the name column pinned.
- **By type** (`?group=type`): for each area type, the areas of that type with the todos that roll up to them.
- **By day** (`?group=day`): newest day first, each todo with breadcrumbs such as "Get fit › Marathon training".

A todo attached to several areas appears under each of them, so the counts in the tree can add up to more than the total.

## Editing

Click a todo on `/review` (its name in the grid, or the line in the other groupings) to edit it. It opens the same form as `/todos` (`EditForm` in `todos/todo-item.tsx`), which shows when the todo was created and, for habit todos, how it repeats (see [habits.md](habits.md)). The review adds one more field, **Done at**, a `datetime-local` input.

- The page shows and accepts Done at on the wall clock of `profiles.timezone`, not the browser's, so it matches the times in the review. `src/lib/zoned-time.ts` converts in both directions (unit-tested). A time skipped by a DST jump moves forward.
- `updateTodo` changes `completed_at` only when the form sends `completed_at`, so `/todos` edits never touch it. Malformed or future values are rejected.
- `review_completed` doesn't return `notes`, `due_on`, `created_at` or the habit rule, so the page loads them from `todos` for a UTC window one day wider than the period on each side. If that query fails, the page shows an error rather than a form that would clear those fields on save.
- Moving Done at out of the period removes the todo from this review after saving.

## Filters

- `?type=habit`: todos with any area of that type, attached directly or as an ancestor.
- `?area=<id>`: todos in that area **including its descendants**. Area pages link here. Archived areas stay selectable, because reviews are historical.

The summary line counts per type with the same roll-up rule.
