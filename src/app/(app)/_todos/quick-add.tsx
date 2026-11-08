"use client";

import { useActionState } from "react";
import { createTodo } from "./actions";

export function QuickAdd() {
  const [state, formAction, pending] = useActionState(createTodo, {});

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          name="title"
          aria-label="New todo"
          placeholder="Add a todo…"
          defaultValue={state.title}
          autoComplete="off"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-black"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
