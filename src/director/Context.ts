export interface DeviceContext {
  reducedMotion: boolean;
  saveData: boolean;
  lowPower: boolean;
  coarsePointer: boolean;
  hour: number;
}

type BatteryManager = { level: number; charging: boolean };

/**
 * On-device context, read locally and never uploaded. It decides how
 * heavy the visuals should be and feeds the rules engine. This is the
 * honest version of context aware ranking: use the device state to be
 * lighter and kinder, not to squeeze more attention out of people.
 */
export async function readContext(): Promise<DeviceContext> {
  const ctx: DeviceContext = {
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    saveData: (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false,
    lowPower: false,
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? true,
    hour: new Date().getHours(),
  };
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (nav.getBattery) {
      const b = await nav.getBattery();
      ctx.lowPower = b.level < 0.2 && !b.charging;
    }
  } catch {
    // Battery API unavailable. Assume normal power.
  }
  return ctx;
}

/** Watches frame time and recommends a visual quality tier with hysteresis. */
export class FrameMeter {
  private ema = 16.7;
  private last = 0;
  private cooldown = 0;
  quality: 0 | 1 | 2 = 2;

  constructor(initial: 0 | 1 | 2 = 2) {
    this.quality = initial;
  }

  tick(now: number): 0 | 1 | 2 {
    if (this.last > 0) {
      const dt = Math.min(100, now - this.last);
      this.ema += (dt - this.ema) * 0.05;
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        if (this.ema > 26 && this.quality > 0) {
          this.quality = (this.quality - 1) as 0 | 1 | 2;
          this.cooldown = 2500;
        } else if (this.ema < 17.5 && this.quality < 2) {
          this.quality = (this.quality + 1) as 0 | 1 | 2;
          this.cooldown = 6000;
        }
      }
    }
    this.last = now;
    return this.quality;
  }
}
