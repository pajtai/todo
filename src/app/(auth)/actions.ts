"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// `email` refills the input, because React resets the form after an action.
export type AuthFormState = { error?: string; message?: string; email?: string };

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();
  const { email, password } = credentials(formData);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, email };
  }

  redirect("/todos");
}

export async function signUp(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const { email, password } = credentials(formData);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    return { error: error.message, email };
  }

  return { message: "Check your email for a link to confirm your account." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
