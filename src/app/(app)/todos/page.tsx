import Link from "next/link";
import { Suspense } from "react";
import { isUuid, type AreaOption } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { selectActiveAreas, selectTodos } from "@/lib/todos";
import { AreaChip } from "../area-chip";
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

function AreaFilter({
  areas,
  selectedId,
}: {
  areas: AreaOption[];
  selectedId?: string;
}) {
  if (areas.length === 0) {
    return null;
  }
  return (
    <nav aria-label="Filter by area" className="flex flex-wrap gap-1.5">
      <Link
        href="/todos"
        aria-current={selectedId ? undefined : "true"}
        className={`rounded-full border px-2 py-0.5 text-xs ${
          selectedId ? "border-gray-300" : "border-black font-medium"
        }`}
      >
        All
      </Link>
      {areas.map((area) => (
        <AreaChip
          key={area.id}
          area={area}
          href={`/todos?area=${area.id}`}
          active={area.id === selectedId}
        />
      ))}
    </nav>
  );
}

async function TodoLists({
  searchParams,
}: {
  searchParams: PageProps<"/todos">["searchParams"];
}) {
  const { area } = await searchParams;
  const areaId = isUuid(area) ? area : undefined;
  const user = await getCurrentUser();
  const supabase = await createClient();
  // Lazily creates today's habit todos before listing. Idempotent, and a
  // failure only means habits are missing, so it doesn't block the page.
  await supabase.rpc("ensure_habit_todos");

  const [open, recent, profile, options] = await Promise.all([
    selectTodos(supabase, areaId)
      .is("completed_at", null)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    selectTodos(supabase, areaId)
      .gte("completed_at", startOfTodayWindow())
      .order("completed_at", { ascending: false }),
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
    selectActiveAreas(supabase),
  ]);

  if (open.error || recent.error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your todos. Try reloading.
      </p>
    );
  }

  const areaOptions = options.data ?? [];
  const timeZone = profile.data?.timezone ?? "UTC";
  const today = localDate(new Date(), timeZone);
  const completedToday = recent.data.filter(
    (todo) => localDate(new Date(todo.completed_at!), timeZone) === today,
  );

  return (
    <>
      <AreaFilter areas={areaOptions} selectedId={areaId} />
      {open.data.length === 0 ? (
        <p className="text-gray-500">
          {areaId ? "No open todos here." : "Nothing to do. Add a todo above."}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {open.data.map((todo) => (
            <TodoItem key={todo.id} todo={todo} areaOptions={areaOptions} />
          ))}
        </ul>
      )}
      <details open className="flex flex-col gap-2">
        <summary className="cursor-pointer font-medium">
          Completed today ({completedToday.length})
        </summary>
        <ul className="divide-y divide-gray-200">
          {completedToday.map((todo) => (
            <TodoItem key={todo.id} todo={todo} areaOptions={areaOptions} />
          ))}
        </ul>
      </details>
    </>
  );
}

export default function TodosPage({ searchParams }: PageProps<"/todos">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Todos</h1>
      <QuickAdd />
      <Suspense fallback={LOADING}>
        <TodoLists searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
