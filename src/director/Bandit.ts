import type { Experiment, Primitive } from "./RulesEngine";

const KEY = "obsidian-break:bandit:v1";

interface ArmStat {
  a: number;
  b: number;
}

interface Pending {
  exp: string;
  segment: string;
  arm: string;
  at: number;
}

interface State {
  stats: Record<string, Record<string, ArmStat>>;
  pending: Pending[];
}

function gamma(shape: number): number {
  if (shape < 1) return gamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x = 0;
    let v = 0;
    do {
      const u1 = Math.max(1e-12, Math.random());
      const u2 = Math.random();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(a: number, b: number): number {
  const x = gamma(a);
  const y = gamma(b);
  return x / (x + y);
}

/**
 * Contextual bandit using Thompson sampling. The context is a segment
 * string (for example the player's tier and input type), and every
 * segment learns its own best arm. Reward is 1 when the player starts
 * another match soon after finishing one, which is a clean proxy for
 * "this version made them want more".
 */
export class Bandit {
  private state: State;

  constructor() {
    this.state = this.load();
  }

  private load(): State {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as State;
    } catch {
      // Ignore corrupt or blocked storage.
    }
    return { stats: {}, pending: [] };
  }

  private save(): void {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      // Storage full or blocked. Experiments simply restart next time.
    }
  }

  choose(exp: Experiment, segment: string): { arm: string; value: Primitive } {
    const key = `${exp.id}:${segment}`;
    const table = (this.state.stats[key] ??= {});
    let best = exp.arms[0];
    let bestDraw = -1;
    for (const arm of exp.arms) {
      const s = (table[arm.id] ??= { a: 1, b: 1 });
      const draw = sampleBeta(s.a, s.b);
      if (draw > bestDraw) {
        bestDraw = draw;
        best = arm;
      }
    }
    return { arm: best.id, value: best.value };
  }

  /** Registers the arms a match actually ran with. The clock starts when the match ends. */
  expose(items: Array<{ exp: string; segment: string; arm: string }>): void {
    this.state.pending = items.map((i) => ({ ...i, at: 0 }));
    this.save();
  }

  markEnded(): void {
    const now = Date.now();
    for (const p of this.state.pending) p.at = now;
    this.save();
  }

  /** Call when a new match starts. The previous match's arms earn reward 1 if it ended recently. */
  settle(windowMs = 120000): void {
    const now = Date.now();
    for (const p of this.state.pending) {
      const table = (this.state.stats[`${p.exp}:${p.segment}`] ??= {});
      const s = (table[p.arm] ??= { a: 1, b: 1 });
      if (p.at > 0 && now - p.at <= windowMs) s.a += 1;
      else s.b += 1;
    }
    this.state.pending = [];
    this.save();
  }

  snapshot(): State["stats"] {
    return this.state.stats;
  }
}
