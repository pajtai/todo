"use client";

import { Fragment, useState, type ReactNode } from "react";
import type { AreaOption } from "@/lib/areas";
import type { AreaInfo } from "@/lib/review";
import { AreaChip } from "../area-chip";
import { EditForm, type Todo } from "../todos/todo-item";

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

/**
 * One line in the grid: a single todo, or every completed todo of a
 * repeating task (one series), newest first.
 */
export type GridRow = {
  key: string;
  items: GridTodo[];
};

export type GridGroup = {
  key: string;
  /** Unset for the "Unassigned" group. */
  area?: AreaInfo;
  href?: string;
  active?: boolean;
  count: number;
  /** Distinct todos per date in this group or any group below it. */
  days: Record<string, number>;
  rows: GridRow[];
  children: GridGroup[];
};

type ReviewGridProps = {
  days: GridDay[];
  groups: GridGroup[];
  areaOptions: AreaOption[];
};

// Area rows use the area's color (gray when it has none); its todos use a
// darker shade of the same color so the two read as one group.
const DEFAULT_AREA_COLOR = "#9ca3af"; // Tailwind gray-400

function todoColor(areaColor: string) {
  return `color-mix(in oklab, ${areaColor} 70%, black)`;
}

function allKeys(groups: GridGroup[]): string[] {
  return groups.flatMap((group) => [group.key, ...allKeys(group.children)]);
}

export function ReviewGrid({ days, groups, areaOptions }: ReviewGridProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<string>();
  const columns = days.length + 1;

  function toggle(key: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  function renderGroup(group: GridGroup, depth: number): ReactNode {
    const open = !collapsed.has(group.key);
    const indent = { paddingLeft: `${depth * 1}rem` };
    const name = group.area?.name ?? "Unassigned";
    const color = group.area?.color ?? DEFAULT_AREA_COLOR;

    return (
      <Fragment key={group.key}>
        <tr className="border-t border-gray-200">
          <th
            scope="row"
            className="sticky left-0 bg-white py-1.5 pr-3 text-left font-normal"
          >
            <div className="flex items-center gap-1.5" style={indent}>
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={open}
                aria-label={`${open ? "Collapse" : "Expand"} ${name}`}
                className="w-4 shrink-0 text-gray-500"
              >
                {open ? "▾" : "▸"}
              </button>
              {group.area ? (
                <AreaChip
                  area={group.area}
                  href={group.href}
                  active={group.active}
                />
              ) : (
                <span className="font-medium">{name}</span>
              )}
              <span className="text-sm text-gray-500">{group.count}</span>
            </div>
          </th>
          {days.map((day) => {
            const n = group.days[day.date] ?? 0;
            return (
              <td key={day.date} className="p-0.5">
                <div
                  title={n > 0 ? `${name}: ${n} done on ${day.label}` : undefined}
                  className={`mx-auto flex size-6 items-center justify-center rounded-sm text-[10px] ${
                    n > 0
                      ? "text-white"
                      : "border border-gray-100"
                  }`}
                  style={n > 0 ? { backgroundColor: color } : undefined}
                >
                  {n > 1 && n}
                  {n > 0 && <span className="sr-only"> done on {day.label}</span>}
                </div>
              </td>
            );
          })}
        </tr>
        {open &&
          group.rows.map((row) => {
            const editingItem = row.items.find(
              (item) => editing === `${group.key}:${item.todo.id}`,
            );
            if (editingItem) {
              return (
                <tr key={row.key}>
                  <td colSpan={columns} className="sticky left-0 py-2">
                    <div className="max-w-xl" style={indent}>
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
            return (
              <tr key={row.key} className="border-t border-gray-100">
                <th
                  scope="row"
                  className="sticky left-0 bg-white py-1 pr-3 text-left font-normal"
                >
                  <div style={{ paddingLeft: `${depth + 1.5}rem` }}>
                    <button
                      type="button"
                      onClick={() => setEditing(`${group.key}:${latest.todo.id}`)}
                      title={`Last done ${latest.doneLabel}. Click to edit.`}
                      className="text-left hover:underline"
                    >
                      {latest.todo.title}
                    </button>
                  </div>
                </th>
                {days.map((day) => {
                  const done = byDate.get(day.date);
                  if (!done) {
                    return (
                      <td key={day.date} className="p-0.5">
                        <div className="mx-auto size-6 rounded-sm border border-gray-100" />
                      </td>
                    );
                  }
                  const label = done
                    .map((item) => `${item.todo.title}, done ${item.doneLabel}`)
                    .join("\n");
                  return (
                    <td key={day.date} className="p-0.5">
                      {/* Each box edits the todo done that day. */}
                      <button
                        type="button"
                        onClick={() =>
                          setEditing(`${group.key}:${done[0].todo.id}`)
                        }
                        title={`${label}\nClick to edit.`}
                        className="mx-auto flex size-6 items-center justify-center rounded-sm text-[10px] text-white"
                        style={{ backgroundColor: todoColor(color) }}
                      >
                        {done.length > 1 && done.length}
                        <span className="sr-only">
                          Edit {label}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        {open && group.children.map((child) => renderGroup(child, depth + 1))}
      </Fragment>
    );
  }

  const keys = allKeys(groups);
  const anyOpen = keys.some((key) => !collapsed.has(key));

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          onClick={() => setCollapsed(new Set(anyOpen ? keys : []))}
          className="text-sm text-gray-500 underline"
        >
          {anyOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 min-w-48 bg-white">
                <span className="sr-only">Category or todo</span>
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
          <tbody>{groups.map((group) => renderGroup(group, 0))}</tbody>
        </table>
      </div>
    </div>
  );
}
