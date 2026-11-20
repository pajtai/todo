import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Base query for todos with their areas, optionally limited to one area. The
// `membership` embed exists only to filter by; `areas` keeps every chip.
export function selectTodos(supabase: Client, areaId?: string) {
  const query = supabase
    .from("todos")
    .select(
      "id, title, notes, due_on, completed_at, starred, created_at, project_id, occurrence_date, project:projects(id, name), areas!todo_areas(id, name, color), membership:todo_areas(area_id), series:todo_series(id, recurrence, recurrence_days, starts_on, ended_on)",
    );
  return areaId
    ? query.eq("membership.area_id", areaId).not("membership", "is", null)
    : query;
}

// Active repeat rules, each with its most recent todo (the one the next
// occurrence copies, ordered as in `ensure_habit_todos`), in the shape
// `selectTodos` returns.
export function selectSeriesWithLatest(supabase: Client) {
  return supabase
    .from("todo_series")
    .select(
      "id, recurrence, recurrence_days, starts_on, ended_on, todos(id, title, notes, due_on, completed_at, starred, created_at, project_id, occurrence_date, project:projects(id, name), areas!todo_areas(id, name, color))",
    )
    .is("ended_on", null)
    .order("occurrence_date", {
      referencedTable: "todos",
      ascending: false,
      nullsFirst: false,
    })
    .order("created_at", { referencedTable: "todos", ascending: false })
    .limit(1, { referencedTable: "todos" });
}

export function selectActiveAreas(supabase: Client) {
  return supabase
    .from("areas")
    .select("id, name, color")
    .is("archived_at", null)
    .order("name");
}

export function selectActiveProjects(supabase: Client) {
  return supabase
    .from("projects")
    .select("id, name")
    .is("archived_at", null)
    .order("name");
}

// What a todo's edit form can pick from: active categories and projects.
export async function loadTodoOptions(supabase: Client) {
  const [areas, projects] = await Promise.all([
    selectActiveAreas(supabase),
    selectActiveProjects(supabase),
  ]);
  return {
    areaOptions: areas.data ?? [],
    projectOptions: projects.data ?? [],
  };
}

// The user's local date (YYYY-MM-DD) in their profile timezone.
export async function loadToday(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();
  const timeZone = data?.timezone ?? "UTC";
  return { timeZone, today: localDate(new Date(), timeZone) };
}

export function localDate(date: Date, timeZone: string) {
  return date.toLocaleDateString("en-CA", { timeZone });
}
