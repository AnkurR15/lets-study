import { GoalForm } from "./GoalForm";

export function DailyGoalProgress({ seconds, target, timeZone }: { seconds: number; target: number; timeZone: string }) {
  const percentage = Math.min(100, Math.floor(seconds / target * 100));
  const now = new Date();
  const choices = Array.from(new Set(["Asia/Kolkata", "UTC", "Europe/London", timeZone, ...Intl.supportedValuesOf("timeZone")]));
  const zones = choices.map(value => {
    let offset = "";
    try { offset = new Intl.DateTimeFormat("en", { timeZone: value, timeZoneName: "shortOffset" }).formatToParts(now).find(part => part.type === "timeZoneName")?.value ?? ""; } catch { /* The server validates submitted timezones. */ }
    const name = value === "Asia/Kolkata" ? "India (IST)" : value === "UTC" ? "Coordinated Universal Time" : value.replaceAll("_", " ").replaceAll("/", " / ");
    return { value, label: `${name} (${offset})` };
  });
  return <section className="study-card"><div className="row"><div><p className="overline">DAILY GOAL</p><h2>{Math.floor(seconds / 60)} / {Math.ceil(target / 60)} min</h2></div><strong>{percentage}%</strong></div><progress max={100} value={percentage} aria-label="Daily study goal progress" /><p className="muted small">{seconds >= target ? "Your daily goal is complete. Wonderful work!" : `${Math.ceil((target - seconds) / 60)} minutes remaining today.`}</p><p className="muted small">Your daily goal is the amount of focus time you want to complete each day. It resets at midnight in your chosen timezone.</p><details><summary>Adjust goal and timezone</summary><GoalForm target={target} timeZone={timeZone} zones={zones} /></details></section>;
}
