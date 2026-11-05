// Pure helpers for task recurrence and habit stats. Which days a repeating
// task is expected comes from the `series_occurrences` RPC; these only label
// and summarize those rows. A habit sums every repeating task attached to it.
import { addDays, isDateString } from "@/lib/review";

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

export type ParsedRecurrence =
  | { error: string }
  | {
      error?: undefined;
      /** No start date given: the caller fills in the user's today. */
      startsOnToday: boolean;
      values: HabitRule;
    };

/**
 * Reads the `recurrence`, `recurrence_days` and `starts_on` form fields. An
 * empty recurrence means "doesn't repeat" and clears the rule.
 */
export function parseRecurrence(formData: FormData): ParsedRecurrence {
  const recurrence = String(formData.get("recurrence") ?? "");
  const startsOn = String(formData.get("starts_on") ?? "");
  const days = [
    ...new Set(
      formData
        .getAll("recurrence_days")
        .map(Number)
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ];
  if (recurrence === "") {
    return {
      startsOnToday: false,
      values: { recurrence: null, recurrence_days: null, starts_on: null },
    };
  }
  if (!isRecurrence(recurrence)) {
    return { error: "Choose how often it repeats." };
  }
  if (recurrence === "weekdays" && days.length === 0) {
    return { error: "Pick at least one day." };
  }
  if (startsOn && !isDateString(startsOn)) {
    return { error: "Enter a valid start date." };
  }
  return {
    startsOnToday: !startsOn,
    values: {
      recurrence,
      recurrence_days: recurrence === "weekdays" ? days : null,
      starts_on: startsOn || null,
    },
  };
}

export type Occurrence = { area_id: string; day: string; done: boolean };

/** Per scheduled day: true when every occurrence that day was done. */
function doneByDay(occurrences: Occurrence[]) {
  const days = new Map<string, boolean>();
  for (const o of occurrences) {
    days.set(o.day, (days.get(o.day) ?? true) && o.done);
  }
  return days;
}

/**
 * Consecutive scheduled days, newest first, on which everything was done.
 * Today only adds to the streak once it's done; an open today doesn't break it.
 */
export function habitStreak(occurrences: Occurrence[], today: string) {
  const days = doneByDay(occurrences);
  let streak = 0;
  for (const day of [...days.keys()].sort().reverse()) {
    if (day > today) continue;
    if (days.get(day)) streak += 1;
    else if (day !== today) break;
  }
  return streak;
}

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
  const byDay = doneByDay(occurrences);
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
