"use client";

import { useState, useTransition } from "react";
import { deleteProject, setProjectArchived, updateProject } from "./actions";
import { ProjectForm, type ProjectFormValues } from "./project-form";

type ProjectHeaderProps = {
  project: ProjectFormValues & { id: string; archived_at: string | null };
  openCount?: number;
};

// A project's name and description, with Edit, Archive/Restore, and Delete.
export function ProjectHeader({ project, openCount }: ProjectHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const archived = project.archived_at !== null;

  function toggleArchived() {
    startTransition(async () => {
      const result = await setProjectArchived(project.id, !archived);
      setError(result.error);
    });
  }

  function remove() {
    const confirmed = window.confirm(
      `Delete "${project.name}"? Its todos stay, but lose this project.`,
    );
    if (!confirmed) {
      return;
    }
    startTransition(async () => {
      const result = await deleteProject(project.id);
      setError(result.error);
    });
  }

  if (editing) {
    return (
      <ProjectForm
        action={(formData) => updateProject(project.id, formData)}
        project={project}
        submitLabel="Save"
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-3">
        <h3 className="flex-1 font-medium">
          {project.name}
          {openCount !== undefined && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              {openCount} open
            </span>
          )}
        </h3>
        <div className="flex gap-3 text-sm text-gray-500">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit "${project.name}"`}
            className="underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={toggleArchived}
            aria-label={`${archived ? "Restore" : "Archive"} "${project.name}"`}
            className="underline"
          >
            {archived ? "Restore" : "Archive"}
          </button>
          <button
            type="button"
            onClick={remove}
            aria-label={`Delete "${project.name}"`}
            className="underline"
          >
            Delete
          </button>
        </div>
      </div>
      {project.description && (
        <p className="text-sm whitespace-pre-wrap text-gray-500">
          {project.description}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
