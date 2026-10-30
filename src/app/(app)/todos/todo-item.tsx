"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import type { Tables } from "@/lib/database.types";
import {
  deleteTodo,
  setTodoCompleted,
  updateTodo,
  type TodoActionState,
} from "./actions";

export type Todo = Pick<
  Tables<"todos">,
  "id" | "title" | "notes" | "due_on" | "completed_at"
>;

export function TodoItem({ todo }: { todo: Todo }) {
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
        <EditForm todo={todo} onDone={() => setEditing(false)} />
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
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}

function EditForm({ todo, onDone }: { todo: Todo; onDone: () => void }) {
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
