import { prisma } from "@/lib/prisma";
import type { Prisma, StudySession } from "@/generated/prisma/client";
import { rewardSession } from "@/lib/plant-rewards";

export function elapsedAt(session: Pick<StudySession, "elapsedSeconds" | "targetSeconds" | "status" | "resumedAt">, now: Date) {
  const running = session.status === "ACTIVE" && session.resumedAt ? Math.max(0, Math.floor((now.getTime() - session.resumedAt.getTime()) / 1000)) : 0;
  return Math.min(session.targetSeconds, session.elapsedSeconds + running);
}

export async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

export async function settleExpired(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const active = await tx.studySession.findFirst({ where: { userId, status: "ACTIVE" } });
  if (!active || !active.resumedAt || elapsedAt(active, now) < active.targetSeconds) return null;
  const completedAt = new Date(active.resumedAt.getTime() + (active.targetSeconds - active.elapsedSeconds) * 1000);
  const completed = await tx.studySession.update({ where: { id: active.id }, data: { status: "COMPLETED", elapsedSeconds: active.targetSeconds, completedAt, resumedAt: null, version: { increment: 1 } } });
  await rewardSession(tx, userId, completed.id);
  return completed;
}

export async function reconcile(userId: string) {
  return prisma.$transaction(async tx => { await lockUser(tx, userId); return settleExpired(tx, userId, new Date()); }, { timeout: 30000 });
}

export function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function studyOverview(userId: string) {
  const settled = await reconcile(userId);
  const [settings, goal, completed, recent] = await Promise.all([
    prisma.focusSettings.findUnique({ where: { userId } }),
    prisma.studyGoal.findFirst({ where: { userId, period: "DAILY", subjectId: null }, orderBy: { updatedAt: "desc" } }),
    prisma.studySession.findMany({ where: { userId, status: "COMPLETED", kind: "FOCUS", completedAt: { gte: new Date(Date.now() - 3 * 86400000) } }, select: { elapsedSeconds: true, completedAt: true } }),
    prisma.studySession.findMany({ where: { userId, hiddenAt: null, status: { in: ["COMPLETED", "STOPPED"] } }, include: { subject: true }, orderBy: { startedAt: "desc" }, take: 5 }),
  ]);
  const timeZone = settings?.timeZone ?? "UTC";
  const today = dayKey(new Date(), timeZone);
  const seconds = completed.filter(s => s.completedAt && dayKey(s.completedAt, timeZone) === today).reduce((n, s) => n + s.elapsedSeconds, 0);
  return { timeZone, seconds, target: goal?.targetSeconds ?? 3600, recent, settled, serverNow: Date.now() };
}
