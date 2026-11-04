"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { AREA_TYPE_LABELS, AREA_TYPES, type AreaOption } from "@/lib/areas";
import type { Tables } from "@/lib/database.types";
import { AreaChip } from "../area-chip";
import {
  deleteTodo,
  setTodoCompleted,
  updateTodo,
  type TodoActionState,
} from "./actions";

export type Todo = Pick<
  Tables<"todos">,
  "id" | "title" | "notes" | "due_on" | "completed_at"
> & { areas: AreaOption[]; habit_area_id?: string | null };

type TodoItemProps = {
  todo: Todo;
  areaOptions: AreaOption[];
};

export function TodoItem({ todo, areaOptions }: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const [completed, setOptimisticCompleted] = useOptimistic(
    todo.completed_at !== null,
  );

  function toggle() {
    const next = !completed;
    setError(undefined);
    startTransition(async () => {
      setOptimisticCompleted(next);
      const result = await setTodoCompleted(todo.id, next);
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
      <li className="py-2">
        <EditForm
          todo={todo}
          areaOptions={areaOptions}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={completed}
          onChange={toggle}
          aria-label={`Mark "${todo.title}" as ${completed ? "not done" : "done"}`}
          className="mt-1.5"
        />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex flex-1 flex-col text-left"
        >
          <span className={completed ? "text-gray-500 line-through" : ""}>
            {todo.habit_area_id && (
              <span title="Repeating habit" className="mr-1 text-gray-500">
                ↻<span className="sr-only">Habit:</span>
              </span>
            )}
            {todo.title}
          </span>
          {todo.notes && (
            <span className="text-sm whitespace-pre-wrap text-gray-500">
              {todo.notes}
            </span>
          )}
          {todo.due_on && (
            <span className="text-sm text-gray-500">Due {todo.due_on}</span>
          )}
        </button>
        <button
          type="button"
          onClick={remove}
          aria-label={`Delete "${todo.title}"`}
          className="text-sm text-gray-500 underline"
        >
          Delete
        </button>
      </div>
      {todo.areas.length > 0 && (
        <div className="ml-7 flex flex-wrap gap-1.5">
          {todo.areas.map((area) => (
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
  const attachedIds = new Set(todo.areas.map((area) => area.id));
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
      {pickable.length > 0 && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Areas</legend>
          {AREA_TYPES.map((type) => {
            const ofType = pickable.filter((area) => area.type === type);
            return (
              ofType.length > 0 && (
                <div key={type} className="flex flex-wrap items-center gap-3">
                  <span className="text-gray-500">
                    {AREA_TYPE_LABELS[type]}
                  </span>
                  {ofType.map((area) => (
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
              )
            );
          })}
        </fieldset>
      )}
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
