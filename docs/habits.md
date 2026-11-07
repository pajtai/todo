# Habits and repeating tasks

Any task can repeat. There's no special habit type: a habit is whatever category you attach repeating tasks to, so a category "Exercise" can hold a daily run and a weekly swim. Completing those tasks drives that category's streak on its page and its completion rate in Review. Every category works this way; one with no repeating tasks shows no stats. (In the code, functions such as `habitStreak` and `ensure_habit_todos` keep their older names.)

## Rules

Set a rule in a task's edit form under **Repeats** (on `/todos`, a category's page, or `/review`). Categories have no repeat settings. The rule is stored in a `todo_series` row, and every todo generated from it points back with `todos.series_id`:

| `recurrence` | Occurs on |
| --- | --- |
| `daily` | Every day |
| `weekly` | The weekday of `starts_on` |
| `weekdays` | The days in `recurrence_days` (0 = Sunday … 6 = Saturday) |

`set_todo_recurrence(todo, recurrence, days, starts_on)` does all changes in one place:

- **Make a task repeat:** creates a series starting on `starts_on` (today if empty). An open task becomes the series' next occurrence (`occurrence_date` = the first matching day on or after today), so no duplicate is generated. A completed task only serves as the template.
- **Change the rule:** updates the series in place. An empty start date keeps the current one. Existing todos stay.
- **Stop repeating** ("Doesn't repeat"): sets `ended_on` to today. Existing todos and completions stay. Repeating it again later starts a new series.

`updateTodo` validates the rule (`parseRecurrence` in `src/lib/habits.ts`) before saving anything. Tasks that repeat show ↻ in lists.

## Generation is lazy, today only

There's no cron. `/todos` and `/review` call `ensure_habit_todos()` (the name predates the change) before they render. For each active series whose rule matches today, it creates today's todo, using the user's local date from `profiles.timezone` (`user_today()`).

- **Copies the latest todo.** The new todo gets the title, notes, and categories of the series' most recent todo, so editing a task (renaming it, attaching it to a category) carries forward.
- **One open todo per series.** A series with an incomplete todo, from any day, gets no new one. Completing or deleting it lets the next page load create today's (if the rule matches today). Missed days still count as missed, because those come from the rule.
- **Idempotent.** The unique index on `todos (user_id, series_id, occurrence_date)` makes repeated calls, including concurrent ones, create nothing new.
- **No backfill.** Past occurrences are never created. Missed days are derived from the rule, not from rows (see below).
- **Deleting today's todo** doesn't skip the day: the next page load recreates it from the previous todo, unless an older one is still open. Complete it, or stop repeating. If every todo of a series is deleted, the series has nothing to copy and stops generating.
- `ensure_habit_todos(p_on)` accepts an explicit date. Tests use it.

## Missed days, streaks, and rates

`series_occurrences(p_from, p_to)` lists every day each series was expected in the range, with `done` = whether a completed todo exists for that `occurrence_date`. It never goes past today or past `ended_on`. Expected days start at the earlier of `starts_on` and the series' first occurrence row. Each row is repeated once per category the series' **most recent todo** is attached to (`area_id` is null when there are none), which is how a category collects its tasks.

For a category, the occurrences of all its repeating tasks are combined (`src/lib/habits.ts`, unit-tested):

- **Rate** (category page: last 30 days; Review: the selected period) = done occurrences / expected occurrences. Today counts toward "expected" only once it's done.
- **Streak** (`habitStreak`): consecutive scheduled days, newest first, on which **every** task was done. An open today doesn't break it.
- **Grid** (`habitGrid`): a day is done only if all of its tasks were done.

A todo completed late, say on Tuesday for Monday's occurrence, counts toward Monday's occurrence. In the Review lists it appears on the day it was completed.

## UI

- Task edit form: **Repeats** section on every task.
- `/todos` and category pages: repeating tasks show ↻, with the rule in the tooltip.
- `/categories/[id]`, when the category has repeating tasks: a **Repeating tasks** section with each task and its rule, the current streak, the 30-day rate, and a 30-day grid (done / missed / due today / not scheduled). Rendered by `categories/[id]/repeating-stats.tsx`. Without repeating tasks the section is hidden.
- `/review`: **Repeating tasks** lists each category's rate for the period, above the grouping (only the filtered category with `?category=`).

## Migration from habit rules

Before November 2026, rules lived on habit areas. Migration `*_task_recurrence.sql` turned each into a `todo_series` (reusing the area's id), pointed its todos at it, and cleared the area columns.
