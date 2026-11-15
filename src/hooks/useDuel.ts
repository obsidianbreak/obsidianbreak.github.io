import { useCallback, useEffect, useRef, useState } from "react";
import { DuelEngine } from "../game/DuelEngine";
import type { HudState, MatchEnd, StartOptions } from "../game/DuelEngine";
import type { MatchSpec } from "../duel/Generator";

const EMPTY: HudState = {
  phase: "countdown",
  countdown: 3,
  shareL: 0.5,
  shareR: 0.5,
  timeLeft: 0,
  energy: 0,
  cards: [],
  banner: [],
  photo: false,
  winShare: 0.85,
  assisting: false,
};

export function useDuel(canvasRef: React.RefObject<HTMLCanvasElement | null>, wrapRef: React.RefObject<HTMLDivElement | null>, onEnd: (e: MatchEnd) => void) {
  const engine = useRef<DuelEngine | null>(null);
  const [hud, setHud] = useState<HudState>(EMPTY);
  const [ready, setReady] = useState(false);
  const endCb = useRef(onEnd);
  useEffect(() => {
    endCb.current = onEnd;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const e = new DuelEngine(canvas);
    engine.current = e;
    const fit = () => e.fit(wrap.clientWidth, wrap.clientHeight);
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    const un = [e.events.on("hud", setHud), e.events.on("end", (m) => endCb.current(m))];
    const onVis = () => {
      if (document.hidden) e.setPaused(true);
    };
    document.addEventListener("visibilitychange", onVis);
    setReady(true);
    return () => {
      un.forEach((u) => u());
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      e.destroy();
      engine.current = null;
    };
  }, [canvasRef, wrapRef]);

  const start = useCallback(
    (spec: MatchSpec, opts: StartOptions) => {
      const e = engine.current;
      const wrap = wrapRef.current;
      if (!e) return;
      e.start(spec, opts);
      if (wrap) e.fit(wrap.clientWidth, wrap.clientHeight);
    },
    [wrapRef],
  );

  return {
    ready,
    hud,
    start,
    cast: useCallback((slot: number) => engine.current?.cast(slot), []),
    setPaused: useCallback((p: boolean) => engine.current?.setPaused(p), []),
    setSound: useCallback((on: boolean) => engine.current?.setSound(on), []),
    setTheme: useCallback((night: boolean) => engine.current?.setTheme(night), []),
  };
}
