import { describe, expect, test } from "bun:test";
import { achievementProgress, allocateGrowth, growthStage, levelFromXp } from "../src/lib/plant-growth";
describe("garden growth and levels", () => {
  test("changes stages at the five boundaries", () => {
    expect([0, 899, 900, 1799, 1800, 2699, 2700, 3599, 3600].map(growthStage)).toEqual(["Seed", "Seed", "Sprout", "Sprout", "Seedling", "Seedling", "Growing Plant", "Growing Plant", "Mature Plant"]);
  });
  test("levels progress every 100 XP", () => {
    expect([0, 99, 100, 199, 200].map(levelFromXp)).toEqual([1, 1, 2, 2, 3]);
  });
  test("accumulates focus and preserves overflow without exceeding maturity", () => {
    let growth = 0;
    for (const minutes of [25, 25, 20]) {
      const result = allocateGrowth(growth, minutes * 60, 3600);
      growth += result.added;
      if (minutes === 20) { expect(result.mature).toBe(true); expect(result.remaining).toBe(600); }
    }
    expect(growth).toBe(3600);
    expect(allocateGrowth(growth, 600, 3600)).toEqual({ added: 0, remaining: 600, mature: false });
  });
  test("achievement milestones use focus, mature plants and local consecutive dates", () => {
    const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 0, i + 1, 12)));
    const progress = achievementProgress(18000, 5, dates, "UTC");
    expect(progress["study-beginner"].current).toBe(300);
    expect(progress["green-thumb"].current).toBe(5);
    expect(progress["week-streak"].current).toBe(7);
    expect(achievementProgress(0, 0, [dates[0], dates[0], dates[2]], "UTC")["week-streak"].current).toBe(1);
  });
});
