import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

let currentUser = "";
mock.module("@/lib/session", () => ({ requireSession: async () => ({ user: { id: currentUser } }) }));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));
const { startTimer, updateTimer } = await import("../src/app/focus/actions");
const { deleteSubject, saveSubject } = await import("../src/app/subjects/actions");
const { reconcile } = await import("../src/lib/study/data");
const suite = process.env.RUN_STUDY_DB_TESTS === "1" ? describe : describe.skip;

suite("study actions with an isolated database fixture", () => {
  const prefix = `phase3-test-${randomUUID()}`;
  const userA = `${prefix}-a`;
  const userB = `${prefix}-b`;
  let subjectId = "";
  let sessionId = "";
  beforeAll(async () => {
    await prisma.user.createMany({ data: [userA, userB].map(id => ({ id, name: "Phase 3 test", email: `${id}@example.invalid` })) });
    currentUser = userA;
    const subject = await prisma.subject.create({ data: { userId: userA, name: "Test", color: "#719775" } });
    subjectId = subject.id;
  }, 30000);
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] }, email: { in: [`${userA}@example.invalid`, `${userB}@example.invalid`] } } });
    await prisma.$disconnect();
  }, 30000);
  test("start, pause and resume, and reject overlapping sessions", async () => {
    currentUser = userA;
    const session = await startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" });
    sessionId = session.id;
    expect(session.status).toBe("ACTIVE");
    expect(session.mode).toBe("CUSTOM");
    expect(session.targetSeconds).toBe(60);
    await expect(startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" })).rejects.toThrow();
    expect((await updateTimer(sessionId, "pause")).status).toBe("PAUSED");
    expect((await updateTimer(sessionId, "resume")).status).toBe("ACTIVE");
  }, 30000);
  test("another user cannot modify the session or subject", async () => {
    currentUser = userB;
    await expect(updateTimer(sessionId, "stop")).rejects.toThrow();
    const form = new FormData(); form.set("id", subjectId); form.set("name", "Taken"); form.set("color", "#719775"); form.set("description", "");
    await expect(saveSubject(form)).rejects.toThrow();
    expect(await deleteSubject(form)).toBe("missing");
    await expect(startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" })).rejects.toThrow();
    expect((await prisma.subject.findUniqueOrThrow({ where: { id: subjectId } })).name).toBe("Test");
  }, 30000);
  test("reopening settles expiry at the scheduled time and duplicate completions are idempotent", async () => {
    currentUser = userA;
    const resumedAt = new Date(Date.now() - 120000);
    await prisma.studySession.update({ where: { id: sessionId }, data: { resumedAt, elapsedSeconds: 0 } });
    const settled = await reconcile(userA);
    expect(settled?.status).toBe("COMPLETED");
    expect(settled?.elapsedSeconds).toBe(60);
    expect(settled?.completedAt?.getTime()).toBe(resumedAt.getTime() + 60000);
    const next = await startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" });
    await prisma.studySession.update({ where: { id: next.id }, data: { resumedAt: new Date(Date.now() - 120000) } });
    const [first, second] = await Promise.all([updateTimer(next.id, "complete"), updateTimer(next.id, "complete")]);
    expect(second.version).toBe(first.version);
    expect(second.completedAt?.getTime()).toBe(first.completedAt?.getTime());
    expect(await prisma.studySession.count({ where: { id: next.id, userId: userA, status: "COMPLETED" } })).toBe(1);
  }, 30000);
  test("stopping early records a stopped session", async () => {
    const session = await startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" });
    expect((await updateTimer(session.id, "stop")).status).toBe("STOPPED");
  }, 30000);
});
