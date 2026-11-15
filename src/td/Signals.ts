/**
 * CHOP style signals. Each channel chases a target through a lag
 * filter, exactly like a Lag CHOP, so visuals ease instead of snapping.
 * Game code writes targets, the foam network reads smoothed values.
 */
interface Channel {
  value: number;
  target: number;
  lag: number;
}

export class Signals {
  private ch = new Map<string, Channel>();

  define(name: string, initial: number, lag: number): void {
    this.ch.set(name, { value: initial, target: initial, lag });
  }

  set(name: string, target: number): void {
    const c = this.ch.get(name);
    if (c) c.target = target;
  }

  get(name: string): number {
    return this.ch.get(name)?.value ?? 0;
  }

  step(dt: number): void {
    for (const c of this.ch.values()) c.value += (c.target - c.value) * Math.min(1, dt / Math.max(0.001, c.lag));
  }
}

export interface FoamPoint {
  x: number;
  y: number;
  w: number;
}

export interface FoamRipple {
  x: number;
  y: number;
  born: number;
}

/** The single shared surface between the game and the visual network. */
export const foamBus = {
  points: [] as FoamPoint[],
  ripples: [] as FoamRipple[],
  tension: 0,
  share: 0.5,
  mode: "day" as "day" | "night",
  quality: 2 as 0 | 1 | 2,
  /** 1 on menus, lower during play so the board stays the hero. */
  intensity: 1,
  time: 0,
};
