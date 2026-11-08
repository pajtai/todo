"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ProjectActionResult = { error?: string };

const MAX_NAME_LENGTH = 100;

function parseProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Enter a name." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Keep the name under ${MAX_NAME_LENGTH} characters.` };
  }
  return {
    values: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
    },
  };
}

function errorMessage(code: string) {
  return code === "23505"
    ? "You already have a project with this name."
    : "Couldn't save. Try again.";
}

export async function createProject(
  formData: FormData,
): Promise<ProjectActionResult> {
  await getCurrentUser();
  const parsed = parseProject(formData);
  if (!parsed.values) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert(parsed.values);
  if (error) {
    return { error: errorMessage(error.code) };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function updateProject(
  id: string,
  formData: FormData,
): Promise<ProjectActionResult> {
  await getCurrentUser();
  const parsed = parseProject(formData);
  if (!parsed.values) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update(parsed.values)
    .eq("id", id);
  if (error) {
    return { error: errorMessage(error.code) };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function setProjectArchived(
  id: string,
  archived: boolean,
): Promise<ProjectActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    return { error: errorMessage(error.code) };
  }

  revalidatePath("/", "layout");
  return {};
}

// The project's todos stay; they just lose the project.
export async function deleteProject(id: string): Promise<ProjectActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    return { error: errorMessage(error.code) };
  }

  revalidatePath("/", "layout");
  return {};
}
