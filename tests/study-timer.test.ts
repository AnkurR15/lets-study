import { describe, expect, test } from "bun:test";
import { dayKey, elapsedAt } from "../src/lib/study/data";

describe("timer elapsed time", () => {
  const resumedAt = new Date("2026-01-01T12:00:00Z");
  test("uses timestamps after a tab or browser has been inactive", () => {
    expect(elapsedAt({ elapsedSeconds: 40, targetSeconds: 1500, status: "ACTIVE", resumedAt }, new Date("2026-01-01T12:10:00Z"))).toBe(640);
  });
  test("does not count paused time", () => {
    expect(elapsedAt({ elapsedSeconds: 40, targetSeconds: 1500, status: "PAUSED", resumedAt: null }, new Date("2026-01-02T12:00:00Z"))).toBe(40);
  });
  test("caps expired time and prevents negative elapsed time", () => {
    expect(elapsedAt({ elapsedSeconds: 40, targetSeconds: 1500, status: "ACTIVE", resumedAt }, new Date("2026-01-02T12:00:00Z"))).toBe(1500);
    expect(elapsedAt({ elapsedSeconds: 40, targetSeconds: 1500, status: "ACTIVE", resumedAt }, new Date("2026-01-01T11:00:00Z"))).toBe(40);
  });
});
describe("local study date", () => {
  test("uses the configured timezone across midnight", () => {
    const date = new Date("2026-01-01T23:30:00Z");
    expect(dayKey(date, "UTC")).toBe("2026-01-01");
    expect(dayKey(date, "Asia/Kolkata")).toBe("2026-01-02");
    expect(dayKey(date, "America/Los_Angeles")).toBe("2026-01-01");
  });
  test("handles daylight saving transitions", () => {
    expect(dayKey(new Date("2026-03-08T07:30:00Z"), "America/New_York")).toBe("2026-03-08");
  });
});
