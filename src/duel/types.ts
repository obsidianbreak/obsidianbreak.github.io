/** Team 0 is Latte (the player, cream tiles). Team 1 is Roast (the AI, brown tiles). */
export type Team = 0 | 1;
export const LATTE: Team = 0;
export const ROAST: Team = 1;
/** Cell value for an unbreakable ceramic tile. */
export const WALL = 2;

export type GiftKind =
  | "ghost"
  | "eclipse"
  | "nitro"
  | "blackhole"
  | "colossus"
  | "trinity"
  | "wrecking"
  | "infiltrator"
  | "wormhole";

export type MutatorId = "twin" | "stone" | "foam" | "sprint" | "generous" | "drought" | "marathon";

export type PersonaId = "drip" | "pour" | "espresso" | "coldbrew" | "moka" | "roaster";

export interface BrainParams {
  /** Seconds between decisions. */
  reaction: number;
  /** Aim error in cells (standard deviation). */
  noise: number;
  /** Steering rate in radians per second. */
  turn: number;
  /** Weight on attacking dense enemy territory. */
  aggro: number;
  /** Weight on chasing gift tiles. */
  greed: number;
  /** Energy needed before the AI spends a card. */
  castAt: number;
}

export interface DuelConfig {
  seed: number;
  cols: number;
  rows: number;
  /** Match length in seconds. */
  duration: number;
  /** Territory share that wins instantly. */
  winShare: number;
  ballsPerSide: number;
  /** Ball speed in cells per second. */
  ballSpeed: number;
  ballRadius: number;
  /** One entry per cell: 0 latte, 1 roast, 2 wall. */
  cells: number[];
  /** Spawn points in cell units, per team. */
  spawns: [Array<[number, number]>, Array<[number, number]>];
  gifts: { everySec: number; max: number; ttl: number; pool: GiftKind[] };
  cardCostScale: number;
  /** Steering rate of the human side in radians per second. */
  playerTurn: number;
}

export interface Well {
  x: number;
  y: number;
  radius: number;
}

export interface SimBall {
  id: number;
  team: Team;
  x: number;
  y: number;
  /** Heading in radians. */
  a: number;
  r: number;
  ghost: number;
  nitro: number;
  colossus: number;
  wrecking: boolean;
  /** Seconds left for temporary balls, Infinity for permanent ones. */
  life: number;
  aim: { x: number; y: number } | null;
}

export interface SimGift {
  id: number;
  kind: GiftKind;
  cx: number;
  cy: number;
  ttl: number;
}

export interface BlackHole {
  x: number;
  y: number;
  team: Team;
  life: number;
  acc: number;
}

export interface Colony {
  team: Team;
  life: number;
  acc: number;
  cells: number[];
}

export type SimEvent =
  | { type: "flip"; idx: number; team: Team }
  | { type: "bounce"; team: Team }
  | { type: "gift-spawn"; id: number; kind: GiftKind }
  | { type: "gift"; team: Team; kind: GiftKind; source: "tile" | "card" }
  | { type: "hole"; x: number; y: number; team: Team }
  | { type: "end"; winner: Team | -1 };

export interface TeamStats {
  flips: number;
  gifts: number;
  casts: number;
}
