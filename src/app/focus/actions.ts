"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { elapsedAt, lockUser, settleExpired } from "@/lib/study/data";

const startSchema = z.object({ subjectId: z.string().min(1).nullable(), seconds: z.number().int().min(60).max(10800), kind: z.enum(["FOCUS", "BREAK", "LONG_BREAK"]), mode: z.enum(["POMODORO", "CUSTOM"]) });

export async function startTimer(input: unknown) {
  const { user } = await requireSession();
  const data = startSchema.parse(input);
  if (data.kind !== "FOCUS" && (data.mode !== "POMODORO" || data.subjectId)) throw new Error("Invalid break session.");
  if (data.kind === "FOCUS" && !data.subjectId) throw new Error("Choose a subject first.");
  if (data.mode === "POMODORO" && data.seconds !== (data.kind === "FOCUS" ? 1500 : data.kind === "BREAK" ? 300 : 900)) throw new Error("Invalid Pomodoro duration.");
  const session = await prisma.$transaction(async tx => {
    await lockUser(tx, user.id);
    const now = new Date();
    await settleExpired(tx, user.id, now);
    if (await tx.studySession.findFirst({ where: { userId: user.id, status: { in: ["ACTIVE", "PAUSED"] } } })) throw new Error("A session is already active.");
    if (data.subjectId && !await tx.subject.findFirst({ where: { id: data.subjectId, userId: user.id, archivedAt: null } })) throw new Error("Subject not found.");
    const completedPomodoros = data.kind === "FOCUS" ? 0 : await tx.studySession.count({ where: { userId: user.id, status: "COMPLETED", kind: "FOCUS", mode: "POMODORO" } });
    const kind = data.kind === "FOCUS" ? data.kind : (completedPomodoros > 0 && completedPomodoros % 4 === 0 ? "LONG_BREAK" : "BREAK");
    const targetSeconds = kind === "FOCUS" ? data.seconds : kind === "LONG_BREAK" ? 900 : 300;
    return tx.studySession.create({ data: { userId: user.id, subjectId: data.subjectId, targetSeconds, kind, mode: data.mode, resumedAt: now, startedAt: now } });
  });
  return { ...session, serverNow: Date.now() };
}

export async function getActiveTimer() {
  const { user } = await requireSession();
  return prisma.$transaction(async tx => {
    await lockUser(tx, user.id);
    await settleExpired(tx, user.id, new Date());
    const session = await tx.studySession.findFirst({ where: { userId: user.id, status: { in: ["ACTIVE", "PAUSED"] } } });
    return { session, serverNow: Date.now() };
  });
}

export async function updateTimer(id: string, command: "pause" | "resume" | "stop" | "complete" | "sync") {
  const { user } = await requireSession();
  z.string().min(1).parse(id);
  z.enum(["pause", "resume", "stop", "complete", "sync"]).parse(command);
  const result = await prisma.$transaction(async tx => {
    await lockUser(tx, user.id);
    const now = new Date();
    await settleExpired(tx, user.id, now);
    const session = await tx.studySession.findFirst({ where: { id, userId: user.id } });
    if (!session) throw new Error("Session not found.");
    if (session.status === "COMPLETED" || session.status === "STOPPED") return session;
    const elapsedSeconds = elapsedAt(session, now);
    if (command === "complete") throw new Error("The session has not reached its target yet.");
    if (command === "pause" && session.status === "ACTIVE") return tx.studySession.update({ where: { id }, data: { status: "PAUSED", elapsedSeconds, resumedAt: null, version: { increment: 1 } } });
    if (command === "resume" && session.status === "PAUSED") return tx.studySession.update({ where: { id }, data: { status: "ACTIVE", resumedAt: now, version: { increment: 1 } } });
    if (command === "stop") return tx.studySession.update({ where: { id }, data: { status: "STOPPED", elapsedSeconds, completedAt: now, resumedAt: null, version: { increment: 1 } } });
    return session;
  });
  revalidatePath("/dashboard"); revalidatePath("/history"); revalidatePath("/focus");
  return { ...result, serverNow: Date.now() };
}

export async function saveGoal(form: FormData) {
  const { user } = await requireSession();
  const amount = z.coerce.number().positive().max(1440).parse(form.get("minutes"));
  const unit = z.enum(["minutes", "hours"]).parse(form.get("unit"));
  const minutes = z.number().int().min(1).max(1440).parse(unit === "hours" ? amount * 60 : amount);
  const timeZone = z.string().min(1).max(100).parse(form.get("timeZone"));
  try { new Intl.DateTimeFormat("en", { timeZone }).format(); } catch { throw new Error("Invalid time zone."); }
  await prisma.$transaction(async tx => {
    await lockUser(tx, user.id);
    const goal = await tx.studyGoal.findFirst({ where: { userId: user.id, period: "DAILY", subjectId: null }, orderBy: { updatedAt: "desc" } });
    if (goal) await tx.studyGoal.update({ where: { id: goal.id }, data: { targetSeconds: minutes * 60 } });
    else await tx.studyGoal.create({ data: { userId: user.id, period: "DAILY", targetSeconds: minutes * 60 } });
    await tx.focusSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, timeZone }, update: { timeZone } });
  });
  revalidatePath("/dashboard"); revalidatePath("/focus");
}
