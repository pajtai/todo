import { Constants, type Enums, type Tables } from "@/lib/database.types";

export type AreaType = Enums<"area_type">;
export type AreaOption = Pick<Tables<"areas">, "id" | "name" | "type" | "color">;

export const AREA_TYPES = Constants.public.Enums.area_type;

export const AREA_TYPE_LABELS: Record<AreaType, string> = {
  goal: "Goals",
  project: "Projects",
  habit: "Habits",
  area: "Domains",
  other: "Other",
};

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
