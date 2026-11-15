import { calibrate } from "../duel/Calibrator";
import { planMatch } from "../duel/Generator";
import type { MatchKind, MatchSpec, RuleOverrides } from "../duel/Generator";
import { toRating, tierOf } from "../duel/Rating";
import type { MutatorId } from "../duel/types";
import { hashString } from "../lib/rng";
import { boardAspect } from "../lib/viewport";
import { todayKey } from "../lib/rng";
import type { SaveData } from "../lib/save";
import { Bandit } from "./Bandit";
import { readContext } from "./Context";
import type { DeviceContext } from "./Context";
import { nextTarget } from "./Flow";
import { DEFAULT_RULES, evaluate, loadRules } from "./RulesEngine";
import type { Facts, RuleSet } from "./RulesEngine";
import { Telemetry } from "./Telemetry";

export interface Plan {
  spec: MatchSpec;
  tags: string[];
  arms: Record<string, string>;
  exposures: Array<{ exp: string; segment: string; arm: string }>;
}

const HARD: MutatorId[] = ["stone", "foam", "marathon", "twin"];

/**
 * The conductor. For every match it reads the facts, runs the rules,
 * lets the bandit pick experiment arms, asks the dynamic level
 * generator for a board, and calibrates the opponent by simulation.
 */
export class Director {
  rules: RuleSet = DEFAULT_RULES;
  readonly bandit = new Bandit();
  readonly telemetry = new Telemetry();
  context: DeviceContext = { reducedMotion: false, saveData: false, lowPower: false, coarsePointer: true, hour: 12 };
  private sessionStart = Date.now();

  async init(baseUrl: string): Promise<void> {
    const [rules, ctx] = await Promise.all([loadRules(baseUrl), readContext()]);
    this.rules = rules;
    this.context = ctx;
  }

  sessionMinutes(): number {
    return Math.floor((Date.now() - this.sessionStart) / 60000);
  }

  facts(save: SaveData): Facts {
    const rating = toRating(save.skill);
    return {
      matchesPlayed: save.matches,
      winStreak: save.winStreak,
      lossStreak: save.lossStreak,
      rating,
      tier: tierOf(rating).name,
      lowPower: this.context.lowPower,
      saveData: this.context.saveData,
      input: this.context.coarsePointer ? "touch" : "mouse",
      sessionMinutes: this.sessionMinutes(),
      hour: this.context.hour,
    };
  }

  isBossNext(save: SaveData): boolean {
    return (save.matches + 1) % 5 === 0;
  }

  async plan(save: SaveData, kind: MatchKind): Promise<Plan> {
    const facts = this.facts(save);
    const pre = evaluate(this.rules, "pre", facts);
    const arms: Record<string, string> = {};
    const exposures: Plan["exposures"] = [];
    const overrides: RuleOverrides = {};

    if (kind !== "daily") {
      overrides.aspect = boardAspect();
      const segment = `${facts.tier}:${facts.input}`;
      for (const exp of this.rules.experiments) {
        const pick = this.bandit.choose(exp, segment);
        arms[exp.id] = pick.arm;
        exposures.push({ exp: exp.id, segment, arm: pick.arm });
        const v = Number(pick.value);
        if (exp.param === "winShare") overrides.winShare = v;
        if (exp.param === "giftEverySec") overrides.giftEverySec = v;
        if (exp.param === "cardCostScale") overrides.cardCostScale = v;
      }
      if (save.settings.adaptive) overrides.playerTurnBonus = Number(pre.params.playerTurnBonus ?? 0);
      if (pre.params.disableHardMutators) overrides.disabledMutators = HARD;
    }

    let seed: number;
    if (kind === "daily") seed = hashString(`daily:${todayKey()}`);
    else seed = (save.seedCounter + save.matches * 7919) >>> 0;

    const target = kind === "daily" ? 0.5 : save.settings.adaptive ? nextTarget(save.flow, { matchesPlayed: save.matches, winStreak: save.winStreak, lossStreak: save.lossStreak, kind }) : 0.55;

    const spec = planMatch({ seed, kind, matchesPlayed: kind === "daily" ? 10 : save.matches, playerSkill: save.skill, targetWin: target, rules: overrides });
    if (kind === "daily") {
      spec.oppSkill = 0.55;
      spec.predictedWin = 0.5;
      spec.name = `Daily Roast: ${spec.name}`;
    } else {
      const c = await calibrate(spec.cfg, spec.persona, save.skill, target);
      spec.oppSkill = c.oppSkill;
      spec.predictedWin = c.predictedWin;
    }
    this.telemetry.track("plan", { kind, persona: spec.persona, target: Math.round(target * 100), mutators: spec.mutators.join("+"), ...arms });
    return { spec, tags: pre.tags, arms, exposures };
  }

  noteMatchStart(plan: Plan): void {
    this.bandit.settle();
    this.bandit.expose(plan.exposures);
    this.telemetry.track("match_start", { kind: plan.spec.kind, persona: plan.spec.persona, ...plan.arms });
  }

  noteMatchEnd(spec: MatchSpec, won: boolean, margin: number): void {
    this.bandit.markEnded();
    this.telemetry.track("match_end", { kind: spec.kind, won, margin: Math.round(margin * 1000) / 10, predicted: Math.round(spec.predictedWin * 100) });
  }
}
