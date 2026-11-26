import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

let currentUser = "";
mock.module("@/lib/session", () => ({ requireSession: async () => ({ user: { id: currentUser } }) }));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));
const { startTimer, updateTimer, getActiveTimer } = await import("../src/app/focus/actions");
const { deleteSubject, saveSubject } = await import("../src/app/subjects/actions");
const { addTodo } = await import("../src/app/todos/actions");
const { reconcile } = await import("../src/lib/study/data");
const { getHistoryPage, historyCursor } = await import("../src/lib/study/history");
const suite = process.env.RUN_STUDY_DB_TESTS === "1" ? describe : describe.skip;

suite("study actions with an isolated database fixture", () => {
  const prefix = `phase3-test-${randomUUID()}`;
  const userA = `${prefix}-a`;
  const userB = `${prefix}-b`;
  let subjectId = "";
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
  beforeEach(() => { currentUser = userA; });
  afterEach(async () => { await prisma.studySession.deleteMany({ where: { userId: userA } }); }, 30000);
  test("start, pause and resume, and reject overlapping sessions", async () => {
    currentUser = userA;
    const session = await startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" });
    const sessionId = session.id;
    expect(session.status).toBe("ACTIVE");
    expect(session.mode).toBe("CUSTOM");
    expect(session.targetSeconds).toBe(60);
    expect((await getActiveTimer()).session?.id).toBe(session.id);
    await expect(startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" })).rejects.toThrow();
    expect((await updateTimer(sessionId, "pause")).status).toBe("PAUSED");
    expect((await updateTimer(sessionId, "resume")).status).toBe("ACTIVE");
  }, 30000);
  test("another user cannot modify the session or subject", async () => {
    const session = await startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" });
    currentUser = userB;
    await expect(updateTimer(session.id, "stop")).rejects.toThrow();
    const form = new FormData(); form.set("id", subjectId); form.set("name", "Taken"); form.set("color", "#719775"); form.set("description", "");
    await expect(saveSubject(form)).rejects.toThrow();
    expect(await deleteSubject(form)).toBe("missing");
    await expect(startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" })).rejects.toThrow();
    expect((await prisma.subject.findUniqueOrThrow({ where: { id: subjectId } })).name).toBe("Test");
  }, 30000);
  test("reopening settles expiry at the scheduled time and duplicate completions are idempotent", async () => {
    currentUser = userA;
    const session = await startTimer({ subjectId, seconds: 60, kind: "FOCUS", mode: "CUSTOM" });
    const sessionId = session.id;
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
  test("rejects a blank task title with a form error", async () => {
    const form = new FormData(); form.set("title", "   ");
    expect((await addTodo(form)).error).toBeTruthy();
    expect(await prisma.todo.count({ where: { userId: userA } })).toBe(0);
  }, 30000);
  test("history filters before paginating and navigates ties in both directions", async () => {
    const startedAt = new Date("2026-01-01T20:00:00.000Z");
    await prisma.studySession.createMany({ data: Array.from({ length: 45 }, () => ({ userId: userA, subjectId, status: "COMPLETED" as const, targetSeconds: 60, elapsedSeconds: 60, startedAt, completedAt: startedAt })) });
    await prisma.studySession.create({ data: { userId: userA, subjectId, status: "COMPLETED", targetSeconds: 60, elapsedSeconds: 60, startedAt: new Date("2026-01-03T20:00:00.000Z") } });
    await prisma.studySession.create({ data: { userId: userB, status: "COMPLETED", targetSeconds: 60, elapsedSeconds: 60, startedAt } });
    const filters = { userId: userA, subject: subjectId, date: "2026-01-02", timeZone: "Asia/Kolkata" };
    const first = await getHistoryPage(filters);
    expect(first.sessions).toHaveLength(20);
    expect(first.hasPrevious).toBe(false);
    expect(first.hasNext).toBe(true);
    const second = await getHistoryPage({ ...filters, after: historyCursor(first.sessions.at(-1)!) });
    const third = await getHistoryPage({ ...filters, after: historyCursor(second.sessions.at(-1)!) });
    expect(third.sessions).toHaveLength(5);
    expect(third.hasNext).toBe(false);
    expect(new Set([...first.sessions, ...second.sessions, ...third.sessions].map(s => s.id)).size).toBe(45);
    const back = await getHistoryPage({ ...filters, before: historyCursor(third.sessions[0]) });
    expect(back.sessions.map(s => s.id)).toEqual(second.sessions.map(s => s.id));
    expect(back.hasPrevious).toBe(true);
    expect(back.hasNext).toBe(true);
  }, 30000);
  test("deleting a subject reconciles an expired session first", async () => {
    const subject = await prisma.subject.create({ data: { userId: userA, name: "Expiry test", color: "#719775" } });
    const session = await startTimer({ subjectId: subject.id, seconds: 60, kind: "FOCUS", mode: "CUSTOM" });
    await prisma.studySession.update({ where: { id: session.id }, data: { resumedAt: new Date(Date.now() - 120000) } });
    const form = new FormData(); form.set("id", subject.id);
    expect(await deleteSubject(form)).toBe("deleted");
    const completed = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.elapsedSeconds).toBe(60);
    expect(completed.subjectId).toBeNull();
  }, 30000);
});
