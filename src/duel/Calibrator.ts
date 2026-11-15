import { Brain, brainParams } from "./Brain";
import { Sim } from "./Sim";
import type { DuelConfig, PersonaId } from "./types";

export interface PlaytestResult {
  winner: 0 | 1 | -1;
  margin: number;
}

/** One automated match between a stand-in player and the opponent, run headless. */
export function playtest(cfg: DuelConfig, playerSkill: number, oppSkill: number, persona: PersonaId, salt: number): PlaytestResult {
  const seeded: DuelConfig = { ...cfg, seed: cfg.seed + salt * 101 };
  const sim = new Sim(seeded);
  sim.emit = false;
  const me = new Brain(0, brainParams(playerSkill * 0.8, "pour"), seeded.seed);
  const opp = new Brain(1, brainParams(oppSkill, persona), seeded.seed + 17);
  const dt = 1 / 30;
  while (!sim.ended) {
    me.update(sim, dt);
    opp.update(sim, dt);
    sim.step(dt);
  }
  return { winner: sim.winner, margin: sim.share(0) - sim.share(1) };
}

export function winProbability(cfg: DuelConfig, playerSkill: number, oppSkill: number, persona: PersonaId, runs: number): number {
  let score = 0;
  for (let i = 0; i < runs; i++) {
    const r = playtest(cfg, playerSkill, oppSkill, persona, i);
    score += r.winner === 0 ? 1 : r.winner === -1 ? 0.5 : 0;
  }
  return score / runs;
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Simulation based difficulty tuning. Bisects the opponent skill until
 * the stand-in player wins about as often as the director wants.
 * Win probability falls as opponent skill rises, so bisection fits.
 */
export async function calibrate(
  cfg: DuelConfig,
  persona: PersonaId,
  playerSkill: number,
  targetWin: number,
  options: { runs?: number; steps?: number } = {},
): Promise<{ oppSkill: number; predictedWin: number }> {
  const runs = options.runs ?? 8;
  const steps = options.steps ?? 5;
  let lo = 0.05;
  let hi = 0.98;
  let bestSkill = playerSkill;
  let bestErr = Infinity;
  let bestP = targetWin;
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const p = winProbability(cfg, playerSkill, mid, persona, runs);
    const err = Math.abs(p - targetWin);
    if (err < bestErr) {
      bestErr = err;
      bestSkill = mid;
      bestP = p;
    }
    if (p > targetWin) lo = mid;
    else hi = mid;
    await yieldToUi();
  }
  return { oppSkill: bestSkill, predictedWin: bestP };
}
