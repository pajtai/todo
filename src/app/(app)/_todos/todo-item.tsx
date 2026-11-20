"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { NEW_PROJECT, type AreaOption, type ProjectOption } from "@/lib/areas";
import type { Tables } from "@/lib/database.types";
import { describeRecurrence } from "@/lib/habits";
import { formatDay } from "@/lib/review";
import { AreaChip } from "../area-chip";
import { RecurrenceFields } from "../recurrence-fields";
import { TASK_CARD_CLASS } from "./task-card";
import {
  convertTodo,
  deleteTodo,
  setTodoCompleted,
  setTodoStarred,
  updateTodo,
  type ConvertKind,
  type TodoActionState,
} from "./actions";

/** The repeat rule a todo belongs to. `ended_on` set means it stopped. */
export type TodoSeries = Pick<
  Tables<"todo_series">,
  "id" | "recurrence" | "recurrence_days" | "starts_on" | "ended_on"
>;

/** The rule if the todo still repeats. */
export function activeSeries(todo: Todo) {
  return todo.series && !todo.series.ended_on ? todo.series : null;
}

export type Todo = Pick<
  Tables<"todos">,
  "id" | "title" | "notes" | "due_on" | "completed_at" | "starred"
> & {
  areas: AreaOption[];
  created_at?: string;
  project?: ProjectOption | null;
  series?: TodoSeries | null;
};

type TodoItemProps = {
  todo: Todo;
  areaOptions: AreaOption[];
  /** Omitted, the edit form has no Project field and leaves it unchanged. */
  projectOptions?: ProjectOption[];
  /** The local date, YYYY-MM-DD. Set, past due dates show as overdue. */
  today?: string;
  /** Hide the project link, e.g. inside that project's own list. */
  hideProject?: boolean;
  /** Hide this category's chip, e.g. inside that category's own list. */
  hideAreaId?: string;
  /** Offer "Convert to project / category", as the inbox does. */
  convertible?: boolean;
  /**
   * YYYY-MM-DD. Set, `todo` is a repeating task's latest (completed) todo
   * standing in for the occurrence not created until this date: no checkbox
   * or Delete, and a "Next" date in place of the due date. Editing it edits
   * that latest todo, which the next occurrence copies.
   */
  upcomingOn?: string;
  /** YYYY-MM-DD. Shown as "Next …": a repeating todo scheduled after today. */
  nextOn?: string;
};

export function TodoItem({
  todo,
  areaOptions,
  projectOptions,
  today,
  hideProject,
  hideAreaId,
  convertible,
  upcomingOn,
  nextOn,
}: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const repeats = activeSeries(todo);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const [completed, setOptimisticCompleted] = useOptimistic(
    todo.completed_at !== null,
  );
  const [starred, setOptimisticStarred] = useOptimistic(todo.starred);

  function toggle() {
    const next = !completed;
    setError(undefined);
    startTransition(async () => {
      setOptimisticCompleted(next);
      const result = await setTodoCompleted(todo.id, next);
      setError(result.error);
    });
  }

  function toggleStar() {
    const next = !starred;
    setError(undefined);
    startTransition(async () => {
      setOptimisticStarred(next);
      const result = await setTodoStarred(todo.id, next);
      setError(result.error);
    });
  }

  function convert(kind: ConvertKind) {
    const confirmed = window.confirm(
      `Turn "${todo.title}" into a ${kind}? The task is removed; its notes become the description.`,
    );
    if (!confirmed) {
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await convertTodo(todo.id, kind);
      setError(result.error);
    });
  }

  function remove() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteTodo(todo.id);
      setError(result.error);
    });
  }

  if (editing) {
    return (
      <li className={`${TASK_CARD_CLASS} py-3`}>
        <EditForm
          todo={todo}
          areaOptions={areaOptions}
          projectOptions={projectOptions}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  const overdue =
    !upcomingOn &&
    !completed && today !== undefined && todo.due_on !== null && todo.due_on < today;
  const project = hideProject ? null : todo.project;
  const areas = todo.areas.filter((area) => area.id !== hideAreaId);

  return (
    <li className={`${TASK_CARD_CLASS} flex flex-col gap-1 py-2`}>
      <div className="flex items-start gap-3">
        {upcomingOn ? (
          // Nothing to check off until the occurrence exists.
          <span aria-hidden className="mt-1.5 size-[13px] shrink-0" />
        ) : (
          <input
            type="checkbox"
            checked={completed}
            onChange={toggle}
            aria-label={`Mark "${todo.title}" as ${completed ? "not done" : "done"}`}
            className="mt-1.5"
          />
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex flex-1 flex-col text-left"
        >
          <span
            className={completed && !upcomingOn ? "text-gray-500 line-through" : ""}
          >
            {repeats && (
              <span
                title={`Repeats: ${describeRecurrence(repeats)}`}
                className="mr-1 text-gray-500"
              >
                ↻<span className="sr-only">Repeats:</span>
              </span>
            )}
            {todo.title}
          </span>
          {todo.notes && (
            <span className="text-sm whitespace-pre-wrap text-gray-500">
              {todo.notes}
            </span>
          )}
          {(upcomingOn ?? nextOn) && (
            <span className="text-sm text-gray-500">
              Next {formatDay((upcomingOn ?? nextOn)!)}
            </span>
          )}
          {!upcomingOn && todo.due_on && (
            <span
              className={`text-sm ${overdue ? "text-red-600" : "text-gray-500"}`}
            >
              {overdue ? "Overdue, due" : "Due"} {todo.due_on}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={toggleStar}
          aria-pressed={starred}
          aria-label={`Star "${todo.title}"`}
          title={
            repeats
              ? starred
                ? "Unstar every repeat"
                : "Star every repeat"
              : starred
                ? "Unstar"
                : "Star"
          }
          className={starred ? "text-amber-500" : "text-gray-400"}
        >
          {starred ? "★" : "☆"}
        </button>
        {convertible && (
          <select
            value=""
            onChange={(event) => {
              const kind = event.target.value;
              if (kind === "project" || kind === "category") {
                convert(kind);
              }
            }}
            aria-label={`Convert "${todo.title}"`}
            className="rounded border border-gray-300 px-1 py-0.5 text-sm text-gray-600"
          >
            <option value="" disabled>
              Convert to…
            </option>
            <option value="project">Project</option>
            <option value="category">Category</option>
          </select>
        )}
        {!upcomingOn && (
          <button
            type="button"
            onClick={remove}
            aria-label={`Delete "${todo.title}"`}
            className="text-sm text-gray-500 underline"
          >
            Delete
          </button>
        )}
      </div>
      {(project || areas.length > 0) && (
        <div className="ml-7 flex flex-wrap gap-1.5">
          {project && (
            <Link
              href={`/plan#project-${project.id}`}
              className="inline-flex items-center rounded border border-gray-300 px-2 py-0.5 text-xs"
            >
              <span className="sr-only">Project: </span>
              {project.name}
            </Link>
          )}
          {areas.map((area) => (
            <AreaChip key={area.id} area={area} />
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}

type EditFormProps = TodoItemProps & {
  onDone: () => void;
  /** datetime-local value; when set, the form also edits when it was done. */
  completedAt?: string;
};

export function EditForm({
  todo,
  areaOptions,
  projectOptions,
  onDone,
  completedAt,
}: EditFormProps) {
  // Areas already on the todo stay listed even if archived. Otherwise saving
  // would silently detach them.
  const activeIds = new Set(areaOptions.map((area) => area.id));
  const pickable = [
    ...areaOptions,
    ...todo.areas.filter((area) => !activeIds.has(area.id)),
  ];
  // Same for an archived project already on the todo.
  const pickableProjects =
    projectOptions &&
    todo.project &&
    !projectOptions.some((project) => project.id === todo.project!.id)
      ? [...projectOptions, todo.project]
      : projectOptions;
  const attachedIds = new Set(todo.areas.map((area) => area.id));
  // Controlled so a failed save (React resets the form) keeps the choice and
  // the "New project name" box in sync.
  const [projectValue, setProjectValue] = useState(todo.project?.id ?? "");
  const newProject = projectValue === NEW_PROJECT;
  const inputClass = "rounded border border-gray-300 px-3 py-2 text-black";
  const [state, formAction, pending] = useActionState(
    async (_previous: TodoActionState, formData: FormData) => {
      const result = await updateTodo(todo.id, formData);
      if (!result.error) {
        onDone();
      }
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {todo.created_at && (
        <p className="text-sm text-gray-500">
          Created{" "}
          <time dateTime={todo.created_at}>
            {new Date(todo.created_at).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          name="title"
          defaultValue={todo.title}
          autoFocus
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notes
        <textarea
          name="notes"
          defaultValue={todo.notes ?? ""}
          rows={2}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Due date
        <input
          name="due_on"
          type="date"
          defaultValue={todo.due_on ?? ""}
          className={inputClass}
        />
      </label>
      {completedAt !== undefined && (
        <label className="flex flex-col gap-1 text-sm">
          Done at
          <input
            name="completed_at"
            type="datetime-local"
            required
            defaultValue={completedAt}
            className={inputClass}
          />
        </label>
      )}
      {pickableProjects && (
        <label className="flex flex-col gap-1 text-sm">
          Project
          <select
            name="project_id"
            value={projectValue}
            onChange={(event) => setProjectValue(event.target.value)}
            className={inputClass}
          >
            <option value="">None</option>
            {pickableProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
            <option value={NEW_PROJECT}>+ New project…</option>
          </select>
        </label>
      )}
      {pickableProjects && newProject && (
        <label className="flex flex-col gap-1 text-sm">
          New project name
          <input
            name="new_project_name"
            required
            maxLength={100}
            autoFocus
            autoComplete="off"
            className={inputClass}
          />
        </label>
      )}
      {pickable.length > 0 && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Categories</legend>
          <div className="flex flex-wrap items-center gap-3">
            {pickable.map((area) => (
              <label key={area.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="area_ids"
                  value={area.id}
                  defaultChecked={attachedIds.has(area.id)}
                />
                {area.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-3 text-sm">
        <legend className="px-1">Repeats</legend>
        {/* Tells updateTodo the repeat fields were sent. */}
        <input type="hidden" name="repeat" value="1" />
        <RecurrenceFields rule={activeSeries(todo) ?? undefined} />
        <p className="text-gray-500">
          A new copy, with this title, notes, and categories, is added on each
          scheduled day once this one is done. Its streak shows on the page of
          each category it&apos;s in.
        </p>
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 text-sm underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
