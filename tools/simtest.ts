// Run with: npx tsx tools/simtest.ts
// Headless sanity check: balance, speed and calibration of the duel simulation.
import { buildConfig } from "../src/duel/Generator";
import { playtest, winProbability, calibrate } from "../src/duel/Calibrator";

const cfg = buildConfig(7, []);
const t0 = performance.now();
const even = winProbability(cfg, 0.5, 0.5 / 0.8, "pour", 24);
console.log("even skill win prob", even.toFixed(2), "in", Math.round(performance.now() - t0), "ms");
for (const s of [0.1, 0.3, 0.5, 0.7, 0.9]) {
  console.log("opp skill", s, "win prob", winProbability(cfg, 0.5, s, "pour", 16).toFixed(2));
}
const t1 = performance.now();
const r = await calibrate(cfg, "pour", 0.5, 0.6);
console.log("calibrated", r, Math.round(performance.now() - t1), "ms");
const one = playtest(cfg, 0.5, 0.5, "pour", 0);
console.log("one match", one);
