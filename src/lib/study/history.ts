import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const HISTORY_PAGE_SIZE = 20;
const cursorSchema = z.object({ startedAt: z.string().datetime(), id: z.string().min(1).max(128) });
export function readHistoryCursor(value: string | undefined) {
  if (typeof value !== "string" || !value || value.length > 1024) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return parsed.success ? { id: parsed.data.id, startedAt: new Date(parsed.data.startedAt) } : null;
  } catch { return null; }
}
export function historyCursor(row: { id: string; startedAt: Date }) {
  return Buffer.from(JSON.stringify({ id: row.id, startedAt: row.startedAt.toISOString() })).toString("base64url");
}
export function validHistoryDate(value: string | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "0001-01-01" ? value : undefined;
}
export function historyDayBounds(date: string, timeZone: string) {
  const day = Temporal.PlainDate.from(date);
  return { start: new Date(day.toZonedDateTime(timeZone).epochMilliseconds), end: new Date(day.add({ days: 1 }).toZonedDateTime(timeZone).epochMilliseconds) };
}
export async function getHistoryPage({ userId, timeZone, date, subject, after, before }: { userId: string; timeZone: string; date?: string; subject?: string; after?: string; before?: string }) {
  const bounds = date ? historyDayBounds(date, timeZone) : undefined;
  const previous = readHistoryCursor(before);
  const cursor = previous ?? readHistoryCursor(after);
  const backward = !!previous;
  const where: Prisma.StudySessionWhereInput = {
    userId, hiddenAt: null, status: { in: ["COMPLETED", "STOPPED"] },
    ...(subject ? { subjectId: subject } : {}),
    ...(bounds ? { startedAt: { gte: bounds.start, lt: bounds.end } } : {}),
    ...(cursor ? { OR: [
      { startedAt: { [backward ? "gt" : "lt"]: cursor.startedAt } },
      { startedAt: cursor.startedAt, id: { [backward ? "gt" : "lt"]: cursor.id } },
    ] } : {}),
  };
  const rows = await prisma.studySession.findMany({ where, include: { subject: true }, orderBy: [{ startedAt: backward ? "asc" : "desc" }, { id: backward ? "asc" : "desc" }], take: HISTORY_PAGE_SIZE + 1 });
  const hasMore = rows.length > HISTORY_PAGE_SIZE;
  const sessions = rows.slice(0, HISTORY_PAGE_SIZE);
  if (backward) sessions.reverse();
  return { sessions, hasPrevious: backward ? hasMore : !!cursor, hasNext: backward ? !!cursor : hasMore };
}
