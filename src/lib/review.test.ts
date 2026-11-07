import { describe, expect, it } from "vitest";
import {
  breadcrumbs,
  countByDay,
  datesInRange,
  filterTodos,
  groupByArea,
  groupByDay,
  isDateString,
  localDate,
  parseGroupBy,
  periodLabel,
  resolvePeriod,
  reviewHref,
  summarize,
  type ReviewArea,
  type ReviewTodo,
} from "./review";

const getFit: ReviewArea = {
  id: "fit",
  name: "Get fit",
  color: null,
  parent_id: null,
  depth: 1,
};
const marathon: ReviewArea = {
  id: "marathon",
  name: "Marathon training",
  color: "#ff0000",
  parent_id: "fit",
  depth: 0,
};
const stretch: ReviewArea = {
  id: "stretch",
  name: "Stretch",
  color: null,
  parent_id: null,
  depth: 0,
};

function todo(
  id: string,
  date: string,
  areas: ReviewArea[],
  time = "12:00:00",
): ReviewTodo {
  return {
    todo_id: id,
    title: id,
    completed_at: `${date}T${time}+00:00`,
    completed_local_date: date,
    areas,
  };
}

// The Testable End-State scenario: one in Marathon training, one in Stretch,
// one unassigned.
const run = todo("run", "2026-11-03", [marathon, getFit]);
const stretchToday = todo("stretch", "2026-11-03", [stretch], "13:00:00");
const loose = todo("loose", "2026-11-02", []);
const both = todo("both", "2026-11-01", [marathon, stretch, getFit]);

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isDateString("2026-11-03")).toBe(true);
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("2026-1-3")).toBe(false);
    expect(isDateString(undefined)).toBe(false);
  });

  it("uses the given timezone for today", () => {
    const instant = new Date("2026-11-04T06:30:00Z");
    expect(localDate(instant, "America/Los_Angeles")).toBe("2026-11-03");
    expect(localDate(instant, "UTC")).toBe("2026-11-04");
  });
});

describe("resolvePeriod", () => {
  const today = "2026-11-03";

  it("defaults to the past 7 days, ending today", () => {
    expect(resolvePeriod({}, today)).toEqual({
      kind: "7d",
      from: "2026-10-28",
      to: today,
      current: true,
      prev: { from: "2026-10-21", to: "2026-10-27" },
      next: null,
    });
  });

  it("resolves days and the past 30 days", () => {
    expect(resolvePeriod({ period: "day" }, today)).toMatchObject({
      from: today,
      to: today,
      prev: { from: "2026-11-02", to: "2026-11-02" },
      next: null,
    });
    expect(resolvePeriod({ period: "30d" }, today)).toMatchObject({
      from: "2026-10-05",
      to: today,
      prev: { from: "2026-09-05", to: "2026-10-04" },
    });
  });

  it("ends earlier periods on `date` and never steps past today", () => {
    expect(resolvePeriod({ date: "2026-10-27" }, today)).toMatchObject({
      from: "2026-10-21",
      to: "2026-10-27",
      current: false,
      next: { from: "2026-10-28", to: today },
    });
    // Two days back: the next 7 days would run into the future.
    expect(resolvePeriod({ date: "2026-11-01" }, today)).toMatchObject({
      next: { from: "2026-10-28", to: today },
    });
  });

  it("clamps future dates to today", () => {
    expect(resolvePeriod({ date: "2026-12-25" }, today)).toMatchObject({
      to: today,
      current: true,
    });
    expect(
      resolvePeriod({ from: "2026-11-01", to: "2026-11-20" }, today),
    ).toMatchObject({ from: "2026-11-01", to: today, next: null });
    expect(
      resolvePeriod({ from: "2026-11-10", to: "2026-11-20" }, today),
    ).toMatchObject({ from: today, to: today });
  });

  it("maps old week and month links to the rolling periods", () => {
    expect(resolvePeriod({ period: "week" }, today).kind).toBe("7d");
    expect(resolvePeriod({ period: "month" }, today).kind).toBe("30d");
  });

  it("treats from + to as a custom range and steps by its length", () => {
    expect(
      resolvePeriod({ from: "2026-10-20", to: "2026-10-11" }, today),
    ).toMatchObject({
      kind: "custom",
      from: "2026-10-11",
      to: "2026-10-20",
      prev: { from: "2026-10-01", to: "2026-10-10" },
      next: { from: "2026-10-21", to: "2026-10-30" },
    });
  });

  it("caps custom ranges at 366 days", () => {
    const period = resolvePeriod({ from: "2020-01-01", to: today }, today);
    expect(period.from).toBe("2025-11-03");
  });

  it("falls back to defaults for bad input", () => {
    expect(
      resolvePeriod({ period: "year", date: "nope", from: "x" }, today),
    ).toMatchObject({ kind: "7d", from: "2026-10-28", to: today });
  });

  it("labels periods relative to today", () => {
    const label = (params: object) =>
      periodLabel(resolvePeriod(params, today), today);
    expect(label({ period: "day" })).toBe("Today");
    expect(label({ period: "day", date: "2026-11-02" })).toBe("Yesterday");
    expect(label({})).toBe("Past 7 days");
    expect(label({ period: "30d" })).toBe("Past 30 days");
    expect(label({ date: "2026-10-27" })).toBe("Oct 21 – Oct 27");
    expect(label({ period: "30d", date: "2025-12-31" })).toBe(
      "Dec 2, 2025 – Dec 31, 2025",
    );
  });
});

describe("reviewHref", () => {
  const today = "2026-11-03";
  const state = { period: resolvePeriod({}, today), group: "category" as const };

  it("omits defaults", () => {
    expect(reviewHref(state, {}, today)).toBe("/review");
  });

  it("anchors periods that don't contain today", () => {
    expect(
      reviewHref(state, { period: { kind: "7d", ...state.period.prev } }, today),
    ).toBe("/review?date=2026-10-27");
    expect(
      reviewHref(state, { period: { kind: "30d", from: today, to: today } }, today),
    ).toBe("/review?period=30d");
    expect(
      reviewHref(
        state,
        { period: { kind: "day", from: today, to: today }, group: "day" },
        today,
      ),
    ).toBe("/review?period=day&group=day");
  });

  it("keeps and clears the category filter", () => {
    const filtered = { ...state, area: "stretch" };
    expect(reviewHref(filtered, {}, today)).toBe("/review?category=stretch");
    expect(reviewHref(filtered, { area: null }, today)).toBe("/review");
  });

  it("maps the retired By type grouping and the old name to the default", () => {
    expect(parseGroupBy("type")).toBe("category");
    expect(parseGroupBy("area")).toBe("category");
    expect(parseGroupBy("day")).toBe("day");
  });
});

describe("filterTodos and summarize", () => {
  const todos = [run, stretchToday, loose, both];

  it("filters by area including descendants", () => {
    expect(filterTodos(todos, { area: "fit" }).map((t) => t.todo_id)).toEqual([
      "run",
      "both",
    ]);
  });

  it("counts the total and unassigned todos", () => {
    expect(summarize(todos)).toEqual({ total: 4, unassigned: 1 });
  });
});

describe("groupByArea", () => {
  it("builds the tree with rolled-up counts and an unassigned bucket", () => {
    const { roots, unassigned } = groupByArea([run, stretchToday, loose]);
    expect(
      roots.map((node) => ({
        name: node.area.name,
        count: node.count,
        direct: node.todos.length,
        children: node.children.map((c) => [c.area.name, c.count]),
      })),
    ).toEqual([
      {
        name: "Get fit",
        count: 1,
        direct: 0,
        children: [["Marathon training", 1]],
      },
      { name: "Stretch", count: 1, direct: 1, children: [] },
    ]);
    expect(unassigned).toEqual([loose]);
  });

  it("counts a todo once per area even when attached under two branches", () => {
    const { roots } = groupByArea([both, run]);
    const fit = roots.find((n) => n.area.id === "fit")!;
    expect(fit.count).toBe(2);
    expect(fit.children[0].count).toBe(2);
    expect(Object.values(fit.days).reduce((a, b) => a + b)).toBe(2);
    expect(roots.find((n) => n.area.id === "stretch")!.count).toBe(1);
  });
});

describe("grid days", () => {
  it("lists every date in a range, across month ends", () => {
    expect(datesInRange("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(datesInRange("2026-11-03", "2026-11-03")).toEqual(["2026-11-03"]);
  });

  it("rolls per-day counts up to ancestor areas", () => {
    const { roots } = groupByArea([run, stretchToday, loose]);
    const fit = roots.find((n) => n.area.id === "fit")!;
    expect(fit.days).toEqual({ [run.completed_local_date]: 1 });
    expect(fit.children[0].days).toEqual(fit.days);
    expect(countByDay([run, loose])).toEqual(
      run.completed_local_date === loose.completed_local_date
        ? { [run.completed_local_date]: 2 }
        : { [run.completed_local_date]: 1, [loose.completed_local_date]: 1 },
    );
  });
});

describe("groupByDay and breadcrumbs", () => {
  it("groups by local date, newest first", () => {
    const days = groupByDay([loose, run, stretchToday]);
    expect(days.map((d) => [d.date, d.todos.map((t) => t.todo_id)])).toEqual([
      ["2026-11-03", ["stretch", "run"]],
      ["2026-11-02", ["loose"]],
    ]);
  });

  it("builds one root-first path per attached area", () => {
    expect(
      breadcrumbs(both).map((path) => path.map((a) => a.name).join(" › ")),
    ).toEqual(["Get fit › Marathon training", "Stretch"]);
    expect(breadcrumbs(loose)).toEqual([]);
  });
});
