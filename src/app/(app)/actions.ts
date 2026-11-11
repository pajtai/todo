"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Only replaces the 'UTC' default, so it never overrides a chosen timezone.
export async function saveDetectedTimezone(timeZone: string) {
  if (!isValidTimeZone(timeZone)) {
    return;
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ timezone: timeZone })
    .eq("id", user.id)
    .eq("timezone", "UTC");
}

export type Theme = "light" | "dark";

// Saves the header toggle's choice. The toggle applies it to the page itself,
// so nothing needs revalidating.
export async function saveTheme(theme: Theme): Promise<{ error?: string }> {
  if (theme !== "light" && theme !== "dark") {
    return { error: "Choose light or dark." };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ theme })
    .eq("id", user.id);
  return error ? { error: "Couldn't save your theme. Try again." } : {};
}
