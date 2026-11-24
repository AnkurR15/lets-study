"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { saveGoal } from "@/app/focus/actions";

export function GoalForm({ target, timeZone, zones }: { target: number; timeZone: string; zones: { value: string; label: string }[] }) {
  const [pending, startTransition] = useTransition();
  return <form className="form" action={data => startTransition(async () => {
    try { await saveGoal(data); toast.success("Daily goal updated"); }
    catch { toast.error("Could not save your goal. Enter a valid target and select a timezone."); }
  })}>
    <label>Daily target<input type="number" name="minutes" min="0.0166666667" max="1440" step="any" defaultValue={target / 60} required /></label>
    <label>Unit<select name="unit" defaultValue="minutes"><option value="minutes">Minutes</option><option value="hours">Hours</option></select></label>
    <label>Time zone<select name="timeZone" defaultValue={timeZone} required>{zones.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select><span className="field-hint">Choose where you live so today and midnight match your local time. In India, choose India (IST, GMT+5:30).</span></label>
    <button className="primary" disabled={pending}>{pending ? "Saving…" : "Save goal"}</button>
  </form>;
}
