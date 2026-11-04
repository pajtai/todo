// Pure helpers for the Review view: periods, filtering, and grouping. They take
// rows from the `review_completed` RPC and do no I/O, so they're unit-tested.
import { AREA_TYPES, type AreaType } from "@/lib/areas";
import type { Database } from "@/lib/database.types";

export type ReviewArea = {
  id: string;
  name: string;
  type: AreaType;
  color: string | null;
  parent_id: string | null;
  /** 0 = attached directly; 1+ = an ancestor of an attached area. */
  depth: number;
};

export type ReviewTodo = {
  todo_id: string;
  title: string;
  completed_at: string;
  completed_local_date: string;
  areas: ReviewArea[];
};

type ReviewRow =
  Database["public"]["Functions"]["review_completed"]["Returns"][number];

export function toReviewTodos(rows: ReviewRow[]): ReviewTodo[] {
  return rows.map((row) => ({
    ...row,
    areas: (row.areas ?? []) as unknown as ReviewArea[],
  }));
}

// ---------------------------------------------------------------------------
// Dates. All values are local calendar dates as YYYY-MM-DD strings; the math
// runs in UTC so no host timezone can shift them.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 366;

function toDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function fromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE_PATTERN.test(value) &&
    fromDate(toDate(value)) === value
  );
}

export function addDays(date: string, days: number) {
  const result = toDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return fromDate(result);
}

function daysBetween(from: string, to: string) {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

/** Every date from `from` to `to`, inclusive. */
export function datesInRange(from: string, to: string) {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/** Distinct todos completed on each local date. */
export function countByDay(todos: ReviewTodo[]) {
  const days: Record<string, number> = {};
  for (const todo of todos) {
    days[todo.completed_local_date] = (days[todo.completed_local_date] ?? 0) + 1;
  }
  return days;
}

/** The user's current local date, e.g. "2026-11-03". */
export function localDate(instant: Date, timeZone: string) {
  return instant.toLocaleDateString("en-CA", { timeZone });
}

export function formatDay(date: string, withYear = false) {
  return toDate(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
  });
}

function formatShort(date: string, withYear: boolean) {
  return toDate(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
  });
}

// ---------------------------------------------------------------------------
// Periods

export const PERIOD_KINDS = ["day", "week", "month", "custom"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export type Range = { from: string; to: string };

export type Period = Range & {
  kind: PeriodKind;
  prev: Range;
  next: Range;
  /** True when today falls inside the period. */
  current: boolean;
};

export type PeriodParams = {
  period?: string;
  date?: string;
  from?: string;
  to?: string;
};

function rangeFor(kind: Exclude<PeriodKind, "custom">, anchor: string): Range {
  if (kind === "day") {
    return { from: anchor, to: anchor };
  }
  if (kind === "week") {
    // Weeks start on Monday.
    const sinceMonday = (toDate(anchor).getUTCDay() + 6) % 7;
    const from = addDays(anchor, -sinceMonday);
    return { from, to: addDays(from, 6) };
  }
  const from = `${anchor.slice(0, 7)}-01`;
  const nextMonth = toDate(from);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return { from, to: addDays(fromDate(nextMonth), -1) };
}

/**
 * Turns search params into a concrete period. `from` + `to` make a custom
 * range; otherwise `period` (default "week") is anchored on `date` (default
 * today). Invalid values fall back to the defaults instead of erroring.
 */
export function resolvePeriod(params: PeriodParams, today: string): Period {
  let kind: PeriodKind;
  let range: Range;
  let prev: Range;
  let next: Range;

  if (isDateString(params.from) && isDateString(params.to)) {
    kind = "custom";
    const to = params.from <= params.to ? params.to : params.from;
    const earliest = addDays(to, -(MAX_CUSTOM_DAYS - 1));
    const start = params.from <= params.to ? params.from : params.to;
    const from = start < earliest ? earliest : start;
    const length = daysBetween(from, to) + 1;
    range = { from, to };
    prev = { from: addDays(from, -length), to: addDays(from, -1) };
    next = { from: addDays(to, 1), to: addDays(to, length) };
  } else {
    kind = (["day", "week", "month"] as const).find((k) => k === params.period) ?? "week";
    const anchor = isDateString(params.date) ? params.date : today;
    range = rangeFor(kind, anchor);
    prev = rangeFor(kind, addDays(range.from, -1));
    next = rangeFor(kind, addDays(range.to, 1));
  }

  return {
    kind,
    ...range,
    prev,
    next,
    current: range.from <= today && today <= range.to,
  };
}

export function periodLabel(period: Period, today: string) {
  const sameYear = period.from.slice(0, 4) === today.slice(0, 4);
  switch (period.kind) {
    case "day":
      if (period.from === today) return "Today";
      if (period.from === addDays(today, -1)) return "Yesterday";
      return formatDay(period.from, !sameYear);
    case "week":
      if (period.current) return "This week";
      if (period.to === addDays(rangeFor("week", today).from, -1)) return "Last week";
      break;
    case "month":
      if (period.current) return "This month";
      return toDate(period.from).toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "long",
        year: "numeric",
      });
  }
  return period.from === period.to
    ? formatDay(period.from, !sameYear)
    : `${formatShort(period.from, !sameYear)} – ${formatShort(period.to, !sameYear)}`;
}

// ---------------------------------------------------------------------------
// URLs

export const GROUP_BYS = ["area", "type", "day"] as const;
export type GroupBy = (typeof GROUP_BYS)[number];

export type ReviewState = {
  period: Period;
  group: GroupBy;
  type?: AreaType;
  area?: string;
};

export function parseGroupBy(value: unknown): GroupBy {
  return GROUP_BYS.find((g) => g === value) ?? "area";
}

export function parseAreaType(value: unknown): AreaType | undefined {
  return AREA_TYPES.find((t) => t === value);
}

export type HrefChanges = {
  /** For day/week/month only the start matters: it's the anchor date. */
  period?: Range & { kind: PeriodKind };
  group?: GroupBy;
  type?: AreaType | null;
  area?: string | null;
};

/**
 * Builds a /review link from the current state with some parts replaced.
 * Defaults (the period containing today, week, group by area) are left out to
 * keep URLs short.
 */
export function reviewHref(
  state: ReviewState,
  changes: HrefChanges,
  today: string,
) {
  const period = changes.period ?? state.period;
  const params = new URLSearchParams();

  if (period.kind === "custom") {
    params.set("from", period.from);
    params.set("to", period.to);
  } else {
    if (period.kind !== "week") params.set("period", period.kind);
    if (!(period.from <= today && today <= period.to)) {
      params.set("date", period.from);
    }
  }

  const group = changes.group ?? state.group;
  if (group !== "area") params.set("group", group);

  const type = changes.type === undefined ? state.type : changes.type;
  if (type) params.set("type", type);

  const area = changes.area === undefined ? state.area : changes.area;
  if (area) params.set("area", area);

  const query = params.toString();
  return query ? `/review?${query}` : "/review";
}

// ---------------------------------------------------------------------------
// Filtering and grouping. A todo "belongs" to every area attached to it and to
// all of their ancestors, which is what makes counts roll up.

export type ReviewFilter = { type?: AreaType; area?: string };

export function filterTodos(todos: ReviewTodo[], filter: ReviewFilter) {
  return todos.filter(
    (todo) =>
      (!filter.area || todo.areas.some((a) => a.id === filter.area)) &&
      (!filter.type || todo.areas.some((a) => a.type === filter.type)),
  );
}

export type Summary = {
  total: number;
  unassigned: number;
  byType: { type: AreaType; count: number }[];
};

export function summarize(todos: ReviewTodo[]): Summary {
  return {
    total: todos.length,
    unassigned: todos.filter((todo) => todo.areas.length === 0).length,
    byType: AREA_TYPES.map((type) => ({
      type,
      count: todos.filter((todo) => todo.areas.some((a) => a.type === type))
        .length,
    })).filter((entry) => entry.count > 0),
  };
}

export type AreaInfo = Omit<ReviewArea, "depth">;

export type AreaNode = {
  area: AreaInfo;
  /** Distinct todos in this area or any area below it. */
  count: number;
  /** Like `count`, per local completion date. */
  days: Record<string, number>;
  /** Todos attached directly to this area. */
  todos: ReviewTodo[];
  children: AreaNode[];
};

function info(area: ReviewArea): AreaInfo {
  const { id, name, type, color, parent_id } = area;
  return { id, name, type, color, parent_id };
}

function byCountThenName(a: AreaNode, b: AreaNode) {
  return b.count - a.count || a.area.name.localeCompare(b.area.name);
}

export function groupByArea(todos: ReviewTodo[]): {
  roots: AreaNode[];
  unassigned: ReviewTodo[];
} {
  const nodes = new Map<string, AreaNode>();
  const unassigned: ReviewTodo[] = [];

  for (const todo of todos) {
    if (todo.areas.length === 0) {
      unassigned.push(todo);
      continue;
    }
    for (const area of todo.areas) {
      let node = nodes.get(area.id);
      if (!node) {
        node = { area: info(area), count: 0, days: {}, todos: [], children: [] };
        nodes.set(area.id, node);
      }
      // The RPC lists each area once per todo, so this counts distinct todos.
      node.count += 1;
      const day = todo.completed_local_date;
      node.days[day] = (node.days[day] ?? 0) + 1;
      if (area.depth === 0) {
        node.todos.push(todo);
      }
    }
  }

  const roots: AreaNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.area.parent_id
      ? nodes.get(node.area.parent_id)
      : undefined;
    (parent ? parent.children : roots).push(node);
  }

  const sort = (list: AreaNode[]) => {
    list.sort(byCountThenName);
    list.forEach((node) => sort(node.children));
  };
  sort(roots);

  return { roots, unassigned };
}

export type TypeGroup = {
  type: AreaType;
  count: number;
  areas: { area: AreaInfo; todos: ReviewTodo[] }[];
};

export function groupByType(todos: ReviewTodo[]): TypeGroup[] {
  return AREA_TYPES.map((type) => {
    const areas = new Map<string, { area: AreaInfo; todos: ReviewTodo[] }>();
    let count = 0;
    for (const todo of todos) {
      const ofType = todo.areas.filter((a) => a.type === type);
      if (ofType.length > 0) count += 1;
      for (const area of ofType) {
        const entry = areas.get(area.id) ?? { area: info(area), todos: [] };
        entry.todos.push(todo);
        areas.set(area.id, entry);
      }
    }
    return {
      type,
      count,
      areas: [...areas.values()].sort(
        (a, b) =>
          b.todos.length - a.todos.length ||
          a.area.name.localeCompare(b.area.name),
      ),
    };
  }).filter((group) => group.count > 0);
}

export function groupByDay(
  todos: ReviewTodo[],
): { date: string; todos: ReviewTodo[] }[] {
  const days = new Map<string, ReviewTodo[]>();
  for (const todo of todos) {
    const list = days.get(todo.completed_local_date) ?? [];
    list.push(todo);
    days.set(todo.completed_local_date, list);
  }
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      todos: list.sort((a, b) => b.completed_at.localeCompare(a.completed_at)),
    }));
}

/**
 * One path per directly attached area, from the top-level ancestor down, e.g.
 * [[Get fit, Marathon training], [Stretch]].
 */
export function breadcrumbs(todo: ReviewTodo): AreaInfo[][] {
  const byId = new Map(todo.areas.map((area) => [area.id, area]));
  return todo.areas
    .filter((area) => area.depth === 0)
    .map((area) => {
      const path: AreaInfo[] = [];
      const seen = new Set<string>();
      let current: ReviewArea | undefined = area;
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        path.unshift(info(current));
        current = current.parent_id ? byId.get(current.parent_id) : undefined;
      }
      return path;
    });
}
