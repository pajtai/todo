// Pure helpers for habit recurrence. Which days a habit is expected comes from
// the `habit_occurrences` RPC; these only label and summarize those rows.
import { addDays } from "@/lib/review";

export const RECURRENCES = ["daily", "weekly", "weekdays"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: "Every day",
  weekly: "Every week",
  weekdays: "On specific days",
};

/** Indexed like Postgres `extract(dow)` and JS `getDay()`: 0 = Sunday. */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isRecurrence(value: unknown): value is Recurrence {
  return RECURRENCES.includes(value as Recurrence);
}

export type HabitRule = {
  recurrence: string | null;
  recurrence_days: number[] | null;
  starts_on: string | null;
};

export function describeRecurrence(rule: HabitRule) {
  if (!isRecurrence(rule.recurrence)) {
    return null;
  }
  if (rule.recurrence === "weekly" && rule.starts_on) {
    const day = new Date(`${rule.starts_on}T00:00:00Z`).getUTCDay();
    return `Every ${WEEKDAYS[day]}`;
  }
  if (rule.recurrence === "weekdays" && rule.recurrence_days) {
    return [...rule.recurrence_days]
      .sort((a, b) => a - b)
      .map((day) => WEEKDAYS[day])
      .join(", ");
  }
  return RECURRENCE_LABELS[rule.recurrence];
}

export type Occurrence = { area_id: string; day: string; done: boolean };

/**
 * Completed vs expected occurrences. Today's occurrence only counts once it's
 * done, so an open day doesn't drag the rate down.
 */
export function habitRate(occurrences: Occurrence[], today: string) {
  const counted = occurrences.filter((o) => o.done || o.day < today);
  const done = counted.filter((o) => o.done).length;
  return {
    done,
    expected: counted.length,
    rate: counted.length === 0 ? null : done / counted.length,
  };
}

export function formatRate({
  done,
  expected,
  rate,
}: ReturnType<typeof habitRate>) {
  return rate === null
    ? "No occurrences yet"
    : `${done}/${expected} · ${Math.round(rate * 100)}%`;
}

export type GridCell = {
  day: string;
  status: "done" | "missed" | "pending" | "off";
};

/** One cell per day in [from, to], oldest first. */
export function habitGrid(
  occurrences: Occurrence[],
  from: string,
  to: string,
  today: string,
): GridCell[] {
  const byDay = new Map(occurrences.map((o) => [o.day, o.done]));
  const cells: GridCell[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const done = byDay.get(day);
    cells.push({
      day,
      status:
        done === undefined
          ? "off"
          : done
            ? "done"
            : day === today
              ? "pending"
              : "missed",
    });
  }
  return cells;
}
