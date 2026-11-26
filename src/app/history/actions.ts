"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
export async function removeHistory(id?: string) {
  const { user } = await requireSession();
  if (id !== undefined) z.string().min(1).parse(id);
  await prisma.studySession.updateMany({ where: { userId: user.id, status: { in: ["COMPLETED", "STOPPED"] }, hiddenAt: null, ...(id ? { id } : {}) }, data: { hiddenAt: new Date() } });
  revalidatePath("/history"); revalidatePath("/dashboard");
}
