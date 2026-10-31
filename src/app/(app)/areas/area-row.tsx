"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { AreaOption } from "@/lib/areas";
import { deleteArea, setAreaArchived, updateArea } from "./actions";
import { AreaForm, type AreaFormValues } from "./area-form";

type AreaRowProps = {
  area: AreaFormValues & { id: string; archived_at: string | null };
  parentName?: string;
  parents: AreaOption[];
};

export function AreaRow({ area, parentName, parents }: AreaRowProps) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const archived = area.archived_at !== null;

  function toggleArchived() {
    startTransition(async () => {
      const result = await setAreaArchived(area.id, !archived);
      setError(result.error);
    });
  }

  function remove() {
    const confirmed = window.confirm(
      `Delete "${area.name}"? Its todos stay, but lose this label.`,
    );
    if (!confirmed) {
      return;
    }
    startTransition(async () => {
      const result = await deleteArea(area.id);
      setError(result.error);
    });
  }

  if (editing) {
    return (
      <li className="py-3">
        <AreaForm
          action={(formData) => updateArea(area.id, formData)}
          area={area}
          parents={parents}
          submitLabel="Save"
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: area.color ?? undefined }}
        />
        <div className="flex flex-1 flex-col">
          <Link href={`/areas/${area.id}`} className="hover:underline">
            {area.name}
          </Link>
          {parentName && (
            <span className="text-sm text-gray-500">Part of {parentName}</span>
          )}
        </div>
        <div className="flex gap-3 text-sm text-gray-500 underline">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit "${area.name}"`}
            className="underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={toggleArchived}
            aria-label={`${archived ? "Restore" : "Archive"} "${area.name}"`}
            className="underline"
          >
            {archived ? "Restore" : "Archive"}
          </button>
          <button
            type="button"
            onClick={remove}
            aria-label={`Delete "${area.name}"`}
            className="underline"
          >
            Delete
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}
