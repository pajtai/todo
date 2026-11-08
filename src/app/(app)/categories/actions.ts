"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AreaActionResult = { error?: string };

const MAX_NAME_LENGTH = 100;

function parseArea(formData: FormData) {
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
      color: String(formData.get("color") ?? "") || null,
      description: String(formData.get("description") ?? "").trim() || null,
    },
  };
}

function errorMessage(code: string) {
  return code === "23505"
    ? "You already have a category with this name."
    : "Couldn't save. Try again.";
}

export async function createArea(formData: FormData): Promise<AreaActionResult> {
  await getCurrentUser();
  const parsed = parseArea(formData);
  if (!parsed.values) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("areas").insert(parsed.values);
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
  const { error } = await supabase
    .from("areas")
    .update(parsed.values)
    .eq("id", id);
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
