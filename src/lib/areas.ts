import type { Tables } from "@/lib/database.types";

// Areas are called "categories" in the UI. They're all user-defined and work
// the same way; the deprecated `areas.type` column is no longer used.
export type AreaOption = Pick<Tables<"areas">, "id" | "name" | "color">;

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** A todo's project: its optional single parent. */
export type ProjectOption = Pick<Tables<"projects">, "id" | "name">;

/** The Project dropdown's "New project…" value: create one from a typed name. */
export const NEW_PROJECT = "new";
