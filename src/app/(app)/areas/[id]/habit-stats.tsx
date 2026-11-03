import {
  describeRecurrence,
  formatRate,
  habitGrid,
  habitRate,
  type HabitRule,
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

export async function HabitStats({
  supabase,
  areaId,
  rule,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  areaId: string;
  rule: HabitRule;
}) {
  const { data: today } = await supabase.rpc("user_today");
  if (!today) {
    return null;
  }
  const from = addDays(today, -(GRID_DAYS - 1));
  const [streaks, occurrences] = await Promise.all([
    supabase.rpc("habit_streaks"),
    supabase.rpc("habit_occurrences", { p_from: from, p_to: today }),
  ]);
  const streak = streaks.data?.find((row) => row.area_id === areaId);
  const mine = (occurrences.data ?? []).filter((o) => o.area_id === areaId);
  const grid = habitGrid(mine, from, today, today);
  const current = streak?.current_streak ?? 0;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">Habit</h2>
      <p className="text-sm text-gray-500">
        {describeRecurrence(rule)}, since {formatDay(rule.starts_on!, true)}
      </p>
      <div className="flex flex-wrap gap-6 text-sm">
        <p>
          <span className="text-2xl font-semibold">{current}</span>{" "}
          {current === 1 ? "day" : "days"} streak
        </p>
        <p>
          <span className="text-2xl font-semibold">
            {formatRate(habitRate(mine, today))}
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
