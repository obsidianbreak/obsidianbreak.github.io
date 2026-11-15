import { mulberry32 } from "../lib/rng";
import { WALL } from "./types";
import type { BrainParams, PersonaId, Team } from "./types";
import type { Sim } from "./Sim";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Persona {
  id: PersonaId;
  name: string;
  tagline: string;
  /** Multipliers applied on top of the skill curve. */
  turn: number;
  aggro: number;
  greed: number;
  noise: number;
}

export const PERSONAS: Record<PersonaId, Persona> = {
  drip: { id: "drip", name: "Drip", tagline: "Slow, steady, forgiving", turn: 0.85, aggro: 0.8, greed: 0.8, noise: 1.2 },
  pour: { id: "pour", name: "Pour Over", tagline: "Balanced and clean", turn: 1, aggro: 1, greed: 1, noise: 1 },
  espresso: { id: "espresso", name: "Espresso", tagline: "Hits the front line hard", turn: 1.1, aggro: 1.5, greed: 0.5, noise: 0.9 },
  coldbrew: { id: "coldbrew", name: "Cold Brew", tagline: "Patient, hunts every gift", turn: 0.95, aggro: 0.7, greed: 1.8, noise: 0.8 },
  moka: { id: "moka", name: "Moka", tagline: "Fast, erratic, dangerous", turn: 1.3, aggro: 1.1, greed: 1.1, noise: 1.5 },
  roaster: { id: "roaster", name: "The Roaster", tagline: "Plays every card well", turn: 1.15, aggro: 1.3, greed: 1.3, noise: 0.7 },
};

/** Maps a 0 to 1 skill value and a persona to concrete behaviour. */
export function brainParams(skill: number, persona: PersonaId): BrainParams {
  const s = Math.max(0, Math.min(1, skill));
  const p = PERSONAS[persona];
  return {
    reaction: lerp(0.85, 0.14, s),
    noise: lerp(5.2, 0.5, s) * p.noise,
    turn: lerp(1.5, 5.2, s) * p.turn,
    aggro: lerp(0.6, 1.4, s) * p.aggro,
    greed: lerp(0.3, 1.2, s) * p.greed,
    castAt: lerp(95, 45, s),
  };
}

function gauss(rng: () => number): number {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * A decision loop that picks where each ball should head. Used as the
 * opponent, and also (with a human-like skill value) as the stand-in
 * player in automated playtests.
 */
export class Brain {
  readonly team: Team;
  params: BrainParams;
  private rng: () => number;
  private timer = 0;
  private castTimer = 0;

  constructor(team: Team, params: BrainParams, seed: number) {
    this.team = team;
    this.params = params;
    this.rng = mulberry32(seed ^ (team + 1) * 7919);
    this.timer = this.rng() * params.reaction;
  }

  update(sim: Sim, dt: number): void {
    sim.turn[this.team] = this.params.turn;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.params.reaction * (0.8 + this.rng() * 0.4);
      for (const b of sim.balls) if (b.team === this.team) this.think(sim, b);
    }
    this.castTimer -= dt;
    if (this.castTimer <= 0) {
      this.castTimer = 1;
      this.maybeCast(sim);
    }
  }

  private think(sim: Sim, b: Sim["balls"][number]): void {
    const enemy = (1 - this.team) as Team;
    const { cols, rows, owner } = sim;
    const { aggro, greed, noise } = this.params;
    let bestX = this.team === 0 ? cols * 0.75 : cols * 0.25;
    let bestY = this.rng() * rows;
    let best = -Infinity;
    const radius = 11;
    for (let k = 0; k < 14; k++) {
      const cx = Math.max(0, Math.min(cols - 1, Math.round(b.x + (this.rng() * 2 - 1) * radius)));
      const cy = Math.max(0, Math.min(rows - 1, Math.round(b.y + (this.rng() * 2 - 1) * radius)));
      if (owner[cy * cols + cx] !== enemy) continue;
      let hn = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const o = owner[y * cols + x];
          if (o === enemy) hn++;
          else if (o === WALL) hn -= 0.5;
        }
      }
      const score = aggro * hn - Math.hypot(cx - b.x, cy - b.y) * 0.35;
      if (score > best) {
        best = score;
        bestX = cx + 0.5;
        bestY = cy + 0.5;
      }
    }
    for (const g of sim.gifts) {
      const d = Math.hypot(g.cx + 0.5 - b.x, g.cy + 0.5 - b.y);
      if (d > 16) continue;
      const score = greed * 14 - d * 0.6;
      if (score > best) {
        best = score;
        bestX = g.cx + 0.5;
        bestY = g.cy + 0.5;
      }
    }
    b.aim = { x: bestX + gauss(this.rng) * noise, y: bestY + gauss(this.rng) * noise };
  }

  private maybeCast(sim: Sim): void {
    const t = this.team;
    if (sim.energy[t] < this.params.castAt * 0.6) return;
    for (let slot = 0; slot < sim.cards[t].length; slot++) {
      const kind = sim.cards[t][slot];
      if (sim.energy[t] >= sim.cardCost(kind) && sim.energy[t] >= this.params.castAt * 0.6) {
        const lead = sim.balls.find((b) => b.team === t && b.life === Infinity);
        sim.cast(t, slot, lead?.aim ?? undefined);
        return;
      }
    }
  }
}
