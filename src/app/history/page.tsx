import Link from "next/link";
import { DeleteHistory } from "./DeleteHistory";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dayKey, reconcile } from "@/lib/study/data";
import { HistoryFilters } from "@/components/history/HistoryFilters";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ date?: string; subject?: string }> }) {
  const { user } = await requireSession();
  const filters = await searchParams;
  await reconcile(user.id);
  const [settings, subjects, sessions] = await Promise.all([
    prisma.focusSettings.findUnique({ where: { userId: user.id } }),
    prisma.subject.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    prisma.studySession.findMany({ where: { userId: user.id, hiddenAt: null, status: { in: ["COMPLETED", "STOPPED"] }, ...(filters.subject ? { subjectId: filters.subject } : {}) }, include: { subject: true }, orderBy: { startedAt: "desc" } }),
  ]);
  const zone = settings?.timeZone ?? "UTC";
  const filtered = filters.date ? sessions.filter(s => dayKey(s.startedAt, zone) === filters.date) : sessions;
  return <main><nav className="topbar"><Link className="brand" href="/dashboard">let&apos;s study</Link><div><Link href="/focus">Focus</Link><Link href="/subjects">Subjects</Link><Link href="/dashboard">Dashboard</Link></div></nav><section className="content wide-content"><p className="eyebrow">YOUR PROGRESS</p><h1>Session history</h1><p className="muted">A record of the time you&apos;ve made for learning. Dates use {zone}.</p><DeleteHistory /><HistoryFilters key={`${filters.date ?? ""}:${filters.subject ?? ""}`} initialDate={filters.date ?? ""} initialSubject={filters.subject ?? ""} subjects={subjects.map(s => ({ id: s.id, name: s.name, archived: !!s.archivedAt }))} /><div className="study-card">{filtered.length === 0 ? <p className="muted">No sessions found. Start a focus session to see your progress here.</p> : <div className="table-wrap"><table><thead><tr><th>Subject</th><th>Type</th><th>Duration</th><th>Started</th><th>Ended</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(s => <tr key={s.id}><td data-label="Subject">{s.subject?.name ?? (s.kind === "FOCUS" ? "Deleted subject" : "-")}</td><td data-label="Type">{s.kind === "FOCUS" ? (s.mode === "POMODORO" ? "Pomodoro" : "Focus") : s.kind === "LONG_BREAK" ? "Long break" : "Break"}</td><td data-label="Duration">{Math.floor(s.elapsedSeconds / 60)}m {s.elapsedSeconds % 60}s</td><td data-label="Started">{s.startedAt.toLocaleString("en-GB", { timeZone: zone })}</td><td data-label="Ended">{s.completedAt?.toLocaleString("en-GB", { timeZone: zone }) ?? "-"}</td><td data-label="Status">{s.status === "COMPLETED" ? "Completed" : "Stopped early"}</td><td data-label="Action"><DeleteHistory id={s.id} /></td></tr>)}</tbody></table></div>}</div></section></main>;
}
