import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { studyOverview } from "@/lib/study/data";
import { FocusTimer } from "@/components/focus/FocusTimer";
import { DailyGoalProgress } from "@/components/goals/DailyGoalProgress";

export default async function FocusPage() {
  const { user } = await requireSession();
  const overview = await studyOverview(user.id);
  const [subjects, active] = await Promise.all([
    prisma.subject.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.studySession.findFirst({ where: { userId: user.id, status: { in: ["ACTIVE", "PAUSED"] } } }),
  ]);
  return <main><nav className="topbar"><Link className="brand" href="/dashboard">let&apos;s study</Link><div><Link href="/subjects">Subjects</Link><Link href="/history">History</Link><Link href="/dashboard">Dashboard</Link></div></nav><section className="content wide-content"><p className="eyebrow">YOUR FOCUS SPACE</p><h1>One moment at a time.</h1><p className="muted">Settle in, choose a subject, and make a little progress.</p><div className="study-grid"><FocusTimer initial={active ?? overview.settled} subjects={subjects} serverNow={overview.serverNow} /><aside><DailyGoalProgress {...overview} /><div className="study-card"><h2>Pomodoro rhythm</h2><p className="muted">25 minutes of focus, then a 5 minute break. After four completed focus sessions, take a 15 minute break.</p><Link className="text-link" href="/subjects">Manage subjects &rarr;</Link></div></aside></div></section></main>;
}
