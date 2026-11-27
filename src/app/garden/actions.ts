"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { lockUser } from "@/lib/study/data";
import { applyBank, checkAchievements, creditPastSessions } from "@/lib/plant-rewards";
import { levelFromXp } from "@/lib/plant-growth";

export async function selectPlant(form: FormData) {
  const { user } = await requireSession();
  const speciesId = z.string().min(1).max(100).parse(form.get("speciesId"));
  const name = z.string().trim().max(40).parse(form.get("name") ?? "");
  await prisma.$transaction(async tx => {
    await lockUser(tx, user.id);
    await creditPastSessions(tx, user.id);
    const garden = await tx.garden.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    if (garden.activePlantId) throw new Error("Finish your current plant first.");
    const species = await tx.plantSpecies.findUnique({ where: { id: speciesId } });
    if (!species || species.unlockLevel > levelFromXp(Math.floor(garden.focusSeconds / 60) + garden.bonusXp)) throw new Error("Species is locked.");
    const plant = await tx.userPlant.create({ data: { userId: user.id, speciesId, name: name || null } });
    await tx.garden.update({ where: { userId: user.id }, data: { activePlantId: plant.id } });
    await applyBank(tx, user.id);
    await checkAchievements(tx, user.id);
  }, { timeout: 30000 });
  revalidatePath("/garden");
}
