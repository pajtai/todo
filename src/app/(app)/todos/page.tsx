import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QuickAdd } from "./quick-add";
import { TodoItem } from "./todo-item";

const LOADING = <p className="text-gray-500">Loading…</p>;

function localDate(date: Date, timeZone: string) {
  return date.toLocaleDateString("en-CA", { timeZone });
}

// A day is at most 26 hours in any timezone, so this window always covers
// "today" for the user. TodoLists then filters to the exact local day.
function startOfTodayWindow() {
  return new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
}

async function TodoLists() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [open, recent, profile] = await Promise.all([
    supabase
      .from("todos")
      .select("id, title, notes, due_on, completed_at")
      .is("completed_at", null)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("todos")
      .select("id, title, notes, due_on, completed_at")
      .gte("completed_at", startOfTodayWindow())
      .order("completed_at", { ascending: false }),
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
  ]);

  if (open.error || recent.error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your todos. Try reloading.
      </p>
    );
  }

  const timeZone = profile.data?.timezone ?? "UTC";
  const today = localDate(new Date(), timeZone);
  const completedToday = recent.data.filter(
    (todo) => localDate(new Date(todo.completed_at!), timeZone) === today,
  );

  return (
    <>
      {open.data.length === 0 ? (
        <p className="text-gray-500">Nothing to do. Add a todo above.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {open.data.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      )}
      <details open className="flex flex-col gap-2">
        <summary className="cursor-pointer font-medium">
          Completed today ({completedToday.length})
        </summary>
        <ul className="divide-y divide-gray-200">
          {completedToday.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      </details>
    </>
  );
}

export default function TodosPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Todos</h1>
      <QuickAdd />
      <Suspense fallback={LOADING}>
        <TodoLists />
      </Suspense>
    </div>
  );
}
