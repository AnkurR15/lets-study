"use client";
import { useEffect } from "react";
import { toast } from "sonner";

export function AchievementNotice({ userId, achievements }: { userId: string; achievements: { id: string; name: string; earnedAt: string }[] }) {
  useEffect(() => {
    try {
      const key = `garden-notices:${userId}`;
      const seen = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
      for (const item of achievements) if (!seen.has(item.id)) { toast.success(`Achievement unlocked: ${item.name}`); seen.add(item.id); }
      localStorage.setItem(key, JSON.stringify([...seen]));
    } catch { /* Storage may be disabled; the achievement list remains available. */ }
  }, [userId, achievements]);
  return null;
}
