"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
export async function addTodo(form: FormData) { const { user } = await requireSession(); const title = z.string().trim().min(1).max(200).parse(form.get("title")); await prisma.todo.create({ data: { title, userId: user.id } }); revalidatePath("/todos"); }
export async function toggleTodo(form: FormData) { const { user } = await requireSession(); const id = z.string().min(1).parse(form.get("id")); const completed = z.enum(["true", "false"]).parse(form.get("completed")) === "true"; await prisma.todo.updateMany({ where: { id, userId: user.id }, data: { completed } }); revalidatePath("/todos"); }
export async function deleteTodo(form: FormData) { const { user } = await requireSession(); const id = z.string().min(1).parse(form.get("id")); await prisma.todo.deleteMany({ where: { id, userId: user.id } }); revalidatePath("/todos"); }
