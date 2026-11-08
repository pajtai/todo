import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadToday, loadTodoOptions, selectTodos } from "@/lib/todos";
import { QuickAdd } from "../_todos/quick-add";
import { TodoItem } from "../_todos/todo-item";

// The inbox: open tasks with no project, no category, and no due date.
// Repeating tasks are already scheduled, so they're left out.
async function Inbox() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [inbox, options, { today }] = await Promise.all([
    selectTodos(supabase)
      .is("completed_at", null)
      .is("project_id", null)
      .is("due_on", null)
      .is("series_id", null)
      .is("membership", null)
      .order("created_at", { ascending: false }),
    loadTodoOptions(supabase),
    loadToday(supabase, user.id),
  ]);

  if (inbox.error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your inbox. Try reloading.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-1">
      <h2 className="font-medium">Inbox ({inbox.data.length})</h2>
      {inbox.data.length === 0 ? (
        <p className="text-gray-500">
          Inbox zero. Everything has a project, category, or due date.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {inbox.data.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              {...options}
              today={today}
              convertible
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function CapturePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Capture</h1>
      <QuickAdd />
      <p className="-mt-4 text-sm text-gray-500">
        New tasks land in the inbox. Open one to give it a project, category,
        or due date, or use Convert to turn it into a project or category.
      </p>
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <Inbox />
      </Suspense>
    </div>
  );
}
