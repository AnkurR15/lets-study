"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Maximize2, Minimize2, Pause, Play, Square } from "lucide-react";
import { getActiveTimer, startTimer, updateTimer } from "@/app/focus/actions";

type Timer = { id: string; status: string; targetSeconds: number; elapsedSeconds: number; resumedAt: Date | null; kind: string; mode: string; subjectId: string | null; version: number };
type Subject = { id: string; name: string; color: string };
function remaining(session: Timer, now: number) { return Math.max(0, session.targetSeconds - session.elapsedSeconds - (session.status === "ACTIVE" && session.resumedAt ? Math.max(0, Math.floor((now - new Date(session.resumedAt).getTime()) / 1000)) : 0)); }
function display(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`; }

export function FocusTimer({ initial, subjects, serverNow }: { initial: Timer | null; subjects: Subject[]; serverNow: number }) {
  const router = useRouter();
  const [timer, setTimer] = useState(initial);
  const [now, setNow] = useState(serverNow);
  const [subjectId, setSubject] = useState(subjects[0]?.id ?? "");
  const [mode, setMode] = useState<"POMODORO" | "CUSTOM">("POMODORO");
  const [minutes, setMinutes] = useState(25);
  const [sound, setSound] = useState(false);
  const [full, setFull] = useState(false);
  const [error, setError] = useState("");
  const [pending, transition] = useTransition();
  const syncing = useRef(false);
  const notified = useRef<string | null>(null);
  const clock = useRef<{ server: number; monotonic: number | null }>({ server: serverNow, monotonic: null });
  const latestServerTime = useRef(serverNow);
  const resetClock = useCallback((time: number) => {
    if (time < latestServerTime.current) return;
    latestServerTime.current = time;
    clock.current = { server: time, monotonic: performance.now() };
    setNow(time);
  }, []);
  const active = timer && (timer.status === "ACTIVE" || timer.status === "PAUSED");
  const left = timer ? remaining(timer, now) : (mode === "POMODORO" ? 1500 : minutes * 60);
  const total = timer?.targetSeconds ?? (mode === "POMODORO" ? 1500 : minutes * 60);
  const sync = useCallback(async (id: string) => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const next = await updateTimer(id, "sync");
      resetClock(next.serverNow);
      setTimer(current => current?.id === id && next.version >= current.version ? next : current);
      setError("");
      if (next.status === "COMPLETED" && notified.current !== id) {
        notified.current = id;
        toast.success(next.kind === "FOCUS" ? "Focus session complete!" : "Break complete!");
        if ("rewards" in next && next.rewards) for (const achievement of next.rewards.achievements) toast.success(`Achievement unlocked: ${achievement}`);
        if (sound) { try { const audio = new AudioContext(); const osc = audio.createOscillator(); osc.connect(audio.destination); osc.frequency.value = 660; osc.start(); osc.stop(audio.currentTime + 0.2); osc.onended = () => { void audio.close(); }; } catch { /* Sound is optional; the saved session still completed. */ } }
        router.refresh();
      }
    } catch { setError("Could not sync your session. We will retry; your session remains saved."); }
    finally { syncing.current = false; }
  }, [router, sound, resetClock]);
  useEffect(() => {
    const tick = window.setInterval(() => {
      const current = performance.now();
      if (clock.current.monotonic === null) clock.current.monotonic = current;
      setNow(clock.current.server + (current - clock.current.monotonic));
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!initial || !["ACTIVE", "PAUSED"].includes(initial.status)) return;
    const refresh = window.setTimeout(() => {
      if (serverNow < latestServerTime.current) return;
      resetClock(serverNow);
      setTimer(current => current?.id === initial.id && current.version > initial.version ? current : initial);
    }, 0);
    return () => window.clearTimeout(refresh);
  }, [initial, serverNow, resetClock]);
  useEffect(() => {
    if (!active || !timer) return;
    const id = timer.id;
    const poll = window.setInterval(() => { void sync(id); }, 15000);
    const visible = () => { if (document.visibilityState === "visible") { void sync(id); } };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(poll); document.removeEventListener("visibilitychange", visible); };
  }, [active, timer?.id, sync, timer]);
  useEffect(() => { if (timer?.status !== "ACTIVE" || left !== 0) return; const retry = window.setTimeout(() => { void sync(timer.id); }, 2000); return () => window.clearTimeout(retry); }, [timer, left, sync]);
  function run(command: "pause" | "resume" | "stop" | "complete") {
    if (!timer) return;
    transition(async () => { try { setError(""); const next = await updateTimer(timer.id, command); resetClock(next.serverNow); setTimer(current => current?.id === next.id && current.version <= next.version ? next : current); if (command === "pause" && next.status === "PAUSED") toast.success("Session paused"); if (command === "resume" && next.status === "ACTIVE") toast.success("Session resumed"); if (command === "stop" && next.status === "STOPPED") toast("Session stopped", { description: "Stopped sessions do not count toward your daily goal." }); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Could not update session."); toast.error("Could not update the session. Please try again."); } });
  }
  function start(kind: "FOCUS" | "BREAK" | "LONG_BREAK" = "FOCUS") {
    transition(async () => { try { setError(""); const next = await startTimer({ subjectId: kind === "FOCUS" ? subjectId : null, seconds: kind === "FOCUS" ? (mode === "POMODORO" ? 1500 : minutes * 60) : kind === "BREAK" ? 300 : 900, kind, mode: kind === "FOCUS" ? mode : "POMODORO" }); resetClock(next.serverNow); setTimer(next); toast.success(kind === "FOCUS" ? "Focus session started" : "Break started"); } catch { try { const recovered = await getActiveTimer(); resetClock(recovered.serverNow); if (recovered.session) { setTimer(recovered.session); setError(""); toast.info("Restored your active session."); return; } } catch { /* Keep the original error visible if recovery also fails. */ } setError("Could not start or recover the session. Please retry or refresh."); toast.error("Could not start or recover the session."); } });
  }
  const percent = total > 0 ? (total - left) / total * 100 : 0;
  return <section className={`timer-panel study-card ${full ? "timer-full" : ""}`}><div className="row"><div><p className="overline">FOCUS TIMER</p><h2>{active ? (timer.kind === "FOCUS" ? "Time to focus" : "Take a break") : "Make space to focus"}</h2></div><button className="icon-button" onClick={() => setFull(!full)} aria-label={full ? "Exit focus mode" : "Full screen focus mode"}>{full ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button></div>
  {active && <p className="muted small">{timer.mode === "POMODORO" ? "Pomodoro" : "Custom"} session · {timer.targetSeconds / 60} minutes. To change the duration, stop this session first.</p>}
  {!active && <><p className="muted small">Choose a session duration here. Your daily goal does not change the timer.</p><div className="segmented"><button className={mode === "POMODORO" ? "selected" : ""} onClick={() => { setMode("POMODORO"); setTimer(null); }}>Pomodoro</button><button className={mode === "CUSTOM" ? "selected" : ""} onClick={() => { setMode("CUSTOM"); setTimer(null); }}>Custom</button></div><label>Subject<select value={subjectId} onChange={e => setSubject(e.target.value)}><option value="">Choose a subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{subjects.length === 0 && <p className="muted small">Create a subject before starting a focus session.</p>}{mode === "CUSTOM" && <div><div className="presets">{[1,30,45,60,90].map(n => <button key={n} className={minutes === n ? "selected" : ""} onClick={() => { setMinutes(n); setTimer(null); }}>{n} min</button>)}</div><label>Custom minutes<input type="number" min="1" max="180" value={minutes} onChange={e => { setMinutes(Number(e.target.value)); setTimer(null); }} /></label></div>}</>}
  <div className="timer-ring" style={{ background: `conic-gradient(var(--accent) ${percent}%, var(--ring) ${percent}%)` }} role="timer" aria-label={`${display(left)} remaining`}><div><span>{display(left)}</span><small>{timer?.status === "PAUSED" ? "Paused" : active ? "remaining" : "ready when you are"}</small></div></div>
  {error && <p role="alert" className="error">{error}</p>}<div className="timer-actions">{active ? <><button className="primary" disabled={pending} onClick={() => run(timer.status === "PAUSED" ? "resume" : "pause")}>{timer.status === "PAUSED" ? <Play size={17} /> : <Pause size={17} />}{timer.status === "PAUSED" ? "Resume" : "Pause"}</button><button className="outline-button" disabled={pending} onClick={() => run("stop")}><Square size={16} /> Stop early</button>{left === 0 && <button className="outline-button" disabled={pending} onClick={() => run("complete")}>Complete session</button>}</> : <><button className="primary" disabled={pending || !subjectId || (mode === "CUSTOM" && (!Number.isInteger(minutes) || minutes < 1 || minutes > 180))} onClick={() => start()}><Play size={17} /> Start {mode === "POMODORO" ? 25 : minutes}-minute focus</button><button className="outline-button" onClick={() => { setTimer(null); setMode("POMODORO"); setMinutes(25); }}>Reset</button></>}</div>
  <label className="sound-option"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /> Completion sound</label>
  {timer && !active && <div className="summary" role="status"><strong>{timer.status === "COMPLETED" ? "Session complete!" : "Session stopped"}</strong><p>{Math.floor(timer.elapsedSeconds / 60)} minutes {timer.kind === "FOCUS" ? "of focus" : "of break"}. {timer.status === "STOPPED" && "Stopped sessions do not count toward your goal."}</p>{timer.status === "COMPLETED" && timer.kind === "FOCUS" && timer.mode === "POMODORO" && <button className="outline-button" disabled={pending} onClick={() => start("BREAK")}>Start break</button>}</div>}
  <p className="muted small">If you close the app, an active timer finishes at its scheduled time and is recorded when you return. Breaks never count toward your goal.</p></section>;
}
