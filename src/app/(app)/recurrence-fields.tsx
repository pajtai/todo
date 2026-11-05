"use client";

import { useState } from "react";
import {
  RECURRENCE_LABELS,
  RECURRENCES,
  WEEKDAYS,
  type HabitRule,
} from "@/lib/habits";

const INPUT_CLASS = "rounded border border-gray-300 px-3 py-2 text-black";

// The `recurrence`, `starts_on` and `recurrence_days` fields read by
// parseRecurrence. Used by the area form and the habit todo edit form.
export function RecurrenceFields({
  rule,
  onRecurrenceChange,
}: {
  rule?: HabitRule;
  onRecurrenceChange?: (recurrence: string) => void;
}) {
  const [recurrence, setRecurrence] = useState(rule?.recurrence ?? "");

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          Recurrence
          <select
            name="recurrence"
            value={recurrence}
            onChange={(event) => {
              setRecurrence(event.target.value);
              onRecurrenceChange?.(event.target.value);
            }}
            className={INPUT_CLASS}
          >
            <option value="">Doesn&apos;t repeat</option>
            {RECURRENCES.map((value) => (
              <option key={value} value={value}>
                {RECURRENCE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        {recurrence && (
          <label className="flex flex-col gap-1">
            Starts on
            <input
              name="starts_on"
              type="date"
              defaultValue={rule?.starts_on ?? ""}
              className={INPUT_CLASS}
            />
          </label>
        )}
      </div>
      {recurrence === "weekly" && (
        <p className="text-gray-500">
          Repeats on the weekday of the start date (today if empty).
        </p>
      )}
      {recurrence === "weekdays" && (
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((label, day) => (
            <label key={label} className="flex items-center gap-1">
              <input
                type="checkbox"
                name="recurrence_days"
                value={day}
                defaultChecked={rule?.recurrence_days?.includes(day)}
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </>
  );
}
