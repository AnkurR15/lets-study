import { growthStage } from "@/lib/plant-growth";

const colors: Record<string, string> = { sunflower: "#f4bf42", rose: "#e45c78", tulip: "#d76fae", cactus: "#4d9e77", "cherry-blossom": "#efa9c3", bonsai: "#52987a", fern: "#61aa78" };
export function PlantVisual({ speciesId, seconds }: { speciesId: string; seconds: number }) {
  const color = colors[speciesId] ?? "#72ad80";
  const stage = Math.min(4, Math.floor(seconds / 900));
  return <svg className={`plant-visual plant-stage-${stage}`} viewBox="0 0 120 120" role="img" aria-label={growthStage(seconds)}>
    <ellipse cx="60" cy="106" rx="39" ry="6" fill="#b6d8e4" />
    <path d="M30 91 Q60 76 90 91 L82 106 Q60 114 38 106 Z" fill="#ba8265" />
    {stage === 0 ? <ellipse cx="60" cy="87" rx="7" ry="5" fill="#8b6248" /> : <g className="plant-leaves">
      <path d={`M60 91 Q59 ${stage >= 3 ? 35 : stage === 2 ? 53 : 70} 60 ${stage >= 3 ? 24 : stage === 2 ? 48 : 65}`} fill="none" stroke="#4d956e" strokeWidth="5" strokeLinecap="round" />
      <path d="M60 81 Q35 79 37 65 Q55 65 60 78" fill="#78bd86" />
      <path d="M60 73 Q82 73 83 59 Q68 59 60 70" fill="#5ba879" />
      {stage >= 2 && <path d="M60 61 Q42 58 44 47 Q56 48 60 58" fill="#78bd86" />}
      {stage >= 3 && <path d="M60 51 Q80 49 80 37 Q65 38 60 48" fill="#5ba879" />}
      {stage >= 4 && <g fill={color}><circle cx="60" cy="23" r="10" /><circle cx="49" cy="23" r="7" /><circle cx="71" cy="23" r="7" /><circle cx="60" cy="13" r="7" /><circle cx="60" cy="32" r="7" /><circle cx="60" cy="23" r="4" fill="#f6d76c" /></g>}
    </g>}
  </svg>;
}
