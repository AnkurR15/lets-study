import Link from "next/link";
import { DeleteHistory } from "./DeleteHistory";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { reconcile } from "@/lib/study/data";
import { getHistoryPage, historyCursor, validHistoryDate } from "@/lib/study/history";
import { HistoryFilters } from "@/components/history/HistoryFilters";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ date?: string; subject?: string; after?: string; before?: string }> }) {
  const { user } = await requireSession();
  const filters = await searchParams;
  await reconcile(user.id);
  const [settings, subjects] = await Promise.all([
    prisma.focusSettings.findUnique({ where: { userId: user.id } }),
    prisma.subject.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);
  const zone = settings?.timeZone ?? "UTC";
  const date = validHistoryDate(filters.date);
  const subject = typeof filters.subject === "string" && filters.subject.length <= 128 ? filters.subject : undefined;
  const { sessions: filtered, hasPrevious, hasNext } = await getHistoryPage({ userId: user.id, timeZone: zone, date, subject, after: filters.after, before: filters.before });
  function pageUrl(direction?: "after" | "before", cursor?: string) {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (subject) params.set("subject", subject);
    if (direction && cursor) params.set(direction, cursor);
    return "/history?" + params.toString();
  }
  return <main><nav className="topbar"><Link className="brand" href="/dashboard">let&apos;s study</Link><div><Link href="/focus">Focus</Link><Link href="/subjects">Subjects</Link><Link href="/dashboard">Dashboard</Link></div></nav><section className="content wide-content"><p className="eyebrow">YOUR PROGRESS</p><h1>Session history</h1><p className="muted">A record of the time you&apos;ve made for learning. Dates use {zone}.</p><DeleteHistory /><HistoryFilters key={`${filters.date ?? ""}:${filters.subject ?? ""}`} initialDate={date ?? ""} initialSubject={subject ?? ""} subjects={subjects.map(s => ({ id: s.id, name: s.name, archived: !!s.archivedAt }))} /><div className="study-card">{filtered.length === 0 ? <p className="muted">No sessions found. Start a focus session to see your progress here.</p> : <div className="table-wrap"><table><thead><tr><th>Subject</th><th>Type</th><th>Duration</th><th>Started</th><th>Ended</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(s => <tr key={s.id}><td data-label="Subject">{s.subject?.name ?? (s.kind === "FOCUS" ? "Deleted subject" : "-")}</td><td data-label="Type">{s.kind === "FOCUS" ? (s.mode === "POMODORO" ? "Pomodoro" : "Focus") : s.kind === "LONG_BREAK" ? "Long break" : "Break"}</td><td data-label="Duration">{Math.floor(s.elapsedSeconds / 60)}m {s.elapsedSeconds % 60}s</td><td data-label="Started">{s.startedAt.toLocaleString("en-GB", { timeZone: zone })}</td><td data-label="Ended">{s.completedAt?.toLocaleString("en-GB", { timeZone: zone }) ?? "-"}</td><td data-label="Status">{s.status === "COMPLETED" ? "Completed" : "Stopped early"}</td><td data-label="Action"><DeleteHistory id={s.id} /></td></tr>)}</tbody></table></div>}</div>{filtered.length === 0 && (filters.after || filters.before) && <Link className="text-link" href={pageUrl()}>Return to first page</Link>}{filtered.length > 0 && <nav className="history-pagination" aria-label="History pages">{hasPrevious && <Link className="outline-button" href={pageUrl("before", historyCursor(filtered[0]))}>Previous</Link>}{hasNext && <Link className="outline-button" href={pageUrl("after", historyCursor(filtered[filtered.length - 1]))}>Next</Link>}</nav>}</section></main>;
}
