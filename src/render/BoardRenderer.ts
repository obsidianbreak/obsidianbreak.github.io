import type { GiftKind, SimBall, Well } from "../duel/types";
import { WALL } from "../duel/types";
import type { Sim } from "../duel/Sim";

export const COLORS = {
  cream: "#f6eacc",
  brown: "#52290e",
  wall: "#a89472",
  wallDark: "#7d6b4d",
  gold: "#e3b95f",
  ink: "#1b0f07",
  coral: "#d9654f",
};

export interface BannerLine {
  label: string;
  team: 0 | 1;
  at: number;
}

export interface ViewState {
  time: number;
  banner: BannerLine[];
  flipAnim: Float32Array;
  well: Well | null;
  quality: 0 | 1 | 2;
}

function glyph(ctx: CanvasRenderingContext2D, kind: GiftKind, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = COLORS.cream;
  ctx.strokeStyle = COLORS.cream;
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const r = s * 0.3;
  switch (kind) {
    case "ghost":
    case "eclipse":
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r, Math.PI, 0);
      ctx.lineTo(r, r * 0.9);
      ctx.lineTo(r * 0.5, r * 0.5);
      ctx.lineTo(0, r * 0.9);
      ctx.lineTo(-r * 0.5, r * 0.5);
      ctx.lineTo(-r, r * 0.9);
      ctx.closePath();
      kind === "eclipse" ? ctx.stroke() : ctx.fill();
      break;
    case "nitro":
      ctx.beginPath();
      ctx.moveTo(r * 0.2, -r * 1.1);
      ctx.lineTo(-r * 0.7, r * 0.2);
      ctx.lineTo(0, r * 0.2);
      ctx.lineTo(-r * 0.2, r * 1.1);
      ctx.lineTo(r * 0.7, -r * 0.2);
      ctx.lineTo(0, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    case "blackhole":
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "colossus":
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "trinity":
      for (const [x, y] of [[0, -r * 0.7], [-r * 0.8, r * 0.6], [r * 0.8, r * 0.6]]) {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "wrecking":
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        ctx.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25);
        ctx.stroke();
      }
      break;
    case "infiltrator":
      for (const [x, y] of [[-r * 0.6, -r * 0.6], [r * 0.1, -r * 0.6], [-r * 0.6, r * 0.1], [r * 0.1, r * 0.1], [r * 0.7, r * 0.7]]) ctx.fillRect(x, y, r * 0.55, r * 0.55);
      break;
    case "wormhole":
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = i * 0.45;
        const rr = (i / 40) * r * 1.2;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Flat, crisp tiles in two colours, like the reference. Everything else is a light accent. */
export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  cell = 16;
  private dpr = 1;
  private trails = new Map<number, Array<{ x: number; y: number }>>();

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
  }

  fit(cols: number, rows: number, maxW: number, maxH: number, dpr: number): void {
    this.dpr = dpr;
    this.cell = Math.max(8, Math.floor(Math.min(maxW / cols, maxH / rows)));
    const c = this.ctx.canvas;
    c.width = cols * this.cell * dpr;
    c.height = rows * this.cell * dpr;
    c.style.width = `${cols * this.cell}px`;
    c.style.height = `${rows * this.cell}px`;
  }

  render(sim: Sim, v: ViewState): void {
    const ctx = this.ctx;
    const s = this.cell;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const { cols, rows, owner } = sim;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const o = owner[i];
        if (o === WALL) {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x * s, y * s, s, s);
          ctx.fillStyle = COLORS.wallDark;
          ctx.fillRect(x * s + s * 0.18, y * s + s * 0.18, s * 0.64, s * 0.64);
          continue;
        }
        ctx.fillStyle = o === 0 ? COLORS.cream : COLORS.brown;
        ctx.fillRect(x * s, y * s, s, s);
        const a = v.flipAnim[i];
        if (a > 0.02) {
          ctx.fillStyle = o === 0 ? `rgba(255,255,255,${a * 0.7})` : `rgba(227,185,95,${a * 0.55})`;
          ctx.fillRect(x * s, y * s, s, s);
        }
      }
    }

    for (const h of sim.holes) {
      const g = ctx.createRadialGradient(h.x * s, h.y * s, 0, h.x * s, h.y * s, 3.4 * s);
      g.addColorStop(0, "#120a04");
      g.addColorStop(0.55, "rgba(18,10,4,0.85)");
      g.addColorStop(1, "rgba(18,10,4,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(h.x * s, h.y * s, 3.4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(h.x * s, h.y * s, (0.9 + Math.sin(v.time * 6) * 0.12) * s, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const g of sim.gifts) {
      const pulse = 1 + Math.sin(v.time * 5 + g.id) * 0.04;
      const blink = g.ttl < 3 && Math.floor(v.time * 6) % 2 === 0;
      if (blink) continue;
      const px = g.cx * s + s / 2;
      const py = g.cy * s + s / 2;
      ctx.fillStyle = COLORS.coral;
      ctx.fillRect(px - (s / 2) * pulse, py - (s / 2) * pulse, s * pulse, s * pulse);
      glyph(ctx, g.kind, px, py, s);
    }

    if (v.well) {
      const wx = v.well.x * s;
      const wy = v.well.y * s;
      ctx.strokeStyle = "rgba(27,15,7,0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(wx, wy, 0.9 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(wx, wy, 2.2 * s * (1 + Math.sin(v.time * 6) * 0.06), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(27,15,7,0.16)";
      ctx.stroke();
    }

    for (const b of sim.balls) this.drawBall(b, v);
    this.drawBanner(sim.cols * s, v);
  }

  /**
   * Gift announcements are drawn inside the canvas. Canvas text is
   * rasterized at device resolution, so it stays sharp on iPhone, and it
   * is centered on the board exactly.
   */
  private drawBanner(boardW: number, v: ViewState): void {
    const ctx = this.ctx;
    const rowH = Math.max(22, Math.round(this.cell * 1.3));
    const font = Math.round(rowH * 0.46);
    const margin = 8;
    const w = Math.round(boardW - margin * 2);
    let y = margin;
    ctx.save();
    ctx.font = `800 ${font}px Inter, "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0.6px";
    for (const item of v.banner.slice(0, 3)) {
      const age = v.time - item.at;
      if (age < 0 || age > 5) continue;
      const alpha = Math.min(1, age / 0.25) * Math.min(1, (5 - age) / 0.8);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = item.team === 0 ? COLORS.cream : COLORS.brown;
      ctx.fillRect(margin, y, w, rowH);
      if (item.team === 1) {
        ctx.strokeStyle = "rgba(246,234,204,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(margin + 0.5, y + 0.5, w - 1, rowH - 1);
      }
      ctx.fillStyle = item.team === 0 ? COLORS.ink : COLORS.gold;
      ctx.fillText(item.label, Math.round(boardW / 2), Math.round(y + rowH / 2) + 1);
      y += rowH + 3;
    }
    ctx.restore();
  }

  private drawBall(b: SimBall, v: ViewState): void {
    const ctx = this.ctx;
    const s = this.cell;
    const fill = b.team === 0 ? COLORS.ink : COLORS.gold;
    if (v.quality > 0) {
      let tr = this.trails.get(b.id);
      if (!tr) {
        tr = [];
        this.trails.set(b.id, tr);
      }
      tr.unshift({ x: b.x, y: b.y });
      if (tr.length > (b.nitro > 0 ? 14 : 6)) tr.pop();
      for (let i = tr.length - 1; i > 0; i--) {
        ctx.globalAlpha = (1 - i / tr.length) * (b.nitro > 0 ? 0.45 : 0.2);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(tr[i].x * s, tr[i].y * s, b.r * s * (1 - i / (tr.length * 1.4)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = b.ghost > 0 ? 0.6 : b.life !== Infinity ? 0.85 : 1;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(b.x * s, b.y * s, b.r * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (b.ghost > 0 || b.wrecking || b.colossus > 0) {
      ctx.strokeStyle = b.team === 0 ? "rgba(27,15,7,0.55)" : "rgba(227,185,95,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x * s, b.y * s, b.r * s + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  forget(): void {
    this.trails.clear();
  }

  /** Marks changed cells for the short flash animation. */
  decay(anim: Float32Array, dt: number): void {
    for (let i = 0; i < anim.length; i++) if (anim[i] > 0) anim[i] = Math.max(0, anim[i] - dt * 4);
  }
}
