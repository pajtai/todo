"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

export async function updateTodo(
  id: string,
  formData: FormData,
): Promise<TodoActionState> {
  await getCurrentUser();
  const title = String(formData.get("title") ?? "").trim();
  const invalid = validateTitle(title);
  if (invalid) {
    return { error: invalid };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("todos")
    .update({
      title,
      notes: String(formData.get("notes") ?? "").trim() || null,
      due_on: String(formData.get("due_on") ?? "") || null,
    })
    .eq("id", id);
  if (error) {
    return { error: "Couldn't save your changes. Try again." };
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
