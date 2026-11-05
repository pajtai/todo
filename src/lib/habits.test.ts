import { describe, expect, it } from "vitest";
import {
  describeRecurrence,
  formatRate,
  habitGrid,
  habitRate,
  habitStreak,
  parseRecurrence,
} from "./habits";

const today = "2026-11-03";
const occ = (day: string, done: boolean) => ({ area_id: "h", day, done });

describe("describeRecurrence", () => {
  it("labels each rule", () => {
    expect(
      describeRecurrence({ recurrence: "daily", recurrence_days: null, starts_on: today }),
    ).toBe("Every day");
    expect(
      describeRecurrence({ recurrence: "weekly", recurrence_days: null, starts_on: "2026-11-02" }),
    ).toBe("Every Mon");
    expect(
      describeRecurrence({ recurrence: "weekdays", recurrence_days: [5, 1, 3], starts_on: today }),
    ).toBe("Mon, Wed, Fri");
    expect(
      describeRecurrence({ recurrence: null, recurrence_days: null, starts_on: null }),
    ).toBeNull();
  });
});

describe("habitRate", () => {
  it("ignores today until it's done", () => {
    const rows = [occ("2026-11-01", true), occ("2026-11-02", false), occ(today, false)];
    expect(habitRate(rows, today)).toEqual({ done: 1, expected: 2, rate: 0.5 });
    rows[2].done = true;
    expect(formatRate(habitRate(rows, today))).toBe("2/3 · 67%");
  });

  it("handles no occurrences", () => {
    expect(formatRate(habitRate([occ(today, false)], today))).toBe(
      "No occurrences yet",
    );
  });
});

describe("habitGrid", () => {
  it("marks every day in the range", () => {
    const grid = habitGrid(
      [occ("2026-11-01", true), occ("2026-11-02", false), occ(today, false)],
      "2026-10-31",
      today,
      today,
    );
    expect(grid.map((c) => c.status)).toEqual(["off", "done", "missed", "pending"]);
  });
});

describe("parseRecurrence", () => {
  const form = (fields: [string, string][]) => {
    const data = new FormData();
    fields.forEach(([key, value]) => data.append(key, value));
    return data;
  };

  it("clears the rule when it doesn't repeat", () => {
    expect(parseRecurrence(form([["recurrence", ""]]))).toEqual({
      startsOnToday: false,
      values: { recurrence: null, recurrence_days: null, starts_on: null },
    });
  });

  it("keeps days only for specific-day rules and defaults the start", () => {
    expect(
      parseRecurrence(
        form([
          ["recurrence", "weekdays"],
          ["recurrence_days", "5"],
          ["recurrence_days", "1"],
          ["recurrence_days", "9"],
          ["starts_on", "2026-11-02"],
        ]),
      ),
    ).toEqual({
      startsOnToday: false,
      values: { recurrence: "weekdays", recurrence_days: [5, 1], starts_on: "2026-11-02" },
    });
    expect(
      parseRecurrence(form([["recurrence", "daily"], ["recurrence_days", "1"]])),
    ).toEqual({
      startsOnToday: true,
      values: { recurrence: "daily", recurrence_days: null, starts_on: null },
    });
  });

  it("rejects bad input", () => {
    expect(parseRecurrence(form([["recurrence", "hourly"]])).error).toBeDefined();
    expect(parseRecurrence(form([["recurrence", "weekdays"]])).error).toBeDefined();
    expect(
      parseRecurrence(form([["recurrence", "daily"], ["starts_on", "2026-02-30"]])).error,
    ).toBeDefined();
  });
});

describe("habitStreak", () => {
  it("counts done days back to the last miss, ignoring an open today", () => {
    const list = [
      occ("2026-10-30", true),
      occ("2026-10-31", false),
      occ("2026-11-01", true),
      occ("2026-11-02", true),
      occ(today, false),
    ];
    expect(habitStreak(list, today)).toBe(2);
    expect(habitStreak([...list.slice(0, 4), occ(today, true)], today)).toBe(3);
  });

  it("needs every task on a day done when a habit has several", () => {
    const list = [
      occ("2026-11-01", true),
      occ("2026-11-02", true),
      occ("2026-11-02", false),
    ];
    expect(habitStreak(list, today)).toBe(0);
    expect(habitGrid(list, "2026-11-02", "2026-11-02", today)[0].status).toBe("missed");
  });
});
