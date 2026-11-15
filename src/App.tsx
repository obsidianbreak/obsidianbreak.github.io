import { useCallback, useEffect, useRef, useState } from "react";
import FoamBackground from "./components/FoamBackground";
import { foamBus } from "./td/Signals";
import Hub from "./screens/Hub";
import Match from "./screens/Match";
import { Director } from "./director/Director";
import type { Plan } from "./director/Director";
import { finishMatch } from "./director/Progress";
import type { MatchKind } from "./duel/Generator";
import type { MatchEnd } from "./game/DuelEngine";
import { ensureGoals, loadSave, writeSave } from "./lib/save";
import { enterFullscreen } from "./lib/viewport";
import type { SaveData, Settings } from "./lib/save";
import "./styles/global.css";

type View = "hub" | "match";

export default function App() {
  const director = useRef(new Director()).current;
  const [save, setSave] = useState<SaveData>(loadSave);
  const saveRef = useRef(save);
  const [view, setView] = useState<View>("hub");
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(true);
  const [active, setActive] = useState<{ plan: Plan; kind: MatchKind; nonce: number } | null>(null);
  const nonce = useRef(0);
  const planRef = useRef<Plan | null>(null);

  const commit = useCallback((next: SaveData) => {
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);

  const planNext = useCallback(async () => {
    setPlanning(true);
    const s = ensureGoals(saveRef.current);
    if (s !== saveRef.current) commit(s);
    const kind: MatchKind = director.isBossNext(s) ? "boss" : "ladder";
    const p = await director.plan(s, kind);
    planRef.current = p;
    setPlan(p);
    setPlanning(false);
    return p;
  }, [commit, director]);

  useEffect(() => {
    let alive = true;
    void director.init(import.meta.env.BASE_URL).then(() => {
      if (!alive) return;
      director.telemetry.enabled = saveRef.current.settings.telemetry;
      setReady(true);
      void planNext();
    });
    return () => {
      alive = false;
    };
  }, [director, planNext]);

  const night = save.settings.theme === "night";
  useEffect(() => {
    foamBus.intensity = view === "match" ? 0.42 : 1;
  }, [view]);
  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "day";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", night ? "#1a0b03" : "#f6eacc");
  }, [night]);

  const launch = (p: Plan, kind: MatchKind) => {
    enterFullscreen();
    director.noteMatchStart(p);
    nonce.current += 1;
    setActive({ plan: p, kind, nonce: nonce.current });
    setView("match");
  };

  const onSettings = (partial: Partial<Settings>) => {
    const next = { ...saveRef.current, settings: { ...saveRef.current.settings, ...partial } };
    commit(next);
    if (partial.telemetry !== undefined) director.telemetry.enabled = partial.telemetry;
  };

  const onFinish = (end: MatchEnd) => {
    const a = active!;
    const out = finishMatch(saveRef.current, a.plan.spec, end, a.kind);
    commit(out.save);
    director.noteMatchEnd(a.plan.spec, end.winner === 0, end.margin);
    if (a.kind !== "daily") void planNext();
    return out;
  };

  const startDaily = async () => {
    const p = await director.plan(saveRef.current, "daily");
    launch(p, "daily");
  };

  const toHub = () => setView("hub");

  const rematch = () => {
    if (active) launch(active.plan, active.kind);
  };

  const next = async () => {
    const p = planRef.current && active && planRef.current !== active.plan ? planRef.current : await planNext();
    launch(p, p.spec.kind);
  };

  return (
    <>
      <FoamBackground night={night} reduced={director.context.reducedMotion} />
      {view === "hub" && (
        <Hub
          save={save}
          plan={plan}
          planning={planning || !ready}
          bossNext={director.isBossNext(save)}
          onPlay={() => plan && launch(plan, plan.spec.kind)}
          onDaily={() => void startDaily()}
          onSettings={onSettings}
        />
      )}
      {view === "match" && active && (
        <Match
          key={active.nonce}
          plan={active.plan}
          save={save}
          rules={director.rules}
          lite={director.context.lowPower || director.context.saveData}
          onFinish={onFinish}
          onRematch={rematch}
          onNext={() => void next()}
          onHub={toHub}
          onSettings={onSettings}
          breakNote={director.sessionMinutes() >= 45}
        />
      )}
    </>
  );
}
