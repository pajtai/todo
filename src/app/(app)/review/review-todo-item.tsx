"use client";

import { useState, type ReactNode } from "react";
import type { AreaOption } from "@/lib/areas";
import { EditForm, type Todo } from "../todos/todo-item";

type ReviewTodoItemProps = {
  todo: Todo;
  areaOptions: AreaOption[];
  /** datetime-local value of when it was done, in the profile timezone. */
  completedAt: string;
  /** The clickable title row. */
  header: ReactNode;
  /** Rendered below the header; may hold links, so it sits outside the button. */
  children?: ReactNode;
};

// A completed todo on /review. Clicking it opens the same form as /todos,
// plus a "Done at" field.
export function ReviewTodoItem({
  todo,
  areaOptions,
  completedAt,
  header,
  children,
}: ReviewTodoItemProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="py-2">
        <EditForm
          todo={todo}
          areaOptions={areaOptions}
          completedAt={completedAt}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 py-1.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Edit"
        className="text-left"
      >
        {header}
      </button>
      {children}
    </li>
  );
}
