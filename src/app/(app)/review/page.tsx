import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  AREA_TYPE_LABELS,
  AREA_TYPES,
  isUuid,
  type AreaType,
} from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import {
  breadcrumbs,
  filterTodos,
  formatDay,
  groupByArea,
  groupByDay,
  groupByType,
  localDate,
  parseAreaType,
  parseGroupBy,
  periodLabel,
  resolvePeriod,
  reviewHref,
  summarize,
  toReviewTodos,
  type AreaInfo,
  type AreaNode,
  type GroupBy,
  type HrefChanges,
  type ReviewState,
  type ReviewTodo,
} from "@/lib/review";
import { createClient } from "@/lib/supabase/server";
import { AreaChip } from "../area-chip";
import { AreaSelect } from "./area-select";

const SINGULAR: Record<AreaType, string> = {
  goal: "goal",
  project: "project",
  habit: "habit",
  area: "area",
  other: "other",
};

const GROUP_LABELS: Record<GroupBy, string> = {
  area: "By area",
  type: "By type",
  day: "By day",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-2.5 py-0.5 text-sm ${
        active ? "border-black font-medium" : "border-gray-300"
      }`}
    >
      {children}
    </Link>
  );
}

type Ctx = {
  state: ReviewState;
  today: string;
  timeZone: string;
  href: (changes: HrefChanges) => string;
};

function TodoLine({
  todo,
  ctx,
  showDate,
  showAreas,
}: {
  todo: ReviewTodo;
  ctx: Ctx;
  showDate?: boolean;
  showAreas?: boolean;
}) {
  const time = new Date(todo.completed_at).toLocaleTimeString("en-US", {
    timeZone: ctx.timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  const paths = showAreas ? breadcrumbs(todo) : [];

  return (
    <li className="flex flex-col gap-1 py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span>{todo.title}</span>
        <span className="shrink-0 text-xs text-gray-500">
          {showDate ? `${formatDay(todo.completed_local_date)}, ${time}` : time}
        </span>
      </div>
      {paths.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {paths.map((path) => (
            <span
              key={path[path.length - 1].id}
              className="flex items-center gap-1"
            >
              {path.map((area, index) => (
                <span key={area.id} className="flex items-center gap-1">
                  {index > 0 && <span className="text-gray-400">›</span>}
                  <ReviewChip area={area} ctx={ctx} />
                </span>
              ))}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

// Area chips in the review drill into that area's review, not its page.
function ReviewChip({ area, ctx }: { area: AreaInfo; ctx: Ctx }) {
  return (
    <AreaChip
      area={area}
      href={ctx.href({ area: area.id })}
      active={area.id === ctx.state.area}
    />
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-sm text-gray-500">{n}</span>;
}

function AreaTree({ nodes, ctx }: { nodes: AreaNode[]; ctx: Ctx }) {
  return (
    <ul className="flex flex-col gap-3">
      {nodes.map((node) => (
        <li key={node.area.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ReviewChip area={node.area} ctx={ctx} />
            <Count n={node.count} />
          </div>
          {node.todos.length > 0 && (
            <ul className="ml-4 divide-y divide-gray-100">
              {node.todos.map((todo) => (
                <TodoLine key={todo.todo_id} todo={todo} ctx={ctx} showDate />
              ))}
            </ul>
          )}
          {node.children.length > 0 && (
            <div className="ml-4 border-l border-gray-200 pl-3">
              <AreaTree nodes={node.children} ctx={ctx} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Unassigned({ todos, ctx }: { todos: ReviewTodo[]; ctx: Ctx }) {
  if (todos.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-1">
      <h2 className="flex items-center gap-2 font-medium">
        Unassigned <Count n={todos.length} />
      </h2>
      <ul className="divide-y divide-gray-100">
        {todos.map((todo) => (
          <TodoLine key={todo.todo_id} todo={todo} ctx={ctx} showDate />
        ))}
      </ul>
    </section>
  );
}

function ByArea({ todos, ctx }: { todos: ReviewTodo[]; ctx: Ctx }) {
  const { roots, unassigned } = groupByArea(todos);
  return (
    <>
      {roots.length > 0 && <AreaTree nodes={roots} ctx={ctx} />}
      <Unassigned todos={unassigned} ctx={ctx} />
    </>
  );
}

function ByType({ todos, ctx }: { todos: ReviewTodo[]; ctx: Ctx }) {
  const unassigned = todos.filter((todo) => todo.areas.length === 0);
  return (
    <>
      {groupByType(todos).map((group) => (
        <section key={group.type} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-medium">
            {AREA_TYPE_LABELS[group.type]} <Count n={group.count} />
          </h2>
          {group.areas.map(({ area, todos: areaTodos }) => (
            <div key={area.id} className="ml-4 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <ReviewChip area={area} ctx={ctx} />
                <Count n={areaTodos.length} />
              </div>
              <ul className="ml-4 divide-y divide-gray-100">
                {areaTodos.map((todo) => (
                  <TodoLine key={todo.todo_id} todo={todo} ctx={ctx} showDate />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      <Unassigned todos={unassigned} ctx={ctx} />
    </>
  );
}

function ByDay({ todos, ctx }: { todos: ReviewTodo[]; ctx: Ctx }) {
  return (
    <>
      {groupByDay(todos).map((day) => (
        <section key={day.date} className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-medium">
            {day.date === ctx.today ? "Today" : formatDay(day.date)}
            <Count n={day.todos.length} />
          </h2>
          <ul className="divide-y divide-gray-100">
            {day.todos.map((todo) => (
              <TodoLine key={todo.todo_id} todo={todo} ctx={ctx} showAreas />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

async function Review({
  searchParams,
}: {
  searchParams: PageProps<"/review">["searchParams"];
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timeZone = profile?.timezone ?? "UTC";
  const today = localDate(new Date(), timeZone);

  const areaParam = first(params.area);
  const state: ReviewState = {
    period: resolvePeriod(
      {
        period: first(params.period),
        date: first(params.date),
        from: first(params.from),
        to: first(params.to),
      },
      today,
    ),
    group: parseGroupBy(first(params.group)),
    type: parseAreaType(first(params.type)),
    area: isUuid(areaParam) ? areaParam : undefined,
  };
  const ctx: Ctx = {
    state,
    today,
    timeZone,
    href: (changes) => reviewHref(state, changes, today),
  };
  const { period } = state;

  const [rows, areas] = await Promise.all([
    supabase.rpc("review_completed", { p_from: period.from, p_to: period.to }),
    supabase
      .from("areas")
      .select("id, name, type, archived_at")
      .order("name"),
  ]);

  if (rows.error) {
    return (
      <p role="alert" className="text-red-600">
        Couldn&apos;t load your review. Try reloading.
      </p>
    );
  }

  const todos = filterTodos(toReviewTodos(rows.data), state);
  const summary = summarize(todos);
  const label = periodLabel(period, today);
  const areaOptions = (areas.data ?? []).map((area) => ({
    id: area.id,
    name: area.name,
    type: area.type,
    archived: area.archived_at !== null,
  }));
  const areaHrefs: Record<string, string> = {
    "": ctx.href({ area: null }),
    ...Object.fromEntries(
      areaOptions.map((area) => [area.id, ctx.href({ area: area.id })]),
    ),
  };
  const todayRange = { from: today, to: today };
  const hidden = { group: state.group, type: state.type, area: state.area };

  return (
    <>
      <div className="flex flex-col gap-3">
        <nav aria-label="Period" className="flex flex-wrap items-center gap-2">
          <Pill
            href={ctx.href({ period: { kind: "day", ...todayRange } })}
            active={period.kind === "day" && period.current}
          >
            Today
          </Pill>
          <Pill
            href={ctx.href({ period: { kind: "week", ...todayRange } })}
            active={period.kind === "week" && period.current}
          >
            This week
          </Pill>
          <Pill
            href={ctx.href({ period: { kind: "month", ...todayRange } })}
            active={period.kind === "month" && period.current}
          >
            This month
          </Pill>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href={ctx.href({ period: { kind: period.kind, ...period.prev } })}
            aria-label="Previous period"
            className="rounded border border-gray-300 px-2 py-0.5"
          >
            ←
          </Link>
          <h2 className="text-lg font-medium">{label}</h2>
          <Link
            href={ctx.href({ period: { kind: period.kind, ...period.next } })}
            aria-label="Next period"
            className="rounded border border-gray-300 px-2 py-0.5"
          >
            →
          </Link>
        </div>
        <form
          action="/review"
          className="flex flex-wrap items-end gap-2 text-sm"
        >
          <label className="flex flex-col gap-1">
            From
            <input
              type="date"
              name="from"
              required
              defaultValue={period.from}
              className="rounded border border-gray-300 px-2 py-1 text-black"
            />
          </label>
          <label className="flex flex-col gap-1">
            To
            <input
              type="date"
              name="to"
              required
              defaultValue={period.to}
              className="rounded border border-gray-300 px-2 py-1 text-black"
            />
          </label>
          {Object.entries(hidden).map(
            ([name, value]) =>
              value &&
              !(name === "group" && value === "area") && (
                <input key={name} type="hidden" name={name} value={value} />
              ),
          )}
          <button
            type="submit"
            className="rounded border border-gray-300 px-3 py-1"
          >
            Custom range
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-3 border-y border-gray-200 py-3">
        <nav aria-label="Group by" className="flex flex-wrap gap-2">
          {(Object.keys(GROUP_LABELS) as GroupBy[]).map((group) => (
            <Pill
              key={group}
              href={ctx.href({ group })}
              active={state.group === group}
            >
              {GROUP_LABELS[group]}
            </Pill>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Filter by type" className="flex flex-wrap gap-1.5">
            <Pill href={ctx.href({ type: null })} active={!state.type}>
              All types
            </Pill>
            {AREA_TYPES.map((type) => (
              <Pill
                key={type}
                href={ctx.href({ type })}
                active={state.type === type}
              >
                {AREA_TYPE_LABELS[type]}
              </Pill>
            ))}
          </nav>
          <AreaSelect
            areas={areaOptions}
            selected={state.area}
            hrefs={areaHrefs}
          />
        </div>
      </div>

      {todos.length === 0 ? (
        <div className="flex flex-col items-start gap-2 text-gray-500">
          <p>
            Nothing completed {period.current ? "yet " : ""}in this period
            {state.type || state.area ? " with these filters" : ""}.
          </p>
          {state.type || state.area ? (
            <Link
              href={ctx.href({ type: null, area: null })}
              className="underline"
            >
              Clear filters
            </Link>
          ) : (
            <Link
              href={ctx.href({ period: { kind: period.kind, ...period.prev } })}
              className="underline"
            >
              Look at the previous period
            </Link>
          )}
        </div>
      ) : (
        <>
          <p aria-label="Summary" className="text-sm">
            <span className="font-medium">{summary.total} completed</span>
            {summary.byType.map(({ type, count }) => (
              <span key={type} className="text-gray-500">
                {" · "}
                {count}{" "}
                {count === 1 ? SINGULAR[type] : AREA_TYPE_LABELS[type].toLowerCase()}
              </span>
            ))}
            {summary.unassigned > 0 && (
              <span className="text-gray-500">
                {" · "}
                {summary.unassigned} unassigned
              </span>
            )}
          </p>
          <div className="flex flex-col gap-6">
            {state.group === "area" && <ByArea todos={todos} ctx={ctx} />}
            {state.group === "type" && <ByType todos={todos} ctx={ctx} />}
            {state.group === "day" && <ByDay todos={todos} ctx={ctx} />}
          </div>
        </>
      )}
    </>
  );
}

export default function ReviewPage({ searchParams }: PageProps<"/review">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Review</h1>
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <Review searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
