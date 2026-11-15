import type { MatchKind } from "../duel/Generator";

export interface FlowState {
  hist: number[];
  integral: number;
  lastErr: number;
}

export const freshFlow = (): FlowState => ({ hist: [], integral: 0, lastErr: 0 });

const BASE_TARGET = 0.58;

/**
 * Dynamic difficulty as a feedback controller. The target is the win
 * probability we want for the next match. A PID loop compares the
 * recent real results with a healthy flow rate and nudges the target.
 * The match generator then builds an opponent to hit that target.
 */
export function nextTarget(
  state: FlowState,
  info: { matchesPlayed: number; winStreak: number; lossStreak: number; kind: MatchKind },
): number {
  if (info.kind === "boss") return 0.42;
  if (info.kind === "daily") return 0.5;
  if (info.matchesPlayed < 3) return 0.78;
  const recent = state.hist.slice(-6);
  const rate = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : BASE_TARGET;
  const err = BASE_TARGET - rate;
  let p = BASE_TARGET + 0.5 * err + 0.15 * state.integral + 0.3 * (err - state.lastErr);
  if (info.lossStreak >= 2) p += 0.08 * (info.lossStreak - 1);
  if (info.winStreak >= 4) p -= 0.04 * (info.winStreak - 3);
  return Math.max(0.3, Math.min(0.85, p));
}

export function recordOutcome(state: FlowState, outcome: number): FlowState {
  const recent = state.hist.slice(-6);
  const rate = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : BASE_TARGET;
  const err = BASE_TARGET - rate;
  return {
    hist: [...state.hist, outcome].slice(-12),
    integral: Math.max(-1, Math.min(1, state.integral + err * 0.5)),
    lastErr: err,
  };
}
