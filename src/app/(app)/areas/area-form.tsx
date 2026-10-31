"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  AREA_TYPE_LABELS,
  AREA_TYPES,
  type AreaOption,
  type AreaType,
} from "@/lib/areas";
import type { AreaActionResult } from "./actions";

const DEFAULT_COLOR = "#6b7280";

export type AreaFormValues = {
  name: string;
  type: AreaType;
  parent_id: string | null;
  color: string | null;
  description: string | null;
};

type AreaFormProps = {
  action: (formData: FormData) => Promise<AreaActionResult>;
  parents: AreaOption[];
  area?: AreaFormValues;
  submitLabel: string;
  onDone?: () => void;
};

export function AreaForm({
  action,
  parents,
  area,
  submitLabel,
  onDone,
}: AreaFormProps) {
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
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            defaultValue={area?.name}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="type"
            defaultValue={area?.type ?? "project"}
            className={inputClass}
          >
            {AREA_TYPES.map((type) => (
              <option key={type} value={type}>
                {AREA_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Parent
          <select
            name="parent_id"
            defaultValue={area?.parent_id ?? ""}
            className={inputClass}
          >
            <option value="">None</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name} ({AREA_TYPE_LABELS[parent.type]})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Color
          <input
            name="color"
            type="color"
            defaultValue={area?.color ?? DEFAULT_COLOR}
            className="h-10.5 w-14 rounded border border-gray-300"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea
          name="description"
          defaultValue={area?.description ?? ""}
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
