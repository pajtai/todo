import { describe, expect, it } from "vitest";
import { describeRecurrence, formatRate, habitGrid, habitRate } from "./habits";

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
