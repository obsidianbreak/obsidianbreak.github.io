import { AudioEngine } from "../engine/AudioEngine";
import { EventBus } from "../engine/EventBus";
import { Brain, brainParams } from "../duel/Brain";
import { GIFTS } from "../duel/gifts";
import { Sim } from "../duel/Sim";
import type { MatchSpec } from "../duel/Generator";
import type { BrainParams, GiftKind, Team } from "../duel/types";
import { evaluate } from "../director/RulesEngine";
import type { RuleSet } from "../director/RulesEngine";
import { FrameMeter } from "../director/Context";
import { BoardRenderer } from "../render/BoardRenderer";
import { foamBus } from "../td/Signals";
import { buzz, setHapticsEnabled } from "../lib/haptics";

export interface BannerItem {
  id: number;
  label: string;
  team: Team;
  at: number;
}

export interface CardView {
  kind: GiftKind;
  label: string;
  blurb: string;
  cost: number;
  ready: boolean;
}

export interface HudState {
  phase: "countdown" | "playing" | "ended" | "paused";
  countdown: number;
  shareL: number;
  shareR: number;
  timeLeft: number;
  energy: number;
  cards: CardView[];
  banner: BannerItem[];
  photo: boolean;
  winShare: number;
  assisting: boolean;
}

export interface MatchEnd {
  winner: Team | -1;
  shareL: number;
  shareR: number;
  margin: number;
  /** Tiles the loser needed to flip the result, or 0. */
  tilesShort: number;
  flips: number;
  gifts: number;
  casts: number;
  seconds: number;
  cells: number[];
  cols: number;
  rows: number;
}

interface Events {
  hud: HudState;
  end: MatchEnd;
  [key: string]: unknown;
}

export interface StartOptions {
  adaptive: boolean;
  rules: RuleSet;
  lite: boolean;
  sound: boolean;
  haptics: boolean;
  night: boolean;
}

const STEP = 1 / 60;

/**
 * Glue between the pure simulation and the browser: fixed timestep,
 * input, rendering, audio, haptics, live rules and the visual network feed.
 */
export class DuelEngine {
  readonly events = new EventBus<Events>();
  private canvas: HTMLCanvasElement;
  private renderer: BoardRenderer;
  private audio = new AudioEngine();
  private meter = new FrameMeter(2);
  private sim: Sim | null = null;
  private brain: Brain | null = null;
  private baseBrain: BrainParams | null = null;
  private opts: StartOptions | null = null;
  private flipAnim = new Float32Array(0);
  private raf: number | null = null;
  private last = 0;
  private acc = 0;
  private clock = 0;
  private countdown = 3;
  private paused = false;
  private ended = false;
  private banner: BannerItem[] = [];
  private bannerId = 1;
  private hudTimer = 0;
  private liveTimer = 0;
  private timeScale = 1;
  private photo = false;
  private assisting = false;
  private mul = { playerTurn: 1, aiTurn: 1, aiReaction: 1 };
  private well: { x: number; y: number } | null = null;
  private pointerId: number | null = null;
  private tickedSecond = -1;
  private flipRate = 0;
  private flipsThisFrame = 0;
  private detach: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new BoardRenderer(canvas);
    // Only the first finger steers. Extra fingers, palms and gestures are ignored.
    const down = (e: PointerEvent) => {
      if (this.pointerId !== null && e.pointerType !== "mouse") return;
      e.preventDefault();
      this.pointerId = e.pointerId;
      canvas.setPointerCapture?.(e.pointerId);
      this.setWell(e, e.pointerType !== "mouse");
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        this.setWell(e, false);
      } else if (e.pointerId === this.pointerId) {
        e.preventDefault();
        this.setWell(e, true);
      }
    };
    const end = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.type === "pointerup") return;
      if (e.pointerId === this.pointerId || e.pointerType === "mouse") {
        this.pointerId = null;
        this.well = null;
      }
    };
    const opts = { passive: false } as AddEventListenerOptions;
    canvas.addEventListener("pointerdown", down, opts);
    canvas.addEventListener("pointermove", move, opts);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
    canvas.addEventListener("pointerleave", end);
    this.detach = [
      () => canvas.removeEventListener("pointerdown", down),
      () => canvas.removeEventListener("pointermove", move),
      () => canvas.removeEventListener("pointerup", end),
      () => canvas.removeEventListener("pointercancel", end),
      () => canvas.removeEventListener("lostpointercapture", end),
      () => canvas.removeEventListener("pointerleave", end),
    ];
  }

  private setWell(e: PointerEvent, touch: boolean): void {
    if (!this.sim) return;
    const rect = this.canvas.getBoundingClientRect();
    const cols = this.sim.cols;
    const rows = this.sim.rows;
    // The guide sits 44 px above a finger so your hand never hides it.
    const lift = touch ? 44 / (rect.height / rows) : 0;
    const x = Math.max(0, Math.min(cols, ((e.clientX - rect.left) / rect.width) * cols));
    const y = Math.max(0, Math.min(rows, ((e.clientY - rect.top) / rect.height) * rows - lift));
    this.well = { x, y };
  }

  fit(maxW: number, maxH: number): void {
    if (!this.sim) return;
    this.renderer.fit(this.sim.cols, this.sim.rows, maxW, maxH, Math.min(window.devicePixelRatio || 1, 2));
  }

  start(spec: MatchSpec, opts: StartOptions): void {
    this.opts = opts;
    this.sim = new Sim(spec.cfg);
    const params = brainParams(spec.oppSkill, spec.persona);
    this.baseBrain = params;
    this.brain = new Brain(1, { ...params }, spec.seed);
    this.flipAnim = new Float32Array(spec.cfg.cols * spec.cfg.rows);
    this.renderer.forget();
    this.banner = [];
    this.countdown = 3;
    this.paused = false;
    this.ended = false;
    this.timeScale = 1;
    this.photo = false;
    this.assisting = false;
    this.mul = { playerTurn: 1, aiTurn: 1, aiReaction: 1 };
    this.tickedSecond = -1;
    this.audio.setEnabled(opts.sound);
    setHapticsEnabled(opts.haptics);
    foamBus.mode = opts.night ? "night" : "day";
    this.audio.resume();
    this.audio.startDrone();
    if (this.raf === null) {
      this.last = performance.now();
      this.loop(this.last);
    }
    this.emitHud();
  }

  setPaused(p: boolean): void {
    if (this.ended) return;
    this.paused = p;
    if (p) this.audio.stopDrone();
    else this.audio.startDrone();
    this.emitHud();
  }

  setSound(on: boolean): void {
    this.audio.setEnabled(on);
    if (on && !this.paused && !this.ended) this.audio.startDrone();
  }

  setTheme(night: boolean): void {
    foamBus.mode = night ? "night" : "day";
  }

  cast(slot: number): void {
    const sim = this.sim;
    if (!sim || this.countdown > 0 || this.paused || this.ended) return;
    if (sim.cast(0, slot, this.well ?? undefined)) {
      this.audio.cast();
      buzz([12, 30, 12]);
    }
  }

  destroy(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.audio.stopDrone();
    this.detach.forEach((d) => d());
    foamBus.points = [];
    foamBus.tension = 0;
  }

  /* ---------------------------------------------------------------- loop */

  private loop = (now: number): void => {
    const raw = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.clock += raw;
    foamBus.time = this.clock;
    foamBus.quality = this.opts?.lite ? 0 : this.meter.tick(now);
    const sim = this.sim;

    if (sim && !this.paused) {
      if (this.countdown > 0) {
        const before = Math.ceil(this.countdown);
        this.countdown -= raw;
        const after = Math.ceil(Math.max(0, this.countdown));
        if (after !== before && after > 0) this.audio.tick();
        if (this.countdown <= 0) this.audio.resume();
      } else if (!this.ended) {
        this.acc += raw * this.timeScale;
        let steps = 0;
        while (this.acc >= STEP && steps < 6) {
          this.stepOnce(sim);
          this.acc -= STEP;
          steps++;
        }
        this.postStep(sim, raw);
      }
      this.renderer.decay(this.flipAnim, raw);
      this.hudTimer -= raw;
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.1;
        this.emitHud();
      }
    }
    if (sim) {
      this.renderer.render(sim, { time: this.clock, banner: this.banner, flipAnim: this.flipAnim, well: sim.wells[0] ? { ...sim.wells[0]! } : this.well ? { ...this.well, radius: 9 } : null, quality: foamBus.quality });
      this.feedFoam(sim);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private stepOnce(sim: Sim): void {
    sim.wells[0] = this.well ? { x: this.well.x, y: this.well.y, radius: 9 } : null;
    sim.turn[0] = sim.cfg.playerTurn * this.mul.playerTurn;
    this.brain?.update(sim, STEP);
    sim.step(STEP);
  }

  private postStep(sim: Sim, raw: number): void {
    for (const e of sim.drain()) {
      switch (e.type) {
        case "flip":
          this.flipAnim[e.idx] = 1;
          this.flipsThisFrame++;
          this.audio.flip(e.team, (e.idx % sim.cols) / sim.cols);
          if (e.idx % 9 === 0) foamBus.ripples.push({ ...this.cellToUv(sim, e.idx), born: this.clock });
          break;
        case "bounce":
          this.audio.bounce(e.team);
          break;
        case "gift":
          this.banner.unshift({ id: this.bannerId++, label: GIFTS[e.kind].label, team: e.team, at: this.clock });
          this.banner = this.banner.slice(0, 4);
          this.audio.gift();
          if (e.team === 0) buzz([10, 20, 10]);
          break;
        case "end":
          this.onEnd(sim, e.winner);
          break;
        default:
          break;
      }
    }
    if (foamBus.ripples.length > 8) foamBus.ripples = foamBus.ripples.slice(-8);

    this.flipRate += (this.flipsThisFrame / Math.max(raw, 0.001) / 60 - this.flipRate) * 0.1;
    this.flipsThisFrame = 0;

    this.liveTimer -= raw;
    if (this.liveTimer <= 0) {
      this.liveTimer = 1;
      this.applyLiveRules(sim);
    }

    const left = sim.cfg.duration - sim.time;
    const margin = Math.abs(sim.share(0) - sim.share(1));
    this.photo = left < 8 && left > 0 && margin < 0.03;
    this.timeScale = this.photo ? 0.6 : 1;
    const sec = Math.ceil(left);
    if (left < 6 && sec !== this.tickedSecond && sec > 0) {
      this.tickedSecond = sec;
      this.audio.tick();
    }
  }

  private applyLiveRules(sim: Sim): void {
    if (!this.opts || !this.baseBrain || !this.brain) return;
    let mul = { playerTurn: 1, aiTurn: 1, aiReaction: 1 };
    if (this.opts.adaptive) {
      const facts = { deficit: sim.share(1) - sim.share(0), timeFrac: sim.time / sim.cfg.duration };
      const r = evaluate(this.opts.rules, "live", facts);
      mul = {
        playerTurn: Number(r.params.playerTurnMul ?? 1),
        aiTurn: Number(r.params.aiTurnMul ?? 1),
        aiReaction: Number(r.params.aiReactionMul ?? 1),
      };
    }
    this.mul = mul;
    this.assisting = mul.playerTurn > 1 || mul.aiReaction > 1;
    this.brain.params = { ...this.baseBrain, turn: this.baseBrain.turn * mul.aiTurn, reaction: this.baseBrain.reaction * mul.aiReaction };
  }

  private onEnd(sim: Sim, winner: Team | -1): void {
    this.ended = true;
    this.audio.stopDrone();
    if (winner === 0) {
      this.audio.win();
      buzz([20, 40, 20, 40, 80]);
    } else if (winner === 1) {
      this.audio.lose();
      buzz([60, 40, 60]);
    }
    const shareL = sim.share(0);
    const shareR = sim.share(1);
    const diff = sim.counts[1] - sim.counts[0];
    const end: MatchEnd = {
      winner,
      shareL,
      shareR,
      margin: shareL - shareR,
      tilesShort: winner === 1 ? Math.floor(diff / 2) + 1 : 0,
      flips: sim.stats[0].flips,
      gifts: sim.stats[0].gifts,
      casts: sim.stats[0].casts,
      seconds: sim.time,
      cells: Array.from(sim.owner),
      cols: sim.cols,
      rows: sim.rows,
    };
    this.emitHud();
    this.events.emit("end", end);
  }

  private cellToUv(sim: Sim, idx: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const cx = ((idx % sim.cols) + 0.5) / sim.cols;
    const cy = (Math.floor(idx / sim.cols) + 0.5) / sim.rows;
    return { x: (rect.left + cx * rect.width) / window.innerWidth, y: (rect.top + cy * rect.height) / window.innerHeight };
  }

  private feedFoam(sim: Sim): void {
    const rect = this.canvas.getBoundingClientRect();
    const toUv = (x: number, y: number) => ({
      x: (rect.left + (x / sim.cols) * rect.width) / window.innerWidth,
      y: (rect.top + (y / sim.rows) * rect.height) / window.innerHeight,
    });
    const pts = sim.balls.slice(0, 10).map((b) => ({ ...toUv(b.x, b.y), w: 0.5 }));
    if (this.well) pts.push({ ...toUv(this.well.x, this.well.y), w: 1 });
    foamBus.points = pts;
    foamBus.share = sim.share(0);
    const closeness = 1 - Math.min(1, Math.abs(sim.share(0) - sim.share(1)) / 0.2);
    foamBus.tension = Math.min(1, this.flipRate * 0.5 + closeness * 0.35 + (this.photo ? 0.5 : 0));
  }

  private emitHud(): void {
    const sim = this.sim;
    if (!sim) return;
    // Banner entries fade out after a few seconds so the board stays clear.
    this.banner = this.banner.filter((b) => this.clock - b.at < 5);
    const cards: CardView[] = sim.cards[0].map((kind) => ({
      kind,
      label: GIFTS[kind].label,
      blurb: GIFTS[kind].blurb,
      cost: sim.cardCost(kind),
      ready: sim.energy[0] >= sim.cardCost(kind),
    }));
    this.events.emit("hud", {
      phase: this.ended ? "ended" : this.paused ? "paused" : this.countdown > 0 ? "countdown" : "playing",
      countdown: Math.max(0, Math.ceil(this.countdown)),
      shareL: sim.share(0),
      shareR: sim.share(1),
      timeLeft: Math.max(0, sim.cfg.duration - sim.time),
      energy: sim.energy[0],
      cards,
      banner: this.banner,
      photo: this.photo,
      winShare: sim.cfg.winShare,
      assisting: this.assisting,
    });
  }
}
