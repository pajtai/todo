# Screens

The nav has four screens. `/` and `/todos` (the old single list) redirect to `/do`. Every task list uses `TodoItem` from `src/app/(app)/_todos/`, so tasks can be checked off, starred, edited (title, notes, due date, project, categories, repeat), and deleted anywhere.

| Screen | Route | Shows |
| --- | --- | --- |
| **Do** | `/do` | Open tasks that are starred, due today or earlier, or a repeating task's occurrence for today (or an earlier, still-open one). Grouped as **Overdue** (due before today), **Today** (due today, or a repeat with no due date), and **Starred** (everything else). Plus **Completed today** |
| **Capture** | `/capture` | The quick-add box and the **Inbox**: open tasks with no project, no category, no due date, and no repeat. New tasks land here; giving one a project, category, or due date files it |
| **Plan** | `/plan` | **Deadlines**: every open task with a due date, soonest first. **Projects**: each active project with its open tasks, plus New project and Archived projects. **Categories**: open tasks *not in a project*, under each category they're in, with subcategories nested in their top-level category. Links to `/categories` to manage categories |
| **Review** | `/review` | Completed tasks over a period. See [review.md](review.md) |

"Today" is the user's local date from `profiles.timezone` (`loadToday` in `src/lib/todos.ts`).

A task can appear in more than one place on Plan: under Deadlines and its project, or under several categories.

Category pages (`/categories/[id]`) and `/categories` aren't in the nav; reach them from Plan or any category chip.
