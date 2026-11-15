/**
 * Players have a hidden skill from 0 to 1 and a visible rating. Each
 * match moves the skill with an Elo style update that also looks at
 * the margin, so a narrow loss moves you less than a rout.
 */
export const toRating = (skill: number): number => Math.round(800 + 1000 * Math.max(0, Math.min(1, skill)));

export const TIERS = [
  { name: "Bean", min: 0 },
  { name: "Grind", min: 900 },
  { name: "Pour", min: 1000 },
  { name: "Brew", min: 1100 },
  { name: "Roast", min: 1250 },
  { name: "Barista", min: 1400 },
  { name: "Master", min: 1550 },
];

export function tierOf(rating: number): { name: string; index: number; next: number | null } {
  let idx = 0;
  TIERS.forEach((t, i) => {
    if (rating >= t.min) idx = i;
  });
  return { name: TIERS[idx].name, index: idx, next: idx + 1 < TIERS.length ? TIERS[idx + 1].min : null };
}

export function expected(playerSkill: number, oppSkill: number): number {
  return 1 / (1 + Math.exp(-(playerSkill - oppSkill) * 6));
}

export function updateSkill(playerSkill: number, oppSkill: number, margin: number, matchesPlayed: number): number {
  const e = expected(playerSkill, oppSkill);
  const s = 0.5 + 0.5 * Math.tanh(margin * 2.5);
  const k = matchesPlayed < 10 ? 0.1 : 0.06;
  return Math.max(0.02, Math.min(0.98, playerSkill + k * (s - e)));
}
