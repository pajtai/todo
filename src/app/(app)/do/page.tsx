import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadToday, loadTodoOptions, localDate, selectTodos } from "@/lib/todos";
import { TASK_LIST_CLASS } from "../_todos/task-card";
import { TodoItem, type Todo } from "../_todos/todo-item";

// A day is at most 26 hours in any timezone, so this window always covers
// "today" for the user. The page then filters to the exact local day.
function startOfTodayWindow() {
  return new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
}

async function DoLists() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  // Lazily creates today's repeating todos before listing. Idempotent, and a
  // failure only means they're missing, so it doesn't block the page.
  await supabase.rpc("ensure_habit_todos");
  const [{ today, timeZone }, options] = await Promise.all([
    loadToday(supabase, user.id),
    loadTodoOptions(supabase),
  ]);

  // Starred, due today or earlier, or a repeat scheduled for today or earlier.
  const [open, recent] = await Promise.all([
    selectTodos(supabase)
      .is("completed_at", null)
      .or(
        `starred.eq.true,due_on.lte.${today},occurrence_date.lte.${today}`,
      )
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("starred", { ascending: false })
      .order("created_at", { ascending: false }),
    selectTodos(supabase)
      .gte("completed_at", startOfTodayWindow())
      .order("completed_at", { ascending: false }),
  ]);

  if (open.error || recent.error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your todos. Try reloading.
      </p>
    );
  }

  const overdue: Todo[] = [];
  const dueToday: Todo[] = [];
  const starred: Todo[] = [];
  for (const todo of open.data) {
    if (todo.due_on !== null && todo.due_on < today) {
      overdue.push(todo);
    } else if (
      todo.due_on === today ||
      (todo.due_on === null &&
        todo.occurrence_date !== null &&
        todo.occurrence_date <= today)
    ) {
      dueToday.push(todo);
    } else {
      starred.push(todo);
    }
  }
  const completedToday = recent.data.filter(
    (todo) => localDate(new Date(todo.completed_at!), timeZone) === today,
  );

  const list = (todos: Todo[]) => (
    <ul className={TASK_LIST_CLASS}>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} {...options} today={today} />
      ))}
    </ul>
  );

  return (
    <>
      {open.data.length === 0 && (
        <p className="text-gray-500">
          Nothing to do today. Star a task, or give it today&apos;s date, to
          see it here.
        </p>
      )}
      {overdue.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="font-medium text-red-600">
            Overdue ({overdue.length})
          </h2>
          {list(overdue)}
        </section>
      )}
      {dueToday.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="font-medium">Today ({dueToday.length})</h2>
          {list(dueToday)}
        </section>
      )}
      {starred.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="font-medium">Starred ({starred.length})</h2>
          {list(starred)}
        </section>
      )}
      <details open className="flex flex-col gap-2">
        <summary className="cursor-pointer font-medium">
          Completed today ({completedToday.length})
        </summary>
        {list(completedToday)}
      </details>
    </>
  );
}

export default function DoPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Do</h1>
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <DoLists />
      </Suspense>
    </div>
  );
}
