import type { Prisma } from "@/generated/prisma/client";
import { achievementProgress, allocateGrowth } from "@/lib/plant-growth";

// Call only while holding the user's row lock, within the session transaction.
export async function applyBank(tx: Prisma.TransactionClient, userId: string) {
  const garden = await tx.garden.findUniqueOrThrow({ where: { userId }, include: { activePlant: { include: { species: true } } } });
  const plant = garden.activePlant;
  if (!plant || plant.userId !== userId || garden.bankedSeconds <= 0) return;
  const { added, mature } = allocateGrowth(plant.growthSeconds, garden.bankedSeconds, plant.species.growthDuration);
  await tx.userPlant.update({ where: { id: plant.id }, data: { growthSeconds: { increment: added } } });
  await tx.garden.update({ where: { userId }, data: { bankedSeconds: { decrement: added }, ...(mature ? { activePlantId: null, bonusXp: { increment: 25 } } : {}) } });
}

export async function checkAchievements(tx: Prisma.TransactionClient, userId: string) {
  const garden = await tx.garden.findUniqueOrThrow({ where: { userId } });
  const plants = await tx.userPlant.findMany({ where: { userId }, select: { growthSeconds: true, species: { select: { growthDuration: true } } } });
  const sessions = await tx.studySession.findMany({ where: { userId, status: "COMPLETED", kind: "FOCUS", reward: { isNot: null } }, select: { completedAt: true } });
  const settings = await tx.focusSettings.findUnique({ where: { userId } });
  const definitions = await tx.achievement.findMany();
  const progress = achievementProgress(garden.focusSeconds, plants.filter(p => p.growthSeconds >= p.species.growthDuration).length, sessions.flatMap(s => s.completedAt ? [s.completedAt] : []), settings?.timeZone ?? "UTC");
  for (const achievement of definitions) if (progress[achievement.id] && progress[achievement.id].current >= progress[achievement.id].target) {
    const inserted = await tx.userAchievement.createMany({ data: [{ userId, achievementId: achievement.id }], skipDuplicates: true });
    if (inserted.count) await tx.garden.update({ where: { userId }, data: { bonusXp: { increment: achievement.bonusXp } } });
  }
}

// The caller holds the user lock. Existing completed sessions are credited once,
// using the same unique session ledger as newly completed sessions.
export async function creditPastSessions(tx: Prisma.TransactionClient, userId: string) {
  const sessions = await tx.studySession.findMany({ where: { userId, status: "COMPLETED", kind: "FOCUS", completedAt: { not: null }, reward: { is: null } }, select: { id: true, targetSeconds: true, elapsedSeconds: true } });
  const valid = sessions.filter(s => s.targetSeconds > 0 && s.elapsedSeconds >= s.targetSeconds);
  if (!valid.length) return;
  const seconds = valid.reduce((total, s) => total + s.targetSeconds, 0);
  await tx.studyReward.createMany({ data: valid.map(s => ({ sessionId: s.id, seconds: s.targetSeconds, experience: Math.floor(s.targetSeconds / 60) })) });
  await tx.garden.upsert({ where: { userId }, create: { userId, bankedSeconds: seconds, focusSeconds: seconds }, update: { bankedSeconds: { increment: seconds }, focusSeconds: { increment: seconds } } });
  await applyBank(tx, userId);
  await checkAchievements(tx, userId);
}

export async function rewardSession(tx: Prisma.TransactionClient, userId: string, sessionId: string) {
  const session = await tx.studySession.findFirst({ where: { id: sessionId, userId, status: "COMPLETED", kind: "FOCUS" } });
  if (!session || !session.completedAt || session.targetSeconds <= 0 || session.elapsedSeconds < session.targetSeconds) return;
  const seconds = session.targetSeconds;
  const inserted = await tx.studyReward.createMany({ data: [{ sessionId, seconds, experience: Math.floor(seconds / 60) }], skipDuplicates: true });
  if (!inserted.count) return;
  await tx.garden.upsert({ where: { userId }, create: { userId, bankedSeconds: seconds, focusSeconds: seconds }, update: { bankedSeconds: { increment: seconds }, focusSeconds: { increment: seconds } } });
  await applyBank(tx, userId);
  await checkAchievements(tx, userId);
}
