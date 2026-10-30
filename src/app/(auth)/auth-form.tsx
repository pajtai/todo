"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "./actions";

type AuthFormProps = {
  action: (
    previous: AuthFormState,
    formData: FormData,
  ) => Promise<AuthFormState>;
  mode: "login" | "signup";
};

export function AuthForm({ action, mode }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const isLogin = mode === "login";
  const inputClass = "rounded border border-gray-300 px-3 py-2 text-black";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">
        {isLogin ? "Log in" : "Sign up"}
      </h1>
      <label className="flex flex-col gap-1">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        Password
        <input
          name="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? undefined : 8}
          required
          className={inputClass}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-red-600">
          {state.error}
        </p>
      )}
      {state.message && <p role="status">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {isLogin ? "Log in" : "Sign up"}
      </button>
      <Link href={isLogin ? "/signup" : "/login"} className="underline">
        {isLogin ? "Need an account? Sign up" : "Have an account? Log in"}
      </Link>
    </form>
  );
}
