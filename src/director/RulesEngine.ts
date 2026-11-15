/**
 * A small JSON rules engine. Rules are data, not code, so they can be
 * edited in public/rules/rules.json and re-deployed without touching
 * the game. They see "facts" about the player and the match and
 * answer with parameter overrides.
 */
export type Primitive = number | string | boolean;
export type Op = "<" | ">" | "<=" | ">=" | "==" | "!=" | "in";

export type Cond =
  | { fact: string; op: Op; value: Primitive | Primitive[] }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond };

export type Action = { set: string; value: Primitive } | { add: string; value: number } | { mul: string; value: number } | { tag: string };

export interface Rule {
  id: string;
  /** "pre" rules run before a match, "live" rules run once a second during it. */
  phase: "pre" | "live";
  when: Cond;
  then: Action[];
}

export interface Experiment {
  id: string;
  param: string;
  arms: Array<{ id: string; value: Primitive }>;
}

export interface RuleSet {
  version: number;
  rules: Rule[];
  experiments: Experiment[];
}

export type Facts = Record<string, Primitive>;

export interface Evaluation {
  params: Record<string, Primitive>;
  tags: string[];
  fired: string[];
}

function test(c: Cond, facts: Facts): boolean {
  if ("all" in c) return c.all.every((x) => test(x, facts));
  if ("any" in c) return c.any.some((x) => test(x, facts));
  if ("not" in c) return !test(c.not, facts);
  const f = facts[c.fact];
  if (f === undefined) return false;
  const v = c.value;
  switch (c.op) {
    case "<":
      return typeof f === "number" && typeof v === "number" && f < v;
    case ">":
      return typeof f === "number" && typeof v === "number" && f > v;
    case "<=":
      return typeof f === "number" && typeof v === "number" && f <= v;
    case ">=":
      return typeof f === "number" && typeof v === "number" && f >= v;
    case "==":
      return f === v;
    case "!=":
      return f !== v;
    case "in":
      return Array.isArray(v) && v.includes(f);
  }
}

export function evaluate(set: RuleSet, phase: Rule["phase"], facts: Facts, base: Record<string, Primitive> = {}): Evaluation {
  const params: Record<string, Primitive> = { ...base };
  const tags: string[] = [];
  const fired: string[] = [];
  for (const rule of set.rules) {
    if (rule.phase !== phase || !test(rule.when, facts)) continue;
    fired.push(rule.id);
    for (const a of rule.then) {
      if ("set" in a) params[a.set] = a.value;
      else if ("add" in a) params[a.add] = (typeof params[a.add] === "number" ? (params[a.add] as number) : 0) + a.value;
      else if ("mul" in a) params[a.mul] = (typeof params[a.mul] === "number" ? (params[a.mul] as number) : 1) * a.value;
      else tags.push(a.tag);
    }
  }
  return { params, tags, fired };
}

/** Embedded copy so the game works offline and before the JSON loads. */
export const DEFAULT_RULES: RuleSet = {
  version: 1,
  experiments: [
    { id: "win_share", param: "winShare", arms: [{ id: "w70", value: 0.7 }, { id: "w85", value: 0.85 }] },
    { id: "gift_cadence", param: "giftEverySec", arms: [{ id: "g5", value: 5 }, { id: "g7", value: 7 }, { id: "g10", value: 10 }] },
    { id: "card_cost", param: "cardCostScale", arms: [{ id: "c8", value: 0.8 }, { id: "c10", value: 1 }, { id: "c12", value: 1.2 }] },
  ],
  rules: [
    { id: "newcomer-no-stone", phase: "pre", when: { fact: "matchesPlayed", op: "<", value: 3 }, then: [{ set: "disableHardMutators", value: true }] },
    { id: "gentle-after-losses", phase: "pre", when: { fact: "lossStreak", op: ">=", value: 2 }, then: [{ add: "playerTurnBonus", value: 0.4 }, { tag: "assist" }] },
    { id: "low-power-lite", phase: "pre", when: { fact: "lowPower", op: "==", value: true }, then: [{ set: "lite", value: true }] },
    { id: "catch-up", phase: "live", when: { all: [{ fact: "deficit", op: ">", value: 0.08 }, { fact: "timeFrac", op: ">", value: 0.35 }] }, then: [{ mul: "playerTurnMul", value: 1.15 }, { mul: "aiReactionMul", value: 1.2 }] },
    { id: "big-deficit", phase: "live", when: { all: [{ fact: "deficit", op: ">", value: 0.25 }, { fact: "timeFrac", op: ">", value: 0.25 }] }, then: [{ mul: "playerTurnMul", value: 1.25 }, { mul: "aiTurnMul", value: 0.85 }, { mul: "aiReactionMul", value: 1.35 }] },
    { id: "lead-pressure", phase: "live", when: { all: [{ fact: "deficit", op: "<", value: -0.12 }, { fact: "timeFrac", op: ">", value: 0.35 }] }, then: [{ mul: "aiTurnMul", value: 1.12 }] },
    { id: "long-session-note", phase: "pre", when: { fact: "sessionMinutes", op: ">=", value: 45 }, then: [{ tag: "break-note" }] },
  ],
};

export async function loadRules(baseUrl: string): Promise<RuleSet> {
  try {
    const res = await fetch(`${baseUrl}rules/rules.json?v=${Date.now() % 100000}`, { cache: "no-cache" });
    if (!res.ok) return DEFAULT_RULES;
    const json = (await res.json()) as RuleSet;
    if (!json || !Array.isArray(json.rules) || !Array.isArray(json.experiments)) return DEFAULT_RULES;
    return json;
  } catch {
    return DEFAULT_RULES;
  }
}
