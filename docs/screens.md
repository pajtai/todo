# Screens

The nav has four screens. `/` and `/todos` (the old single list) redirect to `/do`. Every task list uses `TodoItem` from `src/app/(app)/_todos/`, so tasks can be checked off, starred, edited (title, notes, due date, project, categories, repeat), and deleted anywhere.

| Screen | Route | Shows |
| --- | --- | --- |
| **Do** | `/do` | Open tasks that are starred, due today or earlier, or a repeating task's occurrence for today (or an earlier, still-open one). Grouped as **Overdue** (due before today), **Today** (due today, or a repeat with no due date), and **Starred** (everything else). Plus **Completed today** |
| **Capture** | `/capture` | The quick-add box (focused whenever the page is shown) and the **Inbox**: open tasks with no project, no category, no due date, and no repeat. New tasks land here; giving one a project, category, or due date files it. Each inbox task has a **Convert to…** dropdown that turns it into a project or a category (see below) |
| **Plan** | `/plan` | **Deadlines**: every open task with a due date, and every repeating task, by the day of its open todo (`occurrence_date`) or of its next occurrence (see below), soonest first. **Projects**: each active project with its open tasks and Archived projects (an empty project offers **Or create one here +**, an inline box that adds a task to it); the **+** beside the heading opens a New project form. **Categories**: open tasks *not in a project*, under each category they're in (each task hides the chip for the category it's listed under); the **+** beside the heading opens a New category form. Each form closes once it saves (or on Cancel). Links to `/categories` to manage categories. **Inbox** (last): the same tasks as Capture's inbox, with the same **Convert to…** dropdown |
| **Review** | `/review` | Completed tasks over a period. See [review.md](review.md) |

## Upcoming repeats on Plan

A repeating task's next todo isn't created until its day (see [habits.md](habits.md#generation-is-lazy-today-only)), so once today's is done, or on a day the rule skips, the series has no open todo. Plan still lists it: the series' latest todo stands in for the next occurrence, under Deadlines by that date and wherever the todo would be listed (its project, or its categories). It shows **Next** and the date instead of a checkbox and Delete. Editing it edits that latest todo, which the next occurrence copies; starring stars the whole series. An open repeating todo scheduled after today, such as a new weekly task whose start date is still ahead (making a task repeat turns it into the first occurrence), also shows **Next** and its date, but keeps its checkbox. Do doesn't list it until that day. `nextOccurrence` in `src/lib/habits.ts` (unit-tested) finds the date: the first day after today that matches the rule, not before `starts_on`. Stopped series (`ended_on` set) don't show.

## Creating a project from a task's edit form

The edit form's **Project** dropdown ends with **+ New project…**. Choosing it shows a **New project name** box; on Save, `updateTodo` creates the project and files the task under it. A taken name (`23505`) shows an error and leaves the task unchanged. This is the quickest way to file a new Capture task under a project that doesn't exist yet.

## Converting an inbox task

**Convert to… → Project / Category** (after a confirm) calls `convert_todo(todo, kind)`, which creates a project or category named after the task's title, with its notes as the description, and deletes the task, all in one transaction. If the name is taken (`23505`) or longer than 100 characters (`23514`), nothing changes and the item shows an error.

"Today" is the user's local date from `profiles.timezone` (`loadToday` in `src/lib/todos.ts`).

A task can appear in more than one place on Plan: under Deadlines and its project, or under several categories.

Category pages (`/categories/[id]`) and `/categories` aren't in the nav; reach them from Plan or any category chip.
