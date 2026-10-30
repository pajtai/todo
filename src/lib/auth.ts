import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// The authoritative "who is signed in" check: getUser() validates the session
// with the Auth server. Memoized per render, and redirects if signed out. Reads
// cookies, so Server Components must call it inside a <Suspense> boundary.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { id: user.id, email: user.email ?? "" };
});
