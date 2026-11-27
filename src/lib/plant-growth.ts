export const GROWTH_SECONDS = 3600;
export function growthStage(seconds: number) {
  if (seconds >= 3600) return "Mature Plant";
  if (seconds >= 2700) return "Growing Plant";
  if (seconds >= 1800) return "Seedling";
  if (seconds >= 900) return "Sprout";
  return "Seed";
}
export function levelFromXp(xp: number) { return Math.floor(Math.max(0, xp) / 100) + 1; }

export function allocateGrowth(current: number, banked: number, duration: number) {
  const added = Math.min(Math.max(0, banked), Math.max(0, duration - current));
  return { added, remaining: banked - added, mature: current < duration && current + added >= duration };
}

export function achievementProgress(seconds: number, mature: number, dates: Date[], timeZone: string): Record<string, { current: number; target: number; unit: string }> {
  const days = new Set(dates.map(date => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)));
  let streak = 0, longest = 0, previous = 0;
  for (const day of [...days].sort()) {
    const value = Date.parse(`${day}T00:00:00Z`);
    streak = value - previous === 86400000 ? streak + 1 : 1;
    longest = Math.max(longest, streak);
    previous = value;
  }
  return {
    "first-session": { current: dates.length, target: 1, unit: "sessions" },
    "first-plant": { current: mature, target: 1, unit: "plants" },
    "study-beginner": { current: Math.floor(seconds / 60), target: 300, unit: "minutes" },
    "dedicated-learner": { current: Math.floor(seconds / 60), target: 600, unit: "minutes" },
    "focus-master": { current: Math.floor(seconds / 60), target: 1500, unit: "minutes" },
    "green-thumb": { current: mature, target: 5, unit: "plants" },
    "garden-keeper": { current: mature, target: 10, unit: "plants" },
    "week-streak": { current: longest, target: 7, unit: "days" },
  };
}
