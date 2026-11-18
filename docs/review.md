# Review

`/review` lists completed todos for a period and shows which categories (areas in the code) they belong to. It's the main reason the app exists.

## Data: `review_completed(p_from date, p_to date)`

A `security invoker` SQL function (migration `*_review.sql`), so RLS limits it to the caller's rows. It returns one row per completed todo whose **local** completion date is in `[p_from, p_to]`:

| Column | Notes |
| --- | --- |
| `todo_id`, `title`, `completed_at` | From `todos` |
| `completed_local_date` | `completed_at` converted to the caller's `profiles.timezone` |
| `areas` | JSON array of every directly attached area **and all its ancestors**, each listed once: `id`, `name`, `color`, `parent_id`, `depth` (0 = attached directly, 1+ = ancestor). It also has the deprecated `type`, which the app ignores |

The conversion to local time happens in SQL (`completed_at at time zone tz`), so a todo finished at 23:30 local time lands on that local day, not the UTC one. The period bounds are converted the same way.

## Periods

All dates are local calendar dates, as `YYYY-MM-DD`. "Today" is computed from `profiles.timezone`.

Periods are rolling windows that end on a date, and never include future days.

| URL | Period |
| --- | --- |
| `/review` | Past 7 days: the 7 days ending today |
| `?period=day` / `?period=30d` | Today / the 30 days ending today |
| `?date=2026-10-26` | The day, 7 days, or 30 days **ending** on that date |
| `?from=2026-10-01&to=2026-10-15` | Custom range, capped at 366 days. Reversed bounds are swapped |

- A `date`, or a custom `to`, after today is clamped to today, and a custom `from` after today becomes today.
- Prev and next arrows step by one period (for a custom range, by its length). The next arrow is greyed out once the period ends today. A step that would run past today lands on the period ending today instead.
- Older `?period=week` and `?period=month` links map to 7 and 30 days.
- Invalid values fall back to the defaults.

## Grouping

The `review_completed` rows are grouped in TypeScript (`src/lib/review.ts`, unit-tested in `src/lib/review.test.ts`, run with `npm test`):

- **By task** (default, `?group=category`, the value kept so old links work): a grid (`review/review-grid.tsx`) with one column per day of the period, newest on the left, and one row per task, most recently done first. All completed todos of one repeating task (same `series_id`) share one row, named after the newest. Under each name, the newest todo's categories show as pills (`AreaChip`); clicking one filters the review to that category. A row has a filled box on each day it was done, in a darker shade of its first colored category (gray when it has none). Clicking the name edits the newest todo; clicking a filled box edits the todo done that day. Long periods scroll sideways with the name column pinned.
- **By day** (`?group=day`): newest day first, each todo with its categories.

A todo attached to several categories appears once, with a pill for each.

Above the grouping, **Repeating tasks** lists the completion rate of each category's repeating tasks for the period (see [habits.md](habits.md)). It shows even when nothing was completed.

The retired **By type** grouping (`?group=type`) and the old `?group=area` fall back to By task, and `?type=` is ignored, so old links still work.

## Editing

Click a todo on `/review` (its name in the grid, or the line in the other groupings) to edit it. It opens the same form as the other task lists (`EditForm` in `_todos/todo-item.tsx`), which shows when the todo was created and, for repeating todos, how it repeats (see [habits.md](habits.md)). The review adds one more field, **Done at**, a `datetime-local` input.

- The page shows and accepts Done at on the wall clock of `profiles.timezone`, not the browser's, so it matches the times in the review. `src/lib/zoned-time.ts` converts in both directions (unit-tested). A time skipped by a DST jump moves forward.
- `updateTodo` changes `completed_at` only when the form sends `completed_at`, so edits elsewhere never touch it. Malformed or future values are rejected.
- `review_completed` doesn't return `notes`, `due_on`, `created_at` or the habit rule, so the page loads them from `todos` for a UTC window one day wider than the period on each side. If that query fails, the page shows an error rather than a form that would clear those fields on save.
- Moving Done at out of the period removes the todo from this review after saving.

## Filters

- `?category=<id>` (formerly `?area=`, still accepted): todos in that category. Category pages link here. Archived categories stay selectable (under "Archived"), because reviews are historical.

The summary line shows the total and how many have no category.
