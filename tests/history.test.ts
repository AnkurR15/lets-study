import { describe, expect, test } from "bun:test";
import { historyDayBounds, historyCursor, readHistoryCursor, validHistoryDate } from "../src/lib/study/history";

describe("history date boundaries", () => {
  test("handles IST and daylight saving days", () => {
    expect(historyDayBounds("2026-01-02", "Asia/Kolkata")).toEqual({ start: new Date("2026-01-01T18:30:00Z"), end: new Date("2026-01-02T18:30:00Z") });
    expect(historyDayBounds("2026-03-08", "America/New_York")).toEqual({ start: new Date("2026-03-08T05:00:00Z"), end: new Date("2026-03-09T04:00:00Z") });
    expect(historyDayBounds("2026-11-01", "America/New_York")).toEqual({ start: new Date("2026-11-01T04:00:00Z"), end: new Date("2026-11-02T05:00:00Z") });
  });
  test("handles a skipped local date and repeated midnight", () => {
    const skipped = historyDayBounds("2011-12-30", "Pacific/Apia");
    expect(skipped.start).toEqual(skipped.end);
    expect(historyDayBounds("2020-11-01", "America/Havana").start).toEqual(new Date("2020-11-01T04:00:00Z"));
  });
  test("validates dates and cursors", () => {
    expect(validHistoryDate("2026-02-30")).toBeUndefined();
    expect(validHistoryDate("2026-02-28")).toBe("2026-02-28");
    const row = { id: "session", startedAt: new Date("2026-01-01T00:00:00Z") };
    expect(readHistoryCursor(historyCursor(row))).toEqual(row);
    expect(readHistoryCursor("not-json")).toBeNull();
  });
});
