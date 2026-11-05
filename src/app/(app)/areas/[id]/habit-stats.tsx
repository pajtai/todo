import type { Tables } from "@/lib/database.types";
import {
  describeRecurrence,
  formatRate,
  habitGrid,
  habitRate,
  habitStreak,
  type Occurrence,
} from "@/lib/habits";
import { addDays, formatDay } from "@/lib/review";
import type { createClient } from "@/lib/supabase/server";

const GRID_DAYS = 30;

const CELL_STYLES = {
  done: "bg-green-600",
  missed: "bg-red-300",
  pending: "border-2 border-green-600",
  off: "bg-gray-100",
} as const;

const CELL_LABELS = {
  done: "done",
  missed: "missed",
  pending: "due today",
  off: "not scheduled",
} as const;

type SeriesRow = Pick<
  Tables<"todo_series">,
  "id" | "recurrence" | "recurrence_days" | "starts_on" | "ended_on"
> & {
  todos: Pick<Tables<"todos">, "title" | "occurrence_date" | "created_at">[];
};

// The most recent todo of a series names it.
function latestTitle(series: SeriesRow) {
  const [latest] = series.todos.toSorted(
    (a, b) =>
      (b.occurrence_date ?? "").localeCompare(a.occurrence_date ?? "") ||
      b.created_at.localeCompare(a.created_at),
  );
  return latest?.title ?? "Untitled";
}

// Stats for a habit: every repeating task attached to it, combined.
export async function HabitStats({
  supabase,
  areaId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  areaId: string;
}) {
  const { data: today } = await supabase.rpc("user_today");
  if (!today) {
    return null;
  }
  const from = addDays(today, -(GRID_DAYS - 1));
  // All history, for the streak. Series only generate days from their start.
  const { data: occurrences } = await supabase.rpc("series_occurrences", {
    p_from: "2000-01-01",
    p_to: today,
  });
  const all = ((occurrences ?? []) as Occurrence[]).filter(
    (o) => o.area_id === areaId,
  );
  const seriesIds = [
    ...new Set(
      (occurrences ?? [])
        .filter((o) => o.area_id === areaId)
        .map((o) => o.series_id),
    ),
  ];
  const { data: series } = seriesIds.length
    ? await supabase
        .from("todo_series")
        .select(
          "id, recurrence, recurrence_days, starts_on, ended_on, todos(title, occurrence_date, created_at)",
        )
        .in("id", seriesIds)
    : { data: [] as SeriesRow[] };

  if (all.length === 0) {
    return (
      <section className="flex flex-col gap-1">
        <h2 className="font-medium">Habit</h2>
        <p className="text-sm text-gray-500">
          No repeating tasks yet. Attach a task to this habit and set how it
          repeats when you edit it.
        </p>
      </section>
    );
  }

  const recent = all.filter((o) => o.day >= from);
  const grid = habitGrid(recent, from, today, today);
  const current = habitStreak(all, today);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">Habit</h2>
      <ul className="flex flex-col gap-0.5 text-sm">
        {(series ?? []).map((row) => (
          <li key={row.id}>
            {latestTitle(row)}{" "}
            <span className="text-gray-500">
              · {describeRecurrence(row)}, since{" "}
              {formatDay(row.starts_on, true)}
              {row.ended_on && `, stopped ${formatDay(row.ended_on, true)}`}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-6 text-sm">
        <p>
          <span className="text-2xl font-semibold">{current}</span>{" "}
          {current === 1 ? "day" : "days"} streak
        </p>
        <p>
          <span className="text-2xl font-semibold">
            {formatRate(habitRate(recent, today))}
          </span>{" "}
          last {GRID_DAYS} days
        </p>
      </div>
      <ol
        aria-label={`Last ${GRID_DAYS} days`}
        className="grid grid-cols-10 gap-1 sm:grid-cols-15"
      >
        {grid.map((cell) => (
          <li
            key={cell.day}
            title={`${formatDay(cell.day)}: ${CELL_LABELS[cell.status]}`}
            className={`aspect-square rounded-sm ${CELL_STYLES[cell.status]}`}
          >
            <span className="sr-only">
              {formatDay(cell.day)}: {CELL_LABELS[cell.status]}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
