import { mulberry32 } from "../lib/rng";
import { ALL_GIFTS } from "./gifts";
import { PERSONAS } from "./Brain";
import { WALL } from "./types";
import type { DuelConfig, GiftKind, MutatorId, PersonaId } from "./types";

export type MatchKind = "ladder" | "daily" | "boss" | "rematch";

/** Numeric overrides produced by the rules engine and experiments. */
export interface RuleOverrides {
  winShare?: number;
  giftEverySec?: number;
  cardCostScale?: number;
  playerTurnBonus?: number;
  disabledMutators?: MutatorId[];
  duration?: number;
  /** Width to height of the board area on this device. Makes the board fill the screen. */
  aspect?: number;
}

export interface MatchSpec {
  id: string;
  kind: MatchKind;
  seed: number;
  name: string;
  persona: PersonaId;
  mutators: MutatorId[];
  cfg: DuelConfig;
  /** Filled in by the calibrator. */
  oppSkill: number;
  targetWin: number;
  predictedWin: number;
}

export const MUTATORS: Record<MutatorId, { name: string; blurb: string }> = {
  twin: { name: "Twin", blurb: "Two balls each" },
  stone: { name: "Stone", blurb: "Ceramic walls that never break" },
  foam: { name: "Foam", blurb: "Both sides start as scattered islands" },
  sprint: { name: "Sprint", blurb: "Shorter and faster" },
  generous: { name: "Generous", blurb: "Gifts arrive more often" },
  drought: { name: "Drought", blurb: "No gifts on the field, cards only" },
  marathon: { name: "Marathon", blurb: "A bigger board and a longer match" },
};

const MOODS = ["Quiet", "Burnt", "Golden", "Velvet", "Smoky", "Frosted", "Sleepy", "Bitter", "Warm", "Salted"];
const PLACES = ["Counter", "Terrace", "Pantry", "Cellar", "Window", "Courtyard", "Alley", "Market", "Garden", "Attic"];

export function matchName(seed: number, mutators: MutatorId[]): string {
  const rng = mulberry32(seed ^ 0xabcdef);
  const base = `${MOODS[Math.floor(rng() * MOODS.length)]} ${PLACES[Math.floor(rng() * PLACES.length)]}`;
  return mutators.length ? `${base}, ${MUTATORS[mutators[0]].name}` : base;
}

const pick = <T,>(rng: () => number, list: T[]): T => list[Math.floor(rng() * list.length)];

/** Builds a fair, mirror-symmetric board. Latte on the left, Roast on the right. */
export function buildConfig(seed: number, mutators: MutatorId[], rules: RuleOverrides = {}): DuelConfig {
  const rng = mulberry32(seed);
  const has = (m: MutatorId) => mutators.includes(m);
  const cols = has("marathon") ? 20 : pick(rng, [16, 18, 20]);
  const fitted = rules.aspect ? Math.max(20, Math.min(30, Math.round(cols / rules.aspect))) : 0;
  const rows = has("marathon") ? 28 : fitted || pick(rng, [22, 24, 26]);
  const half = cols / 2;
  const cells = new Array<number>(cols * rows).fill(0);
  const at = (x: number, y: number) => y * cols + x;

  for (let y = 0; y < rows; y++) for (let x = half; x < cols; x++) cells[at(x, y)] = 1;

  if (has("foam")) {
    const seeds: Array<[number, number]> = [];
    const n = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) seeds.push([rng() * half, rng() * rows]);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < half; x++) {
        let best = 0;
        let bd = Infinity;
        seeds.forEach(([sx, sy], i) => {
          const d = (sx - x) ** 2 + (sy - y) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        const owner = best % 2 === 0 ? 0 : 1;
        cells[at(x, y)] = owner;
        cells[at(cols - 1 - x, y)] = 1 - owner;
      }
    }
  }

  if (has("stone")) {
    const blobs = 3 + Math.floor(rng() * 3);
    const cap = Math.floor(cols * rows * 0.05);
    let placed = 0;
    for (let b = 0; b < blobs && placed < cap; b++) {
      let x = 2 + Math.floor(rng() * (half - 4));
      let y = 2 + Math.floor(rng() * (rows - 4));
      const len = 2 + Math.floor(rng() * 4);
      for (let i = 0; i < len; i++) {
        cells[at(x, y)] = WALL;
        cells[at(cols - 1 - x, y)] = WALL;
        placed++;
        const dir = Math.floor(rng() * 4);
        x = Math.max(1, Math.min(half - 2, x + (dir === 0 ? 1 : dir === 1 ? -1 : 0)));
        y = Math.max(1, Math.min(rows - 2, y + (dir === 2 ? 1 : dir === 3 ? -1 : 0)));
      }
    }
  }

  const ballsPerSide = has("twin") ? 2 : 1;
  const spawnsL: Array<[number, number]> = [];
  const spawnsR: Array<[number, number]> = [];
  for (let i = 0; i < ballsPerSide; i++) {
    for (let tries = 0; tries < 80; tries++) {
      const x = 2 + Math.floor(rng() * (half - 4));
      const y = 2 + Math.floor(rng() * (rows - 4));
      if (cells[at(x, y)] !== 0 || cells[at(cols - 1 - x, y)] !== 1) continue;
      spawnsL.push([x + 0.5, y + 0.5]);
      spawnsR.push([cols - 1 - x + 0.5, y + 0.5]);
      break;
    }
    if (spawnsL.length <= i) {
      spawnsL.push([half / 2, rows / 2 + i]);
      spawnsR.push([cols - half / 2, rows / 2 + i]);
    }
  }

  let duration = rules.duration ?? 100;
  let ballSpeed = 8.2;
  if (has("sprint")) {
    duration = 60;
    ballSpeed *= 1.25;
  }
  if (has("marathon")) duration = 140;

  let everySec = rules.giftEverySec ?? 7;
  let max = 4;
  if (has("generous")) {
    everySec *= 0.6;
    max += 2;
  }
  if (has("drought")) everySec = 9999;
  const pool: GiftKind[] = ALL_GIFTS;

  return {
    seed,
    cols,
    rows,
    duration,
    winShare: rules.winShare ?? 0.85,
    ballsPerSide,
    ballSpeed,
    ballRadius: 0.4,
    cells,
    spawns: [spawnsL, spawnsR],
    gifts: { everySec, max, ttl: 16, pool },
    cardCostScale: rules.cardCostScale ?? 1,
    playerTurn: 4.4 + (rules.playerTurnBonus ?? 0),
  };
}

/** Progressive disclosure: new players see plain boards, veterans see mixed ones. */
export function chooseMutators(rng: () => number, matchesPlayed: number, kind: MatchKind, rules: RuleOverrides): MutatorId[] {
  const allowed = (Object.keys(MUTATORS) as MutatorId[]).filter((m) => !(rules.disabledMutators ?? []).includes(m));
  const budget = kind === "boss" ? 2 : matchesPlayed < 3 ? 0 : matchesPlayed < 10 ? 1 : rng() < 0.45 ? 2 : 1;
  const out: MutatorId[] = [];
  const bag = [...allowed];
  while (out.length < budget && bag.length) {
    const m = bag.splice(Math.floor(rng() * bag.length), 1)[0];
    if (m === "sprint" && out.includes("marathon")) continue;
    if (m === "marathon" && out.includes("sprint")) continue;
    if (m === "drought" && out.includes("generous")) continue;
    if (m === "generous" && out.includes("drought")) continue;
    out.push(m);
  }
  return out;
}

export function choosePersona(rng: () => number, kind: MatchKind, skillGuess: number): PersonaId {
  if (kind === "boss") return "roaster";
  const pool: PersonaId[] = skillGuess < 0.3 ? ["drip", "drip", "pour", "coldbrew"] : ["pour", "espresso", "coldbrew", "moka", "drip"];
  const id = pool[Math.floor(rng() * pool.length)];
  return PERSONAS[id].id;
}

export function planMatch(input: {
  seed: number;
  kind: MatchKind;
  matchesPlayed: number;
  playerSkill: number;
  targetWin: number;
  rules: RuleOverrides;
  forceMutators?: MutatorId[];
  forcePersona?: PersonaId;
}): MatchSpec {
  const rng = mulberry32(input.seed ^ 0x51ed270b);
  const mutators = input.forceMutators ?? chooseMutators(rng, input.matchesPlayed, input.kind, input.rules);
  const persona = input.forcePersona ?? choosePersona(rng, input.kind, input.playerSkill);
  const cfg = buildConfig(input.seed, mutators, input.rules);
  return {
    id: `${input.kind}-${input.seed}`,
    kind: input.kind,
    seed: input.seed,
    name: input.kind === "boss" ? `Boss: ${matchName(input.seed, mutators)}` : matchName(input.seed, mutators),
    persona,
    mutators,
    cfg,
    oppSkill: input.playerSkill,
    targetWin: input.targetWin,
    predictedWin: input.targetWin,
  };
}
