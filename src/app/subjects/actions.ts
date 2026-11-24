"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { lockUser } from "@/lib/study/data";
const subjectSchema = z.object({ name: z.string().trim().min(1).max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), description: z.string().trim().max(500) });
export async function saveSubject(form: FormData) {
  const { user } = await requireSession();
  const data = subjectSchema.parse({ name: form.get("name"), color: form.get("color"), description: form.get("description") });
  const id = form.get("id");
  if (typeof id === "string" && id) { const result = await prisma.subject.updateMany({ where: { id, userId: user.id, archivedAt: null }, data }); if (!result.count) throw new Error("Subject not found."); }
  else await prisma.subject.create({ data: { ...data, userId: user.id } });
  revalidatePath("/subjects"); revalidatePath("/focus");
}
export async function deleteSubject(form: FormData) {
  const { user } = await requireSession();
  const id = z.string().min(1).parse(form.get("id"));
  const outcome = await prisma.$transaction(async tx => {
    await lockUser(tx, user.id);
    const active = await tx.studySession.findFirst({ where: { userId: user.id, subjectId: id, status: { in: ["ACTIVE", "PAUSED"] } } });
    if (active) return "active" as const;
    const result = await tx.subject.deleteMany({ where: { id, userId: user.id } });
    return result.count ? "deleted" as const : "missing" as const;
  });
  if (outcome === "deleted") { revalidatePath("/subjects"); revalidatePath("/focus"); revalidatePath("/history"); revalidatePath("/dashboard"); }
  return outcome;
}
