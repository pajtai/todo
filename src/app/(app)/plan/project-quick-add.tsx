"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createTodo } from "../_todos/actions";

// "Or create one here +": adds a task straight into an empty project.
export function ProjectQuickAdd({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // Submits by hand so a failed save keeps what the user typed.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createTodo({}, formData);
      setError(result.error);
      if (!result.error) {
        form.reset();
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm text-gray-500 underline"
      >
        Or create one here +
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="flex gap-2">
        <input
          name="title"
          aria-label="New task in this project"
          placeholder="Add a task…"
          autoComplete="off"
          autoFocus
          required
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-black"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(undefined);
          }}
          className="px-2 py-2 text-sm underline"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
