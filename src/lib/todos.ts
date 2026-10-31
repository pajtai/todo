import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Base query for todos with their areas, optionally limited to one area. The
// `membership` embed exists only to filter by; `areas` keeps every chip.
export function selectTodos(supabase: Client, areaId?: string) {
  const query = supabase
    .from("todos")
    .select(
      "id, title, notes, due_on, completed_at, areas(id, name, type, color), membership:todo_areas(area_id)",
    );
  return areaId
    ? query.eq("membership.area_id", areaId).not("membership", "is", null)
    : query;
}

export function selectActiveAreas(supabase: Client) {
  return supabase
    .from("areas")
    .select("id, name, type, color")
    .is("archived_at", null)
    .order("name");
}
