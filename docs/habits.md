# Habits

A habit is an area with `type = 'habit'`. Give it a recurrence rule and the app creates one todo for each occurrence. Completing those todos drives the streak on the habit's page and the completion rate in Review (**By type**).

## Rules

Set these on the area form under **Repeats**. They're stored on `areas` and allowed only when `type = 'habit'`:

| `recurrence` | Occurs on |
| --- | --- |
| `daily` | Every day |
| `weekly` | The weekday of `starts_on` |
| `weekdays` | The days in `recurrence_days` (0 = Sunday … 6 = Saturday) |

`starts_on` defaults to today in the user's timezone. `habit_title` sets the generated todo's title and defaults to the area name. Changing a habit's type away from `habit` clears its rule.

## Generation is lazy, today only

There's no cron. `/todos` and `/review` call `ensure_habit_todos()` before they render. It inserts today's todo, using the user's local date from `profiles.timezone` (`user_today()`), for each active habit whose rule matches today, and links it to the habit in `todo_areas`.

- **Idempotent.** The unique index on `todos (user_id, habit_area_id, occurrence_date)` makes repeated calls, including concurrent ones, create nothing new.
- **One open todo per habit.** A habit with an incomplete todo, from any day, gets no new one. Completing or deleting it lets the next page load create today's (if the rule matches today). Missed days still count as missed, because those come from the rule.
- **No backfill.** Past occurrences are never created, so coming back after two weeks away doesn't leave a pile of stale todos. Missed days are derived from the rule, not from rows (see below).
- **Archiving** a habit stops generation. Its existing todos stay.
- **Editing a rule** affects only future generation. Existing todos and completions stay.
- **Deleting today's habit todo** doesn't skip the day: the next page load recreates it, unless an older todo for the habit is still open. Complete it instead, or archive the habit.
- `ensure_habit_todos(p_on)` accepts an explicit date. Tests use it.

## Missed days, streaks, and rates

`habit_occurrences(p_from, p_to)` lists every day a habit was expected in the range, with `done` = whether a completed todo exists for that `occurrence_date`. It never goes past today or past the day the habit was archived. Expected days start at the earlier of `starts_on` and the habit's first occurrence row, so completions recorded before `starts_on` (backfilled, or before the start date was moved) still count.

- **Streak** (`habit_streaks()`): completed occurrences since the most recent missed one. Today's occurrence doesn't break the streak while the day is still open.
- **Rate** (habit page: last 30 days; Review: the selected period) = done / expected. Today counts toward "expected" only once it's done.

A habit todo completed late, say on Tuesday for Monday's occurrence, counts toward Monday's occurrence. In the Review lists it appears on the day it was completed.

## UI

- `/todos`: habit todos show ↻.
- `/areas/[id]` for a recurring habit: the rule, current streak, 30-day rate, and a 30-day grid (done / missed / due today / not scheduled).
- `/review?group=type`: "Habit completion" lists each habit's rate for the period.
