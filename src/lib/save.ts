import { freshFlow } from "../director/Flow";
import type { FlowState } from "../director/Flow";
import { generateGoals } from "../director/Goals";
import type { Goal } from "../director/Goals";
import { todayKey, yesterdayKey } from "./rng";

const KEY = "obsidian-break:save:v3";

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Lets the game lend small help after losses and take it back after wins. */
  adaptive: boolean;
  theme: "day" | "night";
  /** Opt in, anonymous. Only sends when the build has a collector URL. */
  telemetry: boolean;
}

export interface DailyRecord {
  streak: number;
  bestStreak: number;
  lastDate: string;
  lastMargin: number;
  lastGrid: string;
}

export interface SaveData {
  skill: number;
  matches: number;
  wins: number;
  losses: number;
  winStreak: number;
  lossStreak: number;
  bestStreak: number;
  /** A shield absorbs one loss so it does not end a win streak. Earned at 5 wins in a row. */
  shield: number;
  flow: FlowState;
  daily: DailyRecord;
  goals: { date: string; list: Goal[] };
  settings: Settings;
  stats: { flips: number; gifts: number; bestMargin: number };
  seedCounter: number;
}

function fresh(): SaveData {
  return {
    skill: 0.3,
    matches: 0,
    wins: 0,
    losses: 0,
    winStreak: 0,
    lossStreak: 0,
    bestStreak: 0,
    shield: 0,
    flow: freshFlow(),
    daily: { streak: 0, bestStreak: 0, lastDate: "", lastMargin: 0, lastGrid: "" },
    goals: { date: "", list: [] },
    settings: { sound: true, haptics: true, adaptive: true, theme: "day", telemetry: false },
    stats: { flips: 0, gifts: 0, bestMargin: 0 },
    seedCounter: Math.floor(Math.random() * 1e6),
  };
}

export function loadSave(): SaveData {
  const base = fresh();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      const merged: SaveData = {
        ...base,
        ...p,
        flow: { ...base.flow, ...(p.flow ?? {}) },
        daily: { ...base.daily, ...(p.daily ?? {}) },
        settings: { ...base.settings, ...(p.settings ?? {}) },
        stats: { ...base.stats, ...(p.stats ?? {}) },
        goals: p.goals ?? base.goals,
      };
      return ensureGoals(merged);
    }
  } catch {
    // Corrupt or blocked storage. Start fresh.
  }
  return ensureGoals(base);
}

export function ensureGoals(save: SaveData): SaveData {
  const today = todayKey();
  if (save.goals.date === today && save.goals.list.length > 0) return save;
  return { ...save, goals: { date: today, list: generateGoals(today) } };
}

export function writeSave(save: SaveData): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode or quota. Progress will not persist.
  }
}

export function liveDailyStreak(save: SaveData): number {
  const { lastDate, streak } = save.daily;
  return lastDate === todayKey() || lastDate === yesterdayKey() ? streak : 0;
}

export function dailyDoneToday(save: SaveData): boolean {
  return save.daily.lastDate === todayKey();
}

export function applyDailyResult(save: SaveData, margin: number, grid: string): SaveData {
  const d = { ...save.daily };
  if (d.lastDate !== todayKey()) {
    d.streak = d.lastDate === yesterdayKey() ? d.streak + 1 : 1;
    d.bestStreak = Math.max(d.bestStreak, d.streak);
    d.lastMargin = margin;
    d.lastGrid = grid;
  } else if (margin > d.lastMargin) {
    d.lastMargin = margin;
    d.lastGrid = grid;
  }
  d.lastDate = todayKey();
  return { ...save, daily: d };
}
