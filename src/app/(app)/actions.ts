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
