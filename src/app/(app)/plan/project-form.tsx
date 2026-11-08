"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ProjectActionResult } from "./actions";

export type ProjectFormValues = {
  name: string;
  description: string | null;
};

type ProjectFormProps = {
  action: (formData: FormData) => Promise<ProjectActionResult>;
  project?: ProjectFormValues;
  submitLabel: string;
  onDone?: () => void;
};

export function ProjectForm({
  action,
  project,
  submitLabel,
  onDone,
}: ProjectFormProps) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const inputClass = "rounded border border-gray-300 px-3 py-2 text-black";

  // Submits by hand because a form `action` resets the fields, which would lose
  // the user's input whenever the save fails.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await action(formData);
      setError(result.error);
      if (!result.error) {
        form.reset();
        onDone?.();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          defaultValue={project?.name}
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea
          name="description"
          defaultValue={project?.description ?? ""}
          rows={2}
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="px-3 py-1.5 text-sm underline"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
