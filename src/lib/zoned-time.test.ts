import { describe, expect, it } from "vitest";
import { fromLocalInput, toLocalInput } from "@/lib/zoned-time";

describe("toLocalInput", () => {
  it("formats the instant on the timezone's wall clock", () => {
    const instant = new Date("2026-11-03T06:30:00Z");
    expect(toLocalInput(instant, "America/Los_Angeles")).toBe("2026-11-02T22:30");
    expect(toLocalInput(instant, "UTC")).toBe("2026-11-03T06:30");
    expect(toLocalInput(instant, "Asia/Kolkata")).toBe("2026-11-03T12:00");
  });

  it("uses 00 for midnight", () => {
    expect(toLocalInput(new Date("2026-01-01T00:05:00Z"), "UTC")).toBe(
      "2026-01-01T00:05",
    );
  });
});

describe("fromLocalInput", () => {
  it("converts a wall-clock time to the instant", () => {
    expect(fromLocalInput("2026-11-02T22:30", "America/Los_Angeles")?.toISOString()).toBe(
      "2026-11-03T06:30:00.000Z",
    );
    expect(fromLocalInput("2026-07-01T09:00", "America/Los_Angeles")?.toISOString()).toBe(
      "2026-07-01T16:00:00.000Z",
    );
    expect(fromLocalInput("2026-11-03T12:00", "Asia/Kolkata")?.toISOString()).toBe(
      "2026-11-03T06:30:00.000Z",
    );
  });

  it("round-trips with toLocalInput", () => {
    const zone = "Europe/Berlin";
    for (const iso of ["2026-03-29T00:59:00Z", "2026-10-25T01:30:00Z", "2026-06-15T12:00:00Z"]) {
      const local = toLocalInput(new Date(iso), zone);
      expect(toLocalInput(fromLocalInput(local, zone)!, zone)).toBe(local);
    }
  });

  it("moves times skipped by DST forward", () => {
    // 02:30 doesn't exist in Los Angeles on 2026-03-08.
    const instant = fromLocalInput("2026-03-08T02:30", "America/Los_Angeles")!;
    expect(toLocalInput(instant, "America/Los_Angeles")).toBe("2026-03-08T03:30");
  });

  it("rejects malformed values", () => {
    expect(fromLocalInput("", "UTC")).toBeUndefined();
    expect(fromLocalInput("2026-02-30T10:00", "UTC")).toBeUndefined();
    expect(fromLocalInput("2026-02-01T24:00", "UTC")).toBeUndefined();
    expect(fromLocalInput("2026-02-01", "UTC")).toBeUndefined();
  });
});
