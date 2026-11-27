import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { lockUser, settleExpired } from "@/lib/study/data";
import { creditPastSessions } from "@/lib/plant-rewards";
import { achievementProgress, growthStage, levelFromXp } from "@/lib/plant-growth";
import { PlantVisual } from "@/components/garden/PlantVisual";
import { AchievementNotice } from "@/components/garden/AchievementNotice";
import { selectPlant } from "./actions";

export default async function GardenPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { user } = await requireSession();
  await prisma.$transaction(async tx => {
    await lockUser(tx, user.id);
    await settleExpired(tx, user.id, new Date());
    await creditPastSessions(tx, user.id);
  }, { timeout: 30000 });
  const filter = (await searchParams).filter ?? "all";
  const [garden, plants, species, achievements, earned, sessions, settings] = await Promise.all([
    prisma.garden.findUnique({ where: { userId: user.id } }),
    prisma.userPlant.findMany({ where: { userId: user.id }, include: { species: true }, orderBy: { createdAt: "desc" } }),
    prisma.plantSpecies.findMany({ orderBy: [{ unlockLevel: "asc" }, { name: "asc" }] }),
    prisma.achievement.findMany({ orderBy: { name: "asc" } }),
    prisma.userAchievement.findMany({ where: { userId: user.id }, include: { achievement: true }, orderBy: { earnedAt: "desc" } }),
    prisma.studySession.findMany({ where: { userId: user.id, status: "COMPLETED", kind: "FOCUS", reward: { isNot: null } }, select: { completedAt: true } }),
    prisma.focusSettings.findUnique({ where: { userId: user.id } }),
  ]);
  const xp = Math.floor((garden?.focusSeconds ?? 0) / 60) + (garden?.bonusXp ?? 0);
  const level = levelFromXp(xp);
  const active = plants.find(p => p.id === garden?.activePlantId);
  const mature = plants.filter(p => p.growthSeconds >= p.species.growthDuration);
  const owned = filter === "growing" ? plants.filter(p => p.growthSeconds < p.species.growthDuration) : filter === "mature" ? mature : plants;
  const filteredSpecies = species.filter(s => filter === "locked" ? s.unlockLevel > level : filter === "unlocked" ? s.unlockLevel <= level : true);
  const unlocked = new Set(earned.map(a => a.achievementId));
  const progress = achievementProgress(garden?.focusSeconds ?? 0, mature.length, sessions.flatMap(s => s.completedAt ? [s.completedAt] : []), settings?.timeZone ?? "UTC");
  return <main><nav className="topbar"><Link className="brand" href="/dashboard">let&apos;s study</Link><div><Link href="/focus">Focus</Link><Link href="/dashboard">Dashboard</Link></div></nav><section className="content wide-content garden"><p className="eyebrow">YOUR LITTLE CORNER OF CALM</p><h1>Grow at your own pace.</h1><p className="muted">Every focused minute helps your garden flourish.</p>
    <AchievementNotice userId={user.id} achievements={earned.map(a => ({ id: a.achievementId, name: a.achievement.name, earnedAt: a.earnedAt.toISOString() }))} />
    <div className="garden-stats"><div><strong>{mature.length}</strong><span>plants grown</span></div><div><strong>{((garden?.focusSeconds ?? 0) / 3600).toFixed(1)}</strong><span>study hours</span></div><div><strong>{level}</strong><span>level &middot; {xp} XP</span></div></div>
    <div className="study-card garden-feature"><div><p className="overline">CURRENTLY GROWING</p><h2>{active ? active.name || active.species.name : "Ready for a new seed?"}</h2><p className="muted">{active ? `${growthStage(active.growthSeconds)} - ${Math.ceil((active.species.growthDuration - active.growthSeconds) / 60)} minutes to maturity` : "Choose an unlocked species below to start growing."}</p>{active && <><progress aria-label="Plant growth" max={active.species.growthDuration} value={active.growthSeconds} /><p className="small">{Math.floor(active.growthSeconds / active.species.growthDuration * 100)}% grown</p></>}<p className="small muted">{Math.floor((garden?.bankedSeconds ?? 0) / 60)} minutes saved for your next plant &middot; {xp % 100}/100 XP to next level</p><progress aria-label="Level progress" max={100} value={xp % 100} /></div><div className="garden-illustration"><PlantVisual speciesId={active?.speciesId ?? "sunflower"} seconds={active?.growthSeconds ?? 0} /></div></div>
    {earned.length > 0 && <aside className="study-card garden-recent"><p className="overline">RECENT ACHIEVEMENTS</p><p>{earned.slice(0, 3).map(a => a.achievement.name).join("  ·  ")}</p></aside>}
    <h2>Your collection</h2><div className="garden-filters">{[["all", "All plants"], ["growing", "Growing"], ["mature", "Mature"], ["locked", "Locked species"], ["unlocked", "Unlocked species"]].map(([value, label]) => <Link key={value} aria-current={filter === value ? "page" : undefined} href={`/garden?filter=${value}`}>{label}</Link>)}</div>
    {filter !== "locked" && filter !== "unlocked" && <div className="garden-grid">{owned.map(p => <article className={`garden-card ${p.growthSeconds >= p.species.growthDuration ? "plant-mature" : ""}`} key={p.id}><div className="plant-icon"><PlantVisual speciesId={p.speciesId} seconds={p.growthSeconds} /></div><h3>{p.name || p.species.name}</h3><p className="muted small">{p.species.name} &middot; {growthStage(p.growthSeconds)}</p><progress aria-label={`${p.name || p.species.name} growth`} max={p.species.growthDuration} value={p.growthSeconds} /></article>)}{owned.length === 0 && <p className="muted">Your plants will appear here as you grow them.</p>}</div>}
    {(filter === "all" || filter === "locked" || filter === "unlocked") && <><h2>Discover species</h2><div className="garden-grid">{filteredSpecies.map(s => { const locked = s.unlockLevel > level; return <article className="garden-card" key={s.id}><div className="plant-icon"><PlantVisual speciesId={s.id} seconds={3600} /></div><p className="overline">{s.rarity} &middot; {locked ? `Unlocks at level ${s.unlockLevel}` : "Unlocked"}</p><h3>{s.name}</h3><p className="muted small">{s.description}</p>{!locked && <form action={selectPlant}><input type="hidden" name="speciesId" value={s.id} /><label>Plant name (optional)<input name="name" maxLength={40} placeholder={s.name} /></label><button className="primary garden-button" disabled={!!active}>Plant seed</button></form>}</article>; })}</div></>}
    <h2>Achievements</h2><p className="muted">Little milestones worth celebrating.</p><div className="garden-grid">{achievements.map(a => { const p = progress[a.id]; return <article className={`garden-card ${unlocked.has(a.id) ? "achievement-unlocked" : "achievement-locked"}`} key={a.id}><p className="overline">{unlocked.has(a.id) ? "Unlocked" : "Locked"} &middot; {a.bonusXp} XP</p><h3>{a.name}</h3><p className="muted small">{a.description}</p>{p && <><progress aria-label={`${a.name} progress`} max={p.target} value={Math.min(p.current, p.target)} /><p className="small muted">{Math.min(p.current, p.target)} / {p.target} {p.unit}</p></>}</article>; })}</div>
  </section></main>;
}
