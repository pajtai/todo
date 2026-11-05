"use server";

import { revalidatePath } from "next/cache";
import { AREA_TYPES, isUuid, type AreaType } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import { parseRecurrence } from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

export type AreaActionResult = { error?: string };

const MAX_NAME_LENGTH = 100;
const MAX_TITLE_LENGTH = 500;

function parseArea(formData: FormData) {
  const type = String(formData.get("type"));
  const parentId = String(formData.get("parent_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Enter a name." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Keep the name under ${MAX_NAME_LENGTH} characters.` };
  }
  if (!AREA_TYPES.includes(type as AreaType)) {
    return { error: "Choose a type." };
  }
  if (parentId && !isUuid(parentId)) {
    return { error: "Choose a valid parent." };
  }

  // Recurrence only applies to habits; other types always clear it.
  const rule =
    type === "habit"
      ? parseRecurrence(formData)
      : {
          startsOnToday: false,
          values: { recurrence: null, recurrence_days: null, starts_on: null },
        };
  if (rule.error !== undefined) {
    return { error: rule.error };
  }
  const repeats = rule.values.recurrence !== null;
  const habitTitle = String(formData.get("habit_title") ?? "").trim();
  if (habitTitle.length > MAX_TITLE_LENGTH) {
    return { error: `Keep the todo title under ${MAX_TITLE_LENGTH} characters.` };
  }

  return {
    // Null means "today in the user's timezone", filled in by the caller.
    startsOnToday: rule.startsOnToday,
    values: {
      ...rule.values,
      habit_title: repeats && habitTitle ? habitTitle : null,
      name,
      type: type as AreaType,
      parent_id: parentId || null,
      color: String(formData.get("color") ?? "") || null,
      description: String(formData.get("description") ?? "").trim() || null,
    },
  };
}

function errorMessage(code: string) {
  switch (code) {
    case "23505":
      return "You already have one of that type with this name.";
    case "TD001":
      return "That parent is inside this one, which would create a loop.";
    case "23514":
      return "Those repeat settings aren't valid.";
    case "TD002":
      return "That parent no longer exists.";
    default:
      return "Couldn't save. Try again.";
  }
}

type AreaValues = NonNullable<ReturnType<typeof parseArea>["values"]>;

async function withStartDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  values: AreaValues,
  startsOnToday: boolean | undefined,
) {
  if (!startsOnToday) {
    return values;
  }
  const { data: today } = await supabase.rpc("user_today");
  return { ...values, starts_on: today };
}

export async function createArea(formData: FormData): Promise<AreaActionResult> {
  await getCurrentUser();
  const parsed = parseArea(formData);
  if (!parsed.values) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const values = await withStartDate(supabase, parsed.values, parsed.startsOnToday);
  const { error } = await supabase.from("areas").insert(values);
  if (error) {
    return { error: errorMessage(error.code) };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function updateArea(
  id: string,
  formData: FormData,
): Promise<AreaActionResult> {
  await getCurrentUser();
  const parsed = parseArea(formData);
  if (!parsed.values) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const values = await withStartDate(supabase, parsed.values, parsed.startsOnToday);
  const { error } = await supabase.from("areas").update(values).eq("id", id);
  if (error) {
    return { error: errorMessage(error.code) };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function setAreaArchived(
  id: string,
  archived: boolean,
): Promise<AreaActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("areas")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    return { error: errorMessage(error.code) };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function deleteArea(id: string): Promise<AreaActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("areas").delete().eq("id", id);
  if (error) {
    return { error: errorMessage(error.code) };
  }

  revalidatePath("/", "layout");
  return {};
}
