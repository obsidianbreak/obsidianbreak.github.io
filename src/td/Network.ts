import { FEEDBACK_FS, LEVEL_FS, VERT, VORONOI_FS } from "./shaders";
import { foamBus } from "./Signals";
import { Signals } from "./Signals";

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
}

const SCALES = [0.22, 0.32, 0.45];

/**
 * A tiny TouchDesigner style operator network running on WebGL2:
 *
 *   Voronoi TOP  ->  Feedback TOP (ping pong)  ->  Level TOP  ->  screen
 *        ^                                              ^
 *   Touch and ball points                      Mode and share channels
 *
 * Each box is one shader pass writing into a texture, and the CHOP
 * style `Signals` drive their parameters with smoothing.
 * TouchDesigner itself cannot run inside a static web page, so this
 * rebuilds the same network pattern in GLSL.
 */
export class FoamNetwork {
  static supported(): boolean {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  }

  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private progVoronoi: WebGLProgram;
  private progFeedback: WebGLProgram;
  private progLevel: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private cur: Target | null = null;
  private fb: [Target, Target] | null = null;
  private w = 0;
  private h = 0;
  private flip = 0;
  private lastQuality = -1;
  readonly signals = new Signals();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.progVoronoi = this.program(VORONOI_FS);
    this.progFeedback = this.program(FEEDBACK_FS);
    this.progLevel = this.program(LEVEL_FS);
    this.vao = gl.createVertexArray();
    this.signals.define("tension", 0, 0.8);
    this.signals.define("mode", 0, 0.6);
    this.signals.define("share", 0.5, 1.2);
    this.signals.define("ink", 1, 0.8);
  }

  private program(fs: string): WebGLProgram {
    const gl = this.gl;
    const build = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, build(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, build(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link error");
    return p;
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex: tex!, fbo: fbo! };
  }

  private freeTarget(t: Target | null): void {
    if (!t) return;
    this.gl.deleteTexture(t.tex);
    this.gl.deleteFramebuffer(t.fbo);
  }

  resize(): void {
    const q = foamBus.quality;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    const w = Math.max(64, Math.round(cw * dpr * SCALES[q]));
    const h = Math.max(64, Math.round(ch * dpr * SCALES[q]));
    if (w === this.w && h === this.h && q === this.lastQuality) return;
    this.lastQuality = q;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.freeTarget(this.cur);
    if (this.fb) {
      this.freeTarget(this.fb[0]);
      this.freeTarget(this.fb[1]);
    }
    this.cur = this.target(w, h);
    this.fb = [this.target(w, h), this.target(w, h)];
  }

  private bind(prog: WebGLProgram, fbo: WebGLFramebuffer | null): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(prog);
  }

  private tex(prog: WebGLProgram, name: string, unit: number, t: WebGLTexture): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  render(dt: number): void {
    this.resize();
    if (!this.cur || !this.fb) return;
    const gl = this.gl;
    const t = foamBus.time;
    const sig = this.signals;
    sig.set("tension", foamBus.tension);
    sig.set("mode", foamBus.mode === "night" ? 1 : 0);
    sig.set("share", foamBus.share);
    sig.set("ink", foamBus.intensity);
    sig.step(dt);

    const pts = foamBus.points.slice(0, 8);
    const rips = foamBus.ripples
      .map((r) => ({ x: r.x, y: r.y, age: (t - r.born) / 1.4 }))
      .filter((r) => r.age >= 0 && r.age < 1)
      .slice(0, 8);

    gl.bindVertexArray(this.vao);

    this.bind(this.progVoronoi, this.cur.fbo);
    gl.uniform2f(gl.getUniformLocation(this.progVoronoi, "uRes"), this.w, this.h);
    gl.uniform1f(gl.getUniformLocation(this.progVoronoi, "uTime"), t);
    gl.uniform1f(gl.getUniformLocation(this.progVoronoi, "uScale"), 5.5 + sig.get("tension") * 2.5);
    gl.uniform1f(gl.getUniformLocation(this.progVoronoi, "uSpeed"), 0.25 + sig.get("tension") * 0.9);
    const flat = new Float32Array(8 * 3);
    pts.forEach((p, i) => {
      flat[i * 3] = p.x;
      flat[i * 3 + 1] = p.y;
      flat[i * 3 + 2] = p.w;
    });
    gl.uniform3fv(gl.getUniformLocation(this.progVoronoi, "uPts"), flat);
    gl.uniform1i(gl.getUniformLocation(this.progVoronoi, "uPtsN"), pts.length);
    const rflat = new Float32Array(8 * 3);
    rips.forEach((r, i) => {
      rflat[i * 3] = r.x;
      rflat[i * 3 + 1] = r.y;
      rflat[i * 3 + 2] = r.age;
    });
    gl.uniform3fv(gl.getUniformLocation(this.progVoronoi, "uRip"), rflat);
    gl.uniform1i(gl.getUniformLocation(this.progVoronoi, "uRipN"), rips.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const prev = this.fb[this.flip];
    const next = this.fb[1 - this.flip];
    this.bind(this.progFeedback, next.fbo);
    gl.uniform2f(gl.getUniformLocation(this.progFeedback, "uRes"), this.w, this.h);
    gl.uniform1f(gl.getUniformLocation(this.progFeedback, "uDecay"), 0.9);
    this.tex(this.progFeedback, "uCur", 0, this.cur.tex);
    this.tex(this.progFeedback, "uPrev", 1, prev.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.flip = 1 - this.flip;

    this.bind(this.progLevel, null);
    gl.uniform2f(gl.getUniformLocation(this.progLevel, "uRes"), this.w, this.h);
    gl.uniform1f(gl.getUniformLocation(this.progLevel, "uMode"), sig.get("mode"));
    gl.uniform1f(gl.getUniformLocation(this.progLevel, "uShare"), sig.get("share"));
    gl.uniform1f(gl.getUniformLocation(this.progLevel, "uTime"), t);
    gl.uniform1f(gl.getUniformLocation(this.progLevel, "uInk"), sig.get("ink"));
    this.tex(this.progLevel, "uTex", 0, next.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.freeTarget(this.cur);
    if (this.fb) {
      this.freeTarget(this.fb[0]);
      this.freeTarget(this.fb[1]);
    }
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
