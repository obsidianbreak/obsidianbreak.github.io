import type { MatchKind, MatchSpec } from "../duel/Generator";
import { toRating, tierOf, updateSkill } from "../duel/Rating";
import type { MatchEnd } from "../game/DuelEngine";
import { applyDailyResult } from "../lib/save";
import type { SaveData } from "../lib/save";
import { applyMatch } from "./Goals";
import { recordOutcome } from "./Flow";

export interface Outcome {
  save: SaveData;
  ratingBefore: number;
  ratingAfter: number;
  tierBefore: string;
  tierAfter: string;
  shieldUsed: boolean;
  shieldEarned: boolean;
  goalsDone: string[];
}

/** Turns a text emoji grid of the final board for sharing. */
export function emojiGrid(cells: number[], cols: number, rows: number, outCols = 8, outRows = 10): string {
  const lines: string[] = [];
  for (let gy = 0; gy < outRows; gy++) {
    let line = "";
    for (let gx = 0; gx < outCols; gx++) {
      const x0 = Math.floor((gx / outCols) * cols);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) / outCols) * cols));
      const y0 = Math.floor((gy / outRows) * rows);
      const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) / outRows) * rows));
      const tally = [0, 0, 0];
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) tally[cells[y * cols + x]]++;
      line += tally[2] > tally[0] + tally[1] ? "\u2b1b" : tally[0] >= tally[1] ? "\u2b1c" : "\ud83d\udfeb";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export function finishMatch(save: SaveData, spec: MatchSpec, end: MatchEnd, kind: MatchKind): Outcome {
  const won = end.winner === 0;
  const draw = end.winner === -1;
  const ratingBefore = toRating(save.skill);
  let next: SaveData = { ...save };
  let shieldUsed = false;
  let shieldEarned = false;

  const countsForSkill = kind !== "daily";
  if (countsForSkill) {
    next.skill = updateSkill(save.skill, spec.oppSkill, end.margin, save.matches);
    next.matches = save.matches + 1;
    next.flow = recordOutcome(save.flow, won ? 1 : draw ? 0.5 : 0);
    if (won) {
      next.wins = save.wins + 1;
      next.winStreak = save.winStreak + 1;
      next.lossStreak = 0;
      next.bestStreak = Math.max(save.bestStreak, next.winStreak);
      if (next.winStreak % 5 === 0 && next.shield === 0) {
        next.shield = 1;
        shieldEarned = true;
      }
    } else if (!draw) {
      next.losses = save.losses + 1;
      next.lossStreak = save.lossStreak + 1;
      if (save.shield > 0 && save.winStreak > 0) {
        next.shield = 0;
        shieldUsed = true;
      } else {
        next.winStreak = 0;
      }
    }
  } else {
    next = applyDailyResult(next, end.margin, emojiGrid(end.cells, end.cols, end.rows));
  }

  next.stats = {
    flips: save.stats.flips + end.flips,
    gifts: save.stats.gifts + end.gifts,
    bestMargin: Math.max(save.stats.bestMargin, won ? end.margin : 0),
  };

  const before = next.goals.list;
  const after = applyMatch(before, { won, flips: end.flips, gifts: end.gifts, casts: end.casts });
  next.goals = { ...next.goals, list: after };
  const goalsDone = after.filter((g, i) => g.progress >= g.target && before[i].progress < before[i].target).map((g) => g.label);

  const ratingAfter = toRating(next.skill);
  return {
    save: next,
    ratingBefore,
    ratingAfter,
    tierBefore: tierOf(ratingBefore).name,
    tierAfter: tierOf(ratingAfter).name,
    shieldUsed,
    shieldEarned,
    goalsDone,
  };
}
