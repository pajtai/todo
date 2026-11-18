"use client";

import { useState } from "react";
import type { AreaOption } from "@/lib/areas";
import type { AreaInfo } from "@/lib/review";
import { AreaChip } from "../area-chip";
import { EditForm, type Todo } from "../_todos/todo-item";

export type GridDay = {
  date: string;
  /** e.g. "M" */
  weekday: string;
  /** e.g. "3" */
  dayOfMonth: string;
  /** e.g. "Tue, Nov 3", for tooltips. */
  label: string;
  isToday: boolean;
};

export type GridTodo = {
  todo: Todo;
  date: string;
  /** e.g. "Tue, Nov 3, 4:59 PM" */
  doneLabel: string;
  /** datetime-local value for the edit form. */
  completedAt: string;
};

/** A category pill under a task's name. */
export type GridChip = {
  area: AreaInfo;
  /** Filters the review to this category. */
  href: string;
  active: boolean;
};

/**
 * One line in the grid: a single todo, or every completed todo of a
 * repeating task (one series), newest first.
 */
export type GridRow = {
  key: string;
  items: GridTodo[];
  /** The newest todo's categories; empty when it has none. */
  chips: GridChip[];
};

type ReviewGridProps = {
  days: GridDay[];
  rows: GridRow[];
  areaOptions: AreaOption[];
};

// A done box takes a darker shade of the task's first category color, or gray
// when the task has no category or the category has no color.
const DEFAULT_AREA_COLOR = "#9ca3af"; // Tailwind gray-400

function boxColor(row: GridRow) {
  const color =
    row.chips.find((chip) => chip.area.color)?.area.color ??
    DEFAULT_AREA_COLOR;
  return `color-mix(in oklab, ${color} 70%, black)`;
}

export function ReviewGrid({ days, rows, areaOptions }: ReviewGridProps) {
  const [editing, setEditing] = useState<string>();
  const columns = days.length + 1;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 min-w-48 bg-white">
              <span className="sr-only">Task</span>
            </th>
            {days.map((day) => (
              <th
                key={day.date}
                scope="col"
                title={day.label}
                className={`w-7 px-0.5 pb-1 text-center text-xs leading-tight ${
                  day.isToday ? "font-semibold" : "font-normal text-gray-500"
                }`}
              >
                <span aria-hidden>
                  {day.weekday}
                  <br />
                  {day.dayOfMonth}
                </span>
                <span className="sr-only">{day.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const editingItem = row.items.find(
              (item) => editing === item.todo.id,
            );
            if (editingItem) {
              return (
                <tr key={row.key} className="border-t border-gray-200">
                  <td colSpan={columns} className="sticky left-0 py-2">
                    <div className="max-w-xl">
                      <EditForm
                        todo={editingItem.todo}
                        areaOptions={areaOptions}
                        completedAt={editingItem.completedAt}
                        onDone={() => setEditing(undefined)}
                      />
                    </div>
                  </td>
                </tr>
              );
            }
            const [latest] = row.items;
            const byDate = Map.groupBy(row.items, (item) => item.date);
            const color = boxColor(row);
            return (
              <tr key={row.key} className="border-t border-gray-200">
                <th
                  scope="row"
                  className="sticky left-0 bg-white py-1.5 pr-3 text-left align-top font-normal"
                >
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(latest.todo.id)}
                      title={`Last done ${latest.doneLabel}. Click to edit.`}
                      className="text-left hover:underline"
                    >
                      {latest.todo.title}
                    </button>
                    {row.chips.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {row.chips.map((chip) => (
                          <AreaChip
                            key={chip.area.id}
                            area={chip.area}
                            href={chip.href}
                            active={chip.active}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </th>
                {days.map((day) => {
                  const done = byDate.get(day.date);
                  if (!done) {
                    return (
                      <td key={day.date} className="p-0.5 align-top">
                        <div className="mx-auto mt-1 size-6 rounded-sm border border-gray-100" />
                      </td>
                    );
                  }
                  const label = done
                    .map((item) => `${item.todo.title}, done ${item.doneLabel}`)
                    .join("\n");
                  return (
                    <td key={day.date} className="p-0.5 align-top">
                      {/* Each box edits the todo done that day. */}
                      <button
                        type="button"
                        onClick={() => setEditing(done[0].todo.id)}
                        title={`${label}\nClick to edit.`}
                        className="mx-auto mt-1 flex size-6 items-center justify-center rounded-sm text-[10px] text-white"
                        style={{ backgroundColor: color }}
                      >
                        {done.length > 1 && done.length}
                        <span className="sr-only">Edit {label}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
