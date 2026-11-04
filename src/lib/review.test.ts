import { describe, expect, it } from "vitest";
import {
  breadcrumbs,
  countByDay,
  datesInRange,
  filterTodos,
  groupByArea,
  groupByDay,
  groupByType,
  isDateString,
  localDate,
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
  type: "goal",
  color: null,
  parent_id: null,
  depth: 1,
};
const marathon: ReviewArea = {
  id: "marathon",
  name: "Marathon training",
  type: "project",
  color: "#ff0000",
  parent_id: "fit",
  depth: 0,
};
const stretch: ReviewArea = {
  id: "stretch",
  name: "Stretch",
  type: "habit",
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
  const today = "2026-11-03"; // a Tuesday

  it("defaults to the current Monday–Sunday week", () => {
    const period = resolvePeriod({}, today);
    expect(period).toMatchObject({
      kind: "week",
      from: "2026-11-02",
      to: "2026-11-08",
      current: true,
      prev: { from: "2026-10-26", to: "2026-11-01" },
      next: { from: "2026-11-09", to: "2026-11-15" },
    });
  });

  it("handles a Sunday anchor as the end of its week", () => {
    expect(resolvePeriod({ date: "2026-11-08" }, today)).toMatchObject({
      from: "2026-11-02",
      to: "2026-11-08",
    });
  });

  it("resolves days and months", () => {
    expect(resolvePeriod({ period: "day" }, today)).toMatchObject({
      from: today,
      to: today,
      prev: { from: "2026-11-02" },
    });
    expect(
      resolvePeriod({ period: "month", date: "2026-03-15" }, today),
    ).toMatchObject({
      from: "2026-03-01",
      to: "2026-03-31",
      current: false,
      prev: { from: "2026-02-01", to: "2026-02-28" },
      next: { from: "2026-04-01", to: "2026-04-30" },
    });
  });

  it("treats from + to as a custom range and steps by its length", () => {
    expect(
      resolvePeriod({ from: "2026-11-10", to: "2026-11-01" }, today),
    ).toMatchObject({
      kind: "custom",
      from: "2026-11-01",
      to: "2026-11-10",
      prev: { from: "2026-10-22", to: "2026-10-31" },
      next: { from: "2026-11-11", to: "2026-11-20" },
    });
  });

  it("caps custom ranges at 366 days", () => {
    const period = resolvePeriod({ from: "2020-01-01", to: today }, today);
    expect(period.from).toBe("2025-11-03");
  });

  it("falls back to defaults for bad input", () => {
    expect(
      resolvePeriod({ period: "year", date: "nope", from: "x" }, today),
    ).toMatchObject({ kind: "week", from: "2026-11-02" });
  });

  it("labels periods relative to today", () => {
    const label = (params: object) =>
      periodLabel(resolvePeriod(params, today), today);
    expect(label({ period: "day" })).toBe("Today");
    expect(label({ period: "day", date: "2026-11-02" })).toBe("Yesterday");
    expect(label({})).toBe("This week");
    expect(label({ date: "2026-10-28" })).toBe("Last week");
    expect(label({ date: "2026-10-14" })).toBe("Oct 12 – Oct 18");
    expect(label({ period: "month" })).toBe("This month");
    expect(label({ period: "month", date: "2025-12-01" })).toBe("December 2025");
  });
});

describe("reviewHref", () => {
  const today = "2026-11-03";
  const state = { period: resolvePeriod({}, today), group: "area" as const };

  it("omits defaults", () => {
    expect(reviewHref(state, {}, today)).toBe("/review");
  });

  it("anchors periods that don't contain today", () => {
    expect(
      reviewHref(state, { period: { kind: "week", ...state.period.prev } }, today),
    ).toBe("/review?date=2026-10-26");
    expect(
      reviewHref(
        state,
        { period: { kind: "day", from: today, to: today }, group: "day" },
        today,
      ),
    ).toBe("/review?period=day&group=day");
  });

  it("keeps and clears filters", () => {
    const filtered = { ...state, type: "habit" as const, area: "stretch" };
    expect(reviewHref(filtered, {}, today)).toBe(
      "/review?type=habit&area=stretch",
    );
    expect(reviewHref(filtered, { area: null }, today)).toBe(
      "/review?type=habit",
    );
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

  it("filters by type", () => {
    expect(
      filterTodos(todos, { type: "habit" }).map((t) => t.todo_id),
    ).toEqual(["stretch", "both"]);
  });

  it("counts per type with roll-up", () => {
    expect(summarize(todos)).toEqual({
      total: 4,
      unassigned: 1,
      byType: [
        { type: "project", count: 2 },
        { type: "goal", count: 2 },
        { type: "habit", count: 2 },
      ],
    });
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

describe("groupByType", () => {
  it("lists areas of each type with their todos", () => {
    const groups = groupByType([run, stretchToday, both]);
    expect(
      groups.map((g) => [
        g.type,
        g.count,
        g.areas.map((a) => [a.area.name, a.todos.length]),
      ]),
    ).toEqual([
      ["project", 2, [["Marathon training", 2]]],
      ["goal", 2, [["Get fit", 2]]],
      ["habit", 2, [["Stretch", 2]]],
    ]);
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
