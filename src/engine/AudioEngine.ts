import { getSharedAudioContext, unlockSharedAudioContext } from "./sharedAudioContext";
import type { Team } from "../duel/types";

const PENTATONIC = [0, 2, 4, 7, 9];
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Territory makes music. Every flipped tile plays a pentatonic note
 * whose pitch comes from where on the board it happened, so a push
 * down one side literally sounds like a rising run. Everything is
 * synthesized, nothing is downloaded.
 */
export class AudioEngine {
  private enabled = true;
  private bus: GainNode | null = null;
  private drone: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  private lastFlip = 0;
  private flipBudget = 0;

  private chain(): { ctx: AudioContext; bus: GainNode } {
    const ctx = getSharedAudioContext();
    if (!this.bus) {
      const bus = ctx.createGain();
      bus.gain.value = 0.85;
      bus.connect(ctx.destination);
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.31;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1700;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      bus.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(wet);
      wet.connect(ctx.destination);
      this.bus = bus;
    }
    return { ctx, bus: this.bus };
  }

  resume(): void {
    unlockSharedAudioContext();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stopDrone();
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    if (!this.enabled) return;
    const { ctx, bus } = this.chain();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** `pos` is 0 to 1 across the board. Rate limited so big captures stay musical, not noisy. */
  flip(team: Team, pos: number): void {
    const now = performance.now();
    this.flipBudget = Math.min(6, this.flipBudget + (now - this.lastFlip) / 45);
    this.lastFlip = now;
    if (this.flipBudget < 1) return;
    this.flipBudget -= 1;
    const step = Math.floor(pos * 10);
    const midi = (team === 0 ? 64 : 52) + PENTATONIC[step % 5] + 12 * Math.floor(step / 5);
    this.tone(hz(midi), team === 0 ? 0.26 : 0.34, team === 0 ? "triangle" : "sine", 0.045);
  }

  bounce(team: Team): void {
    this.tone(team === 0 ? 180 : 130, 0.06, "sine", 0.03);
  }

  gift(): void {
    [0, 2, 4].forEach((s, i) => this.tone(hz(72 + PENTATONIC[s]), 0.28, "sine", 0.045, i * 0.06));
  }

  cast(): void {
    [4, 3, 2, 0].forEach((s, i) => this.tone(hz(76 + PENTATONIC[s % 5]), 0.22, "triangle", 0.04, i * 0.05));
  }

  tick(): void {
    this.tone(880, 0.05, "square", 0.02);
  }

  win(): void {
    [0, 1, 2, 3, 4, 0].forEach((s, i) => this.tone(hz(67 + PENTATONIC[s % 5] + (i > 4 ? 12 : 0)), 0.5, "triangle", 0.055, i * 0.11));
  }

  lose(): void {
    [4, 2, 0].forEach((s, i) => this.tone(hz(60 + PENTATONIC[s]), 0.7, "sine", 0.055, i * 0.18));
  }

  uiTap(): void {
    this.tone(660, 0.07, "sine", 0.025);
  }

  startDrone(): void {
    if (!this.enabled || this.drone) return;
    const { ctx, bus } = this.chain();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 2);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 480;
    const osc = [38, 45, 50].map((m, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = hz(m);
      o.detune.value = (i - 1) * 5;
      o.connect(lp);
      o.start();
      return o;
    });
    lp.connect(gain);
    gain.connect(bus);
    this.drone = { osc, gain };
  }

  stopDrone(): void {
    if (!this.drone) return;
    const { osc, gain } = this.drone;
    const ctx = getSharedAudioContext();
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    for (const o of osc) o.stop(ctx.currentTime + 0.5);
    this.drone = null;
  }
}
