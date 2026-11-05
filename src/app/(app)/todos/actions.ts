"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/areas";
import type { Database, TablesUpdate } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseRecurrence, type ParsedRecurrence } from "@/lib/habits";
import { fromLocalInput } from "@/lib/zoned-time";

export type TodoActionState = { error?: string; title?: string };

const MAX_TITLE_LENGTH = 500;

function validateTitle(title: string) {
  if (!title) {
    return "Enter a title.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `Keep the title under ${MAX_TITLE_LENGTH} characters.`;
  }
}

export async function createTodo(
  _previous: TodoActionState,
  formData: FormData,
): Promise<TodoActionState> {
  await getCurrentUser();
  const title = String(formData.get("title") ?? "").trim();
  const invalid = validateTitle(title);
  if (invalid) {
    return { error: invalid, title };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("todos").insert({ title });
  if (error) {
    return { error: "Couldn't add that todo. Try again.", title };
  }

  revalidatePath("/", "layout");
  return {};
}

async function setTodoAreas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  todoId: string,
  areaIds: string[],
) {
  const remove = supabase.from("todo_areas").delete().eq("todo_id", todoId);
  const { error } = await (areaIds.length > 0
    ? remove.not("area_id", "in", `(${areaIds.join(",")})`)
    : remove);
  if (error || areaIds.length === 0) {
    return error;
  }

  const { error: upsertError } = await supabase.from("todo_areas").upsert(
    areaIds.map((areaId) => ({ todo_id: todoId, area_id: areaId })),
    { onConflict: "todo_id,area_id", ignoreDuplicates: true },
  );
  return upsertError;
}

// A "Done at" value from a datetime-local input, read on the wall clock of
// the user's profile timezone so it matches what the review shows.
async function parseCompletedAt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  value: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();
  return fromLocalInput(value, profile?.timezone ?? "UTC");
}

export async function updateTodo(
  id: string,
  formData: FormData,
): Promise<TodoActionState> {
  const user = await getCurrentUser();
  const title = String(formData.get("title") ?? "").trim();
  const invalid = validateTitle(title);
  if (invalid) {
    return { error: invalid };
  }

  // Validated up front so a bad rule doesn't leave a half-saved edit.
  let rule: ParsedRecurrence | undefined;
  if (formData.get("repeat") !== null) {
    rule = parseRecurrence(formData);
    if (rule.error !== undefined) {
      return { error: rule.error };
    }
  }

  const supabase = await createClient();
  const changes: TablesUpdate<"todos"> = {
    title,
    notes: String(formData.get("notes") ?? "").trim() || null,
    due_on: String(formData.get("due_on") ?? "") || null,
  };
  // Only the review's edit form sends this field; /todos leaves it alone.
  const completedAt = formData.get("completed_at");
  if (completedAt !== null) {
    const instant = await parseCompletedAt(supabase, user.id, String(completedAt));
    if (!instant) {
      return { error: "Enter when it was done." };
    }
    if (instant.getTime() > Date.now()) {
      return { error: "The done time can't be in the future." };
    }
    changes.completed_at = instant.toISOString();
  }

  const { error } = await supabase.from("todos").update(changes).eq("id", id);
  if (error) {
    return { error: "Couldn't save your changes. Try again." };
  }

  // Starts, changes, or stops the repeat. A null start keeps the current one
  // (or today, for a new rule).
  if (rule && rule.error === undefined) {
    const { recurrence, recurrence_days, starts_on } = rule.values;
    // The generated types mark these non-null, but the function takes null
    // to mean "stop" / "no days" / "keep the start". Every argument must be
    // sent, since the function has no defaults.
    const args = {
      p_todo_id: id,
      p_recurrence: recurrence,
      p_days: recurrence_days,
      p_starts_on: starts_on,
    } as Database["public"]["Functions"]["set_todo_recurrence"]["Args"];
    const { error: repeatError } = await supabase.rpc("set_todo_recurrence", args);
    if (repeatError) {
      return { error: "Saved the todo, but couldn't update how it repeats." };
    }
  }

  const areaIds = formData.getAll("area_ids").filter(isUuid);
  const areasError = await setTodoAreas(supabase, id, areaIds);
  if (areasError) {
    return { error: "Saved, but couldn't update the areas. Try again." };
  }

  revalidatePath("/", "layout");
  return {};
}

// Takes the desired state instead of flipping the stored one, so repeated
// clicks and retries always land on what the user last asked for.
export async function setTodoCompleted(
  id: string,
  completed: boolean,
): Promise<TodoActionState> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("todos")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    return { error: "Couldn't update that todo. Try again." };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function deleteTodo(id: string): Promise<TodoActionState> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) {
    return { error: "Couldn't delete that todo. Try again." };
  }

  revalidatePath("/", "layout");
  return {};
}
