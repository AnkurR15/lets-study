import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL or DATABASE_URL before seeding");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  for (const plant of [
    { id: "fern", name: "Fern", description: "A gentle first companion.", unlockLevel: 1 },
    { id: "sunflower", name: "Sunflower", description: "A bright reward for growing.", unlockLevel: 2 },
    { id: "bonsai", name: "Bonsai", description: "A symbol of patient focus.", unlockLevel: 5 },
  ]) await prisma.plantSpecies.upsert({ where: { id: plant.id }, update: plant, create: plant });
  for (const achievement of [
    { id: "first-session", name: "First Steps", description: "Complete your first focus session." },
    { id: "first-plant", name: "In Bloom", description: "Grow your first plant." },
    { id: "week-streak", name: "Steady Growth", description: "Study on seven consecutive days." },
  ]) await prisma.achievement.upsert({ where: { id: achievement.id }, update: achievement, create: achievement });
} finally { await prisma.$disconnect(); }
