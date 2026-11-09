"use client";

import { useState, type ReactNode } from "react";
import { createArea } from "../categories/actions";
import { AreaForm } from "../categories/area-form";
import { createProject } from "./actions";
import { ProjectForm } from "./project-form";

type SectionHeaderProps = {
  title: string;
  /** What the plus button creates; its form opens under the heading. */
  creates: "project" | "category";
  /** Shown at the right end of the heading row, e.g. a "Manage" link. */
  aside?: ReactNode;
};

export function SectionHeader({ title, creates, aside }: SectionHeaderProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={`New ${creates}`}
            title={`New ${creates}`}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-base leading-none hover:bg-gray-100"
          >
            {open ? "−" : "+"}
          </button>
        </div>
        {aside}
      </div>
      {open && (
        <div className="rounded border border-gray-200 p-3">
          {creates === "project" ? (
            <ProjectForm action={createProject} submitLabel="Create" onDone={close} />
          ) : (
            <AreaForm action={createArea} submitLabel="Create" onDone={close} />
          )}
        </div>
      )}
    </div>
  );
}
