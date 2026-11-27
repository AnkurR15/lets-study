import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { applyBank, creditPastSessions, rewardSession } from "../src/lib/plant-rewards";
import { lockUser } from "../src/lib/study/data";

// A dedicated database is required: never run fixtures against the app database.
const testUrl = process.env.GARDEN_TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;
const distinct = (a: string, b: string) => { const x = new URL(a), y = new URL(b); return x.host !== y.host || x.pathname !== y.pathname; };
const enabled = !!testUrl && !!appUrl && distinct(testUrl, appUrl);
const suite = enabled ? describe : describe.skip;

suite("garden rewards against a dedicated database", () => {
  const id = `garden-test-${randomUUID()}`;
  const speciesId = `${id}-species`;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl! }) });
  let plantId = "";
  beforeAll(async () => {
    await db.user.create({ data: { id, name: "Garden test", email: `${id}@example.invalid` } });
    await db.plantSpecies.create({ data: { id: speciesId, name: speciesId, description: "Test fixture" } });
    const plant = await db.userPlant.create({ data: { userId: id, speciesId } });
    plantId = plant.id;
    await db.garden.create({ data: { userId: id, activePlantId: plantId } });
  }, 30000);
  afterAll(async () => {
    await db.user.deleteMany({ where: { id, email: `${id}@example.invalid` } });
    await db.plantSpecies.deleteMany({ where: { id: speciesId } });
    await db.$disconnect();
  }, 30000);
  test("accumulates sessions once under concurrent requests and banks overflow", async () => {
    const sessions = [];
    for (const seconds of [1500, 1500, 1200]) sessions.push(await db.studySession.create({ data: { userId: id, status: "COMPLETED", kind: "FOCUS", targetSeconds: seconds, elapsedSeconds: seconds, completedAt: new Date() } }));
    const process = (sessionId: string) => db.$transaction(async tx => { await lockUser(tx, id); await rewardSession(tx, id, sessionId); }, { timeout: 30000 });
    await process(sessions[0].id); await process(sessions[1].id);
    await Promise.all([process(sessions[2].id), process(sessions[2].id)]);
    const plant = await db.userPlant.findUniqueOrThrow({ where: { id: plantId } });
    const garden = await db.garden.findUniqueOrThrow({ where: { userId: id } });
    expect(plant.growthSeconds).toBe(3600);
    expect(garden.bankedSeconds).toBe(600);
    expect(garden.focusSeconds).toBe(4200);
    expect(garden.activePlantId).toBeNull();
    expect(await db.studyReward.count({ where: { sessionId: { in: sessions.map(s => s.id) } } })).toBe(3);
    expect(garden.bonusXp).toBeGreaterThanOrEqual(25);
    const next = await db.userPlant.create({ data: { userId: id, speciesId } });
    await db.$transaction(async tx => { await lockUser(tx, id); await tx.garden.update({ where: { userId: id }, data: { activePlantId: next.id } }); await applyBank(tx, id); }, { timeout: 30000 });
    expect((await db.userPlant.findUniqueOrThrow({ where: { id: next.id } })).growthSeconds).toBe(600);
  }, 60000);
  test("backfill is idempotent and failed transactions roll back", async () => {
    const session = await db.studySession.create({ data: { userId: id, status: "COMPLETED", targetSeconds: 60, elapsedSeconds: 60, completedAt: new Date() } });
    await expect(db.$transaction(async tx => { await lockUser(tx, id); await rewardSession(tx, id, session.id); throw new Error("rollback"); }, { timeout: 30000 })).rejects.toThrow("rollback");
    expect(await db.studyReward.findUnique({ where: { sessionId: session.id } })).toBeNull();
    const backfill = () => db.$transaction(async tx => { await lockUser(tx, id); await creditPastSessions(tx, id); }, { timeout: 30000 });
    await backfill(); await backfill();
    expect((await db.garden.findUniqueOrThrow({ where: { userId: id } })).focusSeconds).toBe(4260);
    expect(await db.studyReward.count({ where: { sessionId: session.id } })).toBe(1);
  }, 60000);
});
