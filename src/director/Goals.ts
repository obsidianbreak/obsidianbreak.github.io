import { hashString, mulberry32 } from "../lib/rng";

export interface Goal {
  id: string;
  kind: "flips" | "wins" | "gifts" | "casts";
  target: number;
  progress: number;
  label: string;
}

export interface MatchTally {
  won: boolean;
  flips: number;
  gifts: number;
  casts: number;
}

const POOL: Array<Pick<Goal, "kind" | "target" | "label">> = [
  { kind: "flips", target: 400, label: "Claim 400 tiles" },
  { kind: "flips", target: 900, label: "Claim 900 tiles" },
  { kind: "wins", target: 2, label: "Win 2 duels" },
  { kind: "wins", target: 3, label: "Win 3 duels" },
  { kind: "gifts", target: 6, label: "Collect 6 gifts" },
  { kind: "casts", target: 3, label: "Cast 3 cards" },
];

/** Three goals per day, the same for everyone, no currency and no expiry pressure beyond the date. */
export function generateGoals(dateKey: string): Goal[] {
  const rng = mulberry32(hashString(`goals:${dateKey}`));
  const bag = [...POOL];
  const out: Goal[] = [];
  while (out.length < 3 && bag.length) {
    const g = bag.splice(Math.floor(rng() * bag.length), 1)[0];
    if (out.some((o) => o.kind === g.kind)) continue;
    out.push({ ...g, id: `${g.kind}-${g.target}`, progress: 0 });
  }
  return out;
}

export function applyMatch(goals: Goal[], t: MatchTally): Goal[] {
  return goals.map((g) => {
    const add = g.kind === "flips" ? t.flips : g.kind === "wins" ? (t.won ? 1 : 0) : g.kind === "gifts" ? t.gifts : t.casts;
    return { ...g, progress: Math.min(g.target, g.progress + add) };
  });
}
