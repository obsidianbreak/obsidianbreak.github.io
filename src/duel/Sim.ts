import { mulberry32 } from "../lib/rng";
import { GIFTS } from "./gifts";
import { WALL } from "./types";
import type {
  BlackHole,
  Colony,
  DuelConfig,
  GiftKind,
  SimBall,
  SimEvent,
  SimGift,
  Team,
  TeamStats,
  Well,
} from "./types";

const TAU = Math.PI * 2;

function wrap(a: number): number {
  let d = a % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/**
 * The whole match, with no DOM and no randomness except a seeded
 * generator. The same class powers the live game and the headless
 * automated playtests that calibrate opponents and difficulty.
 */
export class Sim {
  readonly cfg: DuelConfig;
  readonly cols: number;
  readonly rows: number;
  readonly owner: Uint8Array;
  readonly counts: [number, number] = [0, 0];
  readonly playable: number;
  balls: SimBall[] = [];
  gifts: SimGift[] = [];
  holes: BlackHole[] = [];
  colonies: Colony[] = [];
  time = 0;
  ended = false;
  /** 0, 1, or -1 for a draw. Meaningful once `ended` is true. */
  winner: Team | -1 = -1;
  wells: [Well | null, Well | null] = [null, null];
  turn: [number, number];
  energy: [number, number] = [0, 0];
  cards: [GiftKind[], GiftKind[]] = [[], []];
  stats: [TeamStats, TeamStats] = [
    { flips: 0, gifts: 0, casts: 0 },
    { flips: 0, gifts: 0, casts: 0 },
  ];
  events: SimEvent[] = [];
  emit = true;

  private rng: () => number;
  private nextId = 1;
  private giftTimer: number;
  private bounceCooldown = 0;

  constructor(cfg: DuelConfig) {
    this.cfg = cfg;
    this.cols = cfg.cols;
    this.rows = cfg.rows;
    this.owner = Uint8Array.from(cfg.cells);
    this.rng = mulberry32(cfg.seed ^ 0x9e3779b9);
    let walls = 0;
    for (const v of this.owner) {
      if (v === WALL) walls++;
      else this.counts[v]++;
    }
    this.playable = this.owner.length - walls;
    this.turn = [cfg.playerTurn, 3];
    this.giftTimer = Math.max(2, cfg.gifts.everySec * 0.6);
    for (const team of [0, 1] as Team[]) {
      cfg.spawns[team].forEach(([x, y], i) => {
        const base = team === 0 ? -0.4 : Math.PI + 0.4;
        this.balls.push(this.makeBall(team, x, y, base + (i % 2 ? 0.7 : -0.5) + (this.rng() - 0.5) * 0.4));
      });
      this.cards[team] = [this.drawCard(), this.drawCard()];
    }
  }

  private makeBall(team: Team, x: number, y: number, a: number, life = Infinity): SimBall {
    return {
      id: this.nextId++,
      team,
      x,
      y,
      a,
      r: this.cfg.ballRadius,
      ghost: 0,
      nitro: 0,
      colossus: 0,
      wrecking: false,
      life,
      aim: null,
    };
  }

  share(team: Team): number {
    return this.counts[team] / this.playable;
  }

  drawCard(): GiftKind {
    const pool = this.cfg.gifts.pool;
    let total = 0;
    for (const k of pool) total += GIFTS[k].weight;
    let roll = this.rng() * total;
    for (const k of pool) {
      roll -= GIFTS[k].weight;
      if (roll <= 0) return k;
    }
    return pool[0];
  }

  cardCost(kind: GiftKind): number {
    return Math.round(GIFTS[kind].cost * this.cfg.cardCostScale);
  }

  private push(e: SimEvent): void {
    if (this.emit) this.events.push(e);
  }

  /* ----------------------------------------------------------- stepping */

  step(dt: number): void {
    if (this.ended) return;
    this.time += dt;
    if (this.bounceCooldown > 0) this.bounceCooldown -= dt;

    this.updateGiftSpawns(dt);
    for (const b of this.balls) this.updateBall(b, dt);
    this.balls = this.balls.filter((b) => b.life > 0);
    this.updateHoles(dt);
    this.updateColonies(dt);
    for (const g of this.gifts) g.ttl -= dt;
    this.gifts = this.gifts.filter((g) => g.ttl > 0);

    for (const t of [0, 1] as Team[]) this.energy[t] = Math.min(100, this.energy[t] + dt * 1.1);

    const w0 = this.share(0) >= this.cfg.winShare;
    const w1 = this.share(1) >= this.cfg.winShare;
    if (w0 || w1) this.finish(w0 ? 0 : 1);
    else if (this.time >= this.cfg.duration) {
      const d = this.counts[0] - this.counts[1];
      this.finish(d === 0 ? -1 : d > 0 ? 0 : 1);
    }
  }

  private finish(winner: Team | -1): void {
    this.ended = true;
    this.winner = winner;
    this.push({ type: "end", winner });
  }

  /* -------------------------------------------------------------- balls */

  private updateBall(b: SimBall, dt: number): void {
    if (b.ghost > 0) b.ghost = Math.max(0, b.ghost - dt);
    if (b.nitro > 0) b.nitro = Math.max(0, b.nitro - dt);
    if (b.colossus > 0) {
      b.colossus = Math.max(0, b.colossus - dt);
      if (b.colossus === 0) b.r = this.cfg.ballRadius;
    }
    if (b.life !== Infinity) b.life -= dt;

    const well = this.wells[b.team];
    let tx = 0;
    let ty = 0;
    let steer = false;
    let falloff = 1;
    if (b.aim) {
      tx = b.aim.x;
      ty = b.aim.y;
      steer = true;
    } else if (well) {
      const d = Math.hypot(well.x - b.x, well.y - b.y);
      if (d < well.radius) {
        tx = well.x;
        ty = well.y;
        steer = true;
        falloff = 1 - (d / well.radius) * 0.45;
      }
    }
    if (steer) {
      const diff = wrap(Math.atan2(ty - b.y, tx - b.x) - b.a);
      const maxTurn = this.turn[b.team] * dt * falloff;
      b.a += Math.max(-maxTurn, Math.min(maxTurn, diff));
    }

    const speed = this.cfg.ballSpeed * (b.nitro > 0 ? 1.6 : 1);
    const total = speed * dt;
    const n = Math.max(1, Math.ceil(total / 0.3));
    const h = (speed * dt) / n;
    for (let i = 0; i < n; i++) {
      this.moveAxis(b, true, Math.cos(b.a) * h);
      this.moveAxis(b, false, Math.sin(b.a) * h);
    }
    this.checkGifts(b);
  }

  private moveAxis(b: SimBall, horizontal: boolean, delta: number): void {
    let nx = b.x + (horizontal ? delta : 0);
    let ny = b.y + (horizontal ? 0 : delta);
    const r = b.r;
    let bounced = false;

    if (nx - r < 0 || nx + r > this.cols) {
      nx = nx - r < 0 ? r : this.cols - r;
      b.a = Math.PI - b.a;
      bounced = true;
    }
    if (ny - r < 0 || ny + r > this.rows) {
      ny = ny - r < 0 ? r : this.rows - r;
      b.a = -b.a;
      bounced = true;
    }
    if (bounced) {
      b.x = nx;
      b.y = ny;
      return;
    }

    const x0 = Math.max(0, Math.floor(nx - r));
    const x1 = Math.min(this.cols - 1, Math.floor(nx + r));
    const y0 = Math.max(0, Math.floor(ny - r));
    const y1 = Math.min(this.rows - 1, Math.floor(ny + r));
    let hit = false;
    let hitX = 0;
    let hitY = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const idx = cy * this.cols + cx;
        const o = this.owner[idx];
        if (o === b.team) continue;
        if (o === WALL) {
          if (b.ghost > 0 || b.colossus > 0) continue;
          hit = true;
          hitX = cx;
          hitY = cy;
          continue;
        }
        this.flip(idx, b.team);
        hit = true;
        hitX = cx;
        hitY = cy;
      }
    }
    if (!hit) {
      b.x = nx;
      b.y = ny;
      return;
    }
    if (b.wrecking) {
      b.wrecking = false;
      this.blast(hitX, hitY, 2, b.team);
    }
    if (b.ghost > 0) {
      b.x = nx;
      b.y = ny;
      return;
    }
    if (horizontal) b.a = Math.PI - b.a;
    else b.a = -b.a;
    if (this.bounceCooldown <= 0) {
      this.bounceCooldown = 0.05;
      this.push({ type: "bounce", team: b.team });
    }
  }

  flip(idx: number, team: Team): void {
    const o = this.owner[idx];
    if (o === team || o === WALL) return;
    this.owner[idx] = team;
    this.counts[team]++;
    this.counts[o]--;
    this.stats[team].flips++;
    this.energy[team] = Math.min(100, this.energy[team] + 0.35);
    this.push({ type: "flip", idx, team });
  }

  private blast(cx: number, cy: number, radius: number, team: Team): void {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) continue;
        this.flip(y * this.cols + x, team);
      }
    }
  }

  /* -------------------------------------------------------------- gifts */

  private updateGiftSpawns(dt: number): void {
    const g = this.cfg.gifts;
    if (g.pool.length === 0) return;
    this.giftTimer -= dt;
    if (this.giftTimer > 0) return;
    this.giftTimer = g.everySec * (0.75 + this.rng() * 0.5);
    if (this.gifts.length >= g.max) return;
    for (let tries = 0; tries < 20; tries++) {
      const cx = Math.floor(this.cols * (0.2 + this.rng() * 0.6));
      const cy = Math.floor(this.rows * (0.08 + this.rng() * 0.84));
      const idx = cy * this.cols + cx;
      if (this.owner[idx] === WALL || this.gifts.some((q) => q.cx === cx && q.cy === cy)) continue;
      const kind = this.drawCard();
      const gift: SimGift = { id: this.nextId++, kind, cx, cy, ttl: g.ttl };
      this.gifts.push(gift);
      this.push({ type: "gift-spawn", id: gift.id, kind });
      return;
    }
  }

  private checkGifts(b: SimBall): void {
    if (this.gifts.length === 0) return;
    for (const g of this.gifts) {
      if (g.ttl <= 0) continue;
      if (b.x + b.r > g.cx && b.x - b.r < g.cx + 1 && b.y + b.r > g.cy && b.y - b.r < g.cy + 1) {
        g.ttl = 0;
        this.stats[b.team].gifts++;
        this.applyGift(b.team, g.kind, b, "tile");
      }
    }
  }

  applyGift(team: Team, kind: GiftKind, ball: SimBall | null, source: "tile" | "card", at?: { x: number; y: number }): void {
    const b = ball ?? this.pickBall(team, at);
    this.push({ type: "gift", team, kind, source });
    switch (kind) {
      case "ghost":
        if (b) b.ghost = 5;
        break;
      case "eclipse":
        if (b) {
          b.ghost = 6;
          b.colossus = 6;
          b.r = this.cfg.ballRadius * 1.6;
        }
        break;
      case "nitro":
        if (b) b.nitro = 5;
        break;
      case "colossus":
        if (b) {
          b.colossus = 6;
          b.r = this.cfg.ballRadius * 2.2;
        }
        break;
      case "trinity":
        if (b) {
          for (const off of [-0.5, 0.5]) this.balls.push(this.makeBall(team, b.x, b.y, b.a + off, 8));
        }
        break;
      case "wrecking":
        if (b) b.wrecking = true;
        break;
      case "blackhole": {
        const p = at ?? this.randomHostile(team) ?? { x: this.cols / 2, y: this.rows / 2 };
        this.holes.push({ x: p.x, y: p.y, team, life: 4, acc: 0 });
        this.push({ type: "hole", x: p.x, y: p.y, team });
        break;
      }
      case "infiltrator": {
        const p = this.randomHostile(team);
        if (p) {
          const idx = Math.floor(p.y) * this.cols + Math.floor(p.x);
          this.flip(idx, team);
          this.colonies.push({ team, life: 10, acc: 0, cells: [idx] });
        }
        break;
      }
      case "wormhole": {
        const p = this.randomHostile(team);
        if (b && p) {
          this.blast(Math.floor(p.x), Math.floor(p.y), 1, team);
          b.x = Math.min(this.cols - b.r, Math.max(b.r, p.x));
          b.y = Math.min(this.rows - b.r, Math.max(b.r, p.y));
        }
        break;
      }
    }
  }

  private pickBall(team: Team, at?: { x: number; y: number }): SimBall | null {
    let best: SimBall | null = null;
    let bestD = Infinity;
    for (const b of this.balls) {
      if (b.team !== team) continue;
      const d = at ? Math.hypot(b.x - at.x, b.y - at.y) : b.life === Infinity ? 0 : 1;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private randomHostile(team: Team): { x: number; y: number } | null {
    const enemy = 1 - team;
    for (let tries = 0; tries < 40; tries++) {
      const cx = Math.floor(this.rng() * this.cols);
      const cy = Math.floor(this.rng() * this.rows);
      if (this.owner[cy * this.cols + cx] === enemy) return { x: cx + 0.5, y: cy + 0.5 };
    }
    return null;
  }

  /** Spend energy on a card. Returns true when it was cast. */
  cast(team: Team, slot: number, at?: { x: number; y: number }): boolean {
    const kind = this.cards[team][slot];
    if (!kind || this.ended) return false;
    const cost = this.cardCost(kind);
    if (this.energy[team] < cost) return false;
    this.energy[team] -= cost;
    this.stats[team].casts++;
    this.cards[team][slot] = this.drawCard();
    this.applyGift(team, kind, null, "card", at);
    return true;
  }

  /* ------------------------------------------------ black holes, colonies */

  private updateHoles(dt: number): void {
    for (const h of this.holes) {
      h.life -= dt;
      h.acc += dt;
      if (h.acc >= 0.1) {
        h.acc = 0;
        let flips = 0;
        for (let tries = 0; tries < 12 && flips < 2; tries++) {
          const a = this.rng() * TAU;
          const d = Math.sqrt(this.rng()) * 3.4;
          const cx = Math.floor(h.x + Math.cos(a) * d);
          const cy = Math.floor(h.y + Math.sin(a) * d);
          if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) continue;
          const idx = cy * this.cols + cx;
          if (this.owner[idx] === 1 - h.team) {
            this.flip(idx, h.team);
            flips++;
          }
        }
      }
      for (const b of this.balls) {
        if (b.team === h.team) continue;
        const d = Math.hypot(h.x - b.x, h.y - b.y);
        if (d < 6 && d > 0.5) b.a += wrap(Math.atan2(h.y - b.y, h.x - b.x) - b.a) * Math.min(1, dt * 2.2);
      }
    }
    this.holes = this.holes.filter((h) => h.life > 0);
  }

  private updateColonies(dt: number): void {
    for (const c of this.colonies) {
      c.life -= dt;
      c.acc += dt;
      if (c.acc < 0.32) continue;
      c.acc = 0;
      for (let tries = 0; tries < 8; tries++) {
        const from = c.cells[Math.floor(this.rng() * c.cells.length)];
        const fx = from % this.cols;
        const fy = Math.floor(from / this.cols);
        const dir = Math.floor(this.rng() * 4);
        const nx = fx + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
        const ny = fy + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const idx = ny * this.cols + nx;
        if (this.owner[idx] === 1 - c.team) {
          this.flip(idx, c.team);
          c.cells.push(idx);
          break;
        }
      }
    }
    this.colonies = this.colonies.filter((c) => c.life > 0);
  }

  /** Drains queued events for the renderer and audio. */
  drain(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
