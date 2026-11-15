export const VERT = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Voronoi TOP: animated cellular noise whose seeds are pulled toward touches and balls. */
export const VORONOI_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform float uSpeed;
uniform vec3 uPts[8];
uniform int uPtsN;
uniform vec3 uRip[8];
uniform int uRipN;
out vec4 o;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * uScale;
  vec2 ip = floor(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = hash2(ip + g);
      vec2 seed = ip + g + 0.5 + 0.42 * sin(uTime * uSpeed + 6.2831 * h);
      for (int k = 0; k < 8; k++) {
        if (k >= uPtsN) break;
        vec2 a = vec2(uPts[k].x * aspect, uPts[k].y) * uScale;
        float d = distance(seed, a);
        float pull = smoothstep(3.2, 0.0, d) * uPts[k].z;
        seed += (a - seed) * pull * 0.42;
      }
      float d = distance(seed, p);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) { f2 = d; }
    }
  }
  float edge = f2 - f1;
  float line = smoothstep(0.032, 0.0, edge);
  float rip = 0.0;
  for (int r = 0; r < 8; r++) {
    if (r >= uRipN) break;
    vec2 c = vec2(uRip[r].x * aspect, uRip[r].y);
    float age = uRip[r].z;
    float ring = abs(distance(vec2(uv.x * aspect, uv.y), c) - age * 0.55);
    rip += smoothstep(0.02, 0.0, ring) * (1.0 - age);
  }
  o = vec4(line, f1 * 0.5, clamp(rip, 0.0, 1.0), 1.0);
}`;

/** Feedback TOP: ink trails that drift outward and fade, like a feedback loop in a node network. */
export const FEEDBACK_FS = `#version 300 es
precision highp float;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform float uDecay;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 cur = texture(uCur, vec2(uv.x, 1.0 - uv.y));
  vec2 drift = (uv - 0.5) * 0.0022;
  vec4 prev = texture(uPrev, uv - drift);
  float line = max(cur.r, prev.r * uDecay);
  float rip = max(cur.b, prev.b * (uDecay - 0.02));
  o = vec4(line, cur.g, rip, 1.0);
}`;

/** Level TOP: maps the mask to paper and ink, adds grain and a soft vignette. */
export const LEVEL_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uMode;
uniform float uShare;
uniform float uTime;
uniform float uInk;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 t = texture(uTex, uv);
  vec3 paperDay = mix(vec3(0.96, 0.93, 0.85), vec3(0.94, 0.88, 0.76), 1.0 - uShare);
  vec3 inkDay = vec3(0.24, 0.16, 0.10);
  vec3 paperNight = vec3(0.102, 0.043, 0.012);
  vec3 inkNight = vec3(0.85, 0.65, 0.40);
  vec3 paper = mix(paperDay, paperNight, uMode);
  vec3 ink = mix(inkDay, inkNight, uMode);
  float m = clamp(t.r * 0.9 + t.b * 0.55, 0.0, 1.0) * uInk * mix(1.0, 0.5, uMode);
  vec3 c = mix(paper, ink, m);
  c -= (1.0 - uMode) * 0.025 * t.g;
  float glow = smoothstep(0.9, 0.0, distance(uv, vec2(0.5, 0.78)));
  c += uMode * vec3(0.17, 0.09, 0.035) * glow;
  c += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.03;
  float v = smoothstep(1.15, 0.35, length(uv - 0.5) * 1.6);
  c *= mix(0.84, 1.0, v);
  o = vec4(c, 1.0);
}`;
