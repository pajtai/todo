"use server";

import { revalidatePath } from "next/cache";
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

  revalidatePath("/todos");
  return {};
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

  revalidatePath("/todos");
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

  revalidatePath("/todos");
  return {};
}

export async function deleteTodo(id: string): Promise<TodoActionState> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) {
    return { error: "Couldn't delete that todo. Try again." };
  }

  revalidatePath("/todos");
  return {};
}
