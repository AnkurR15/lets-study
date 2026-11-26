import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL or DATABASE_URL before seeding");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  for (const plant of [
    { id: "fern", name: "Fern", description: "A gentle first companion.", unlockLevel: 1 },
    { id: "sunflower", name: "Sunflower", description: "A bright companion for your first garden.", unlockLevel: 1 },
    { id: "rose", name: "Rose", description: "A classic bloom that rewards steady care.", unlockLevel: 2 },
    { id: "tulip", name: "Tulip", description: "A cheerful sign of fresh beginnings.", unlockLevel: 3 },
    { id: "cactus", name: "Cactus", description: "A resilient companion for focused days.", unlockLevel: 4 },
    { id: "cherry-blossom", name: "Cherry Blossom", description: "A delicate reminder to enjoy the journey.", unlockLevel: 5 },
    { id: "bonsai", name: "Bonsai", description: "A symbol of patient focus.", unlockLevel: 5 },
  ]) { const rarity = plant.unlockLevel <= 1 ? "Common" : plant.unlockLevel <= 2 ? "Uncommon" : plant.unlockLevel <= 3 ? "Rare" : plant.unlockLevel <= 4 ? "Epic" : "Legendary"; await prisma.plantSpecies.upsert({ where: { id: plant.id }, update: { ...plant, rarity }, create: { ...plant, rarity } }); }
  for (const achievement of [
    { id: "first-session", name: "First Focus", description: "Complete your first focus session." },
    { id: "first-plant", name: "First Bloom", description: "Grow your first plant." },
    { id: "study-beginner", name: "Study Beginner", description: "Complete 5 study hours." },
    { id: "dedicated-learner", name: "Dedicated Learner", description: "Complete 10 study hours." },
    { id: "focus-master", name: "Focus Master", description: "Complete 25 study hours." },
    { id: "green-thumb", name: "Green Thumb", description: "Grow 5 mature plants." },
    { id: "garden-keeper", name: "Garden Keeper", description: "Grow 10 mature plants." },
    { id: "week-streak", name: "Consistency Star", description: "Study on seven consecutive days." },
  ]) await prisma.achievement.upsert({ where: { id: achievement.id }, update: achievement, create: achievement });
} finally { await prisma.$disconnect(); }
