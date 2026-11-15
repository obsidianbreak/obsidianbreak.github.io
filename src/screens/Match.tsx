import { useEffect, useRef, useState } from "react";
import BoardThumb from "../components/BoardThumb";
import Overlay from "../components/Overlay";
import SettingsPanel from "../components/SettingsPanel";
import { IconBack, IconPause, IconPlay, IconRestart, IconShare } from "../components/icons";
import { PERSONAS } from "../duel/Brain";
import { useDuel } from "../hooks/useDuel";
import type { Plan } from "../director/Director";
import type { Outcome } from "../director/Progress";
import { emojiGrid } from "../director/Progress";
import type { MatchEnd } from "../game/DuelEngine";
import { shareText } from "../lib/share";
import { todayKey } from "../lib/rng";
import { dailyDoneToday, liveDailyStreak } from "../lib/save";
import type { SaveData, Settings } from "../lib/save";
import type { RuleSet } from "../director/RulesEngine";

interface MatchProps {
  plan: Plan;
  save: SaveData;
  rules: RuleSet;
  lite: boolean;
  onFinish: (end: MatchEnd) => Outcome;
  onRematch: () => void;
  onNext: () => void;
  onHub: () => void;
  onSettings: (p: Partial<Settings>) => void;
  breakNote: boolean;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function Match({ plan, save, rules, lite, onFinish, onRematch, onNext, onHub, onSettings, breakNote }: MatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [end, setEnd] = useState<MatchEnd | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const spec = plan.spec;

  const { ready, hud, start, cast, setPaused, setSound, setTheme } = useDuel(canvasRef, wrapRef, (e) => {
    setEnd(e);
    setOutcome(onFinish(e));
  });

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    start(spec, { adaptive: save.settings.adaptive, rules, lite, sound: save.settings.sound, haptics: save.settings.haptics, night: save.settings.theme === "night" });
    // The match starts once, when the engine is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const change = (p: Partial<Settings>) => {
    if (p.sound !== undefined) setSound(p.sound);
    if (p.theme) setTheme(p.theme === "night");
    onSettings(p);
  };

  const share = async () => {
    if (!end) return;
    const grid = emojiGrid(end.cells, end.cols, end.rows);
    const result = end.winner === 0 ? `Won by ${pct(end.margin)}` : end.winner === 1 ? `Lost by ${pct(-end.margin)}` : "Draw";
    const head = spec.kind === "daily" ? `Obsidian Break Daily ${todayKey()}` : `Obsidian Break vs ${PERSONAS[spec.persona].name}`;
    const text = `${head}\n${result}\n${grid}\n${window.location.href}`;
    const r = await shareText(text);
    setNote(r === "copied" ? "Copied to clipboard" : r === "shared" ? "Shared" : "Could not share");
  };

  const mins = hud.timeLeft;
  const title = end ? (end.winner === 0 ? "You win" : end.winner === 1 ? "Roast wins" : "A draw") : "";
  const subtitle = end
    ? end.winner === 0
      ? `Won by ${pct(end.margin)} against ${PERSONAS[spec.persona].name}`
      : end.winner === 1
        ? `Lost by ${pct(-end.margin)}. ${end.tilesShort} more tiles would have flipped it.`
        : "Dead even. Nobody blinked."
    : "";

  return (
    <div className="screen match">
      <div className="match__column">
        <div className="board" ref={wrapRef}>
          <canvas ref={canvasRef} className="board__canvas" />
          {hud.phase === "countdown" && <div className="board__count">{hud.countdown || ""}</div>}
          {hud.photo && <div className="board__photo">Photo finish</div>}
        </div>

        <div className="bars">
          <div className="bars__row">
            <span className="bars__label">LATTE</span>
            <div className="bars__track">
              <div className="bars__fill bars__fill--latte" style={{ width: `${hud.shareL * 100}%` }} />
              <i className="bars__mark" style={{ left: `${hud.winShare * 100}%` }} />
            </div>
            <span className="bars__val">{Math.round(hud.shareL * 100)}</span>
          </div>
          <div className="bars__row">
            <span className="bars__label">ROAST <i className="bars__dot" /></span>
            <div className="bars__track">
              <div className="bars__fill bars__fill--roast" style={{ width: `${hud.shareR * 100}%` }} />
              <i className="bars__mark" style={{ left: `${hud.winShare * 100}%` }} />
            </div>
            <span className="bars__val">{clock(mins)}</span>
          </div>
        </div>

        <div className="cards">
          {hud.cards.map((c, i) => (
            <button key={`${i}-${c.kind}`} className={`card ${c.ready ? "card--ready" : ""}`} disabled={!c.ready || hud.phase !== "playing"} onClick={() => cast(i)}>
              <span className="card__fill" style={{ width: `${Math.min(100, (hud.energy / c.cost) * 100)}%` }} />
              <span className="card__name">{c.label.replace(" + 10 SECONDS", "")}</span>
              <span className="card__cost">{c.ready ? "TAP" : Math.ceil(c.cost - hud.energy)}</span>
            </button>
          ))}
          <button className="pausebtn" onClick={() => setPaused(true)} aria-label="Pause">
            <IconPause size={18} />
          </button>
        </div>
        <p className="match__hint">Drag to pull your dark balls. Tap a lit card to cast.{hud.assisting ? " Adaptive help on." : ""}</p>
      </div>

      {hud.phase === "paused" && !end && (
        <Overlay
          eyebrow="Paused"
          title={spec.name}
          subtitle={`${PERSONAS[spec.persona].name}: ${PERSONAS[spec.persona].tagline}`}
          actions={
            <>
              <button className="btn btn--primary" onClick={() => setPaused(false)}>
                <IconPlay /> Resume
              </button>
              <button className="btn btn--quiet" onClick={onHub}>
                <IconBack /> Leave duel
              </button>
            </>
          }
        >
          <SettingsPanel settings={save.settings} onChange={change} />
        </Overlay>
      )}

      {end && outcome && (
        <Overlay
          eyebrow={spec.kind === "daily" ? "Daily Roast" : spec.kind === "boss" ? "Boss duel" : "Duel complete"}
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <button className="btn btn--primary" onClick={onRematch}>
                <IconRestart /> {end.winner === 1 ? "Rematch" : "Play this board again"}
              </button>
              {spec.kind !== "daily" && (
                <button className="btn btn--glass" onClick={onNext}>
                  <IconPlay /> Next opponent
                </button>
              )}
              <button className="btn btn--glass" onClick={share}>
                <IconShare /> Share
              </button>
              <button className="btn btn--quiet" onClick={onHub}>
                <IconBack /> Menu
              </button>
            </>
          }
        >
          <BoardThumb cells={end.cells} cols={end.cols} rows={end.rows} />
          <dl className="stats">
            <div>
              <dt>Tiles claimed</dt>
              <dd>{end.flips}</dd>
            </div>
            <div>
              <dt>Gifts</dt>
              <dd>{end.gifts}</dd>
            </div>
            <div>
              <dt>Cards</dt>
              <dd>{end.casts}</dd>
            </div>
          </dl>
          {spec.kind !== "daily" ? (
            <p className="result__line">
              Rating {outcome.ratingBefore} to <b>{outcome.ratingAfter}</b> ({outcome.ratingAfter >= outcome.ratingBefore ? "+" : ""}
              {outcome.ratingAfter - outcome.ratingBefore}) {outcome.tierAfter !== outcome.tierBefore ? `, new tier: ${outcome.tierAfter}` : `, ${outcome.tierAfter}`}
            </p>
          ) : (
            <p className="result__line">
              Daily streak <b>{liveDailyStreak(outcome.save)}</b>
              {dailyDoneToday(outcome.save) ? "" : ""}
            </p>
          )}
          {outcome.shieldUsed && <p className="result__line">Your streak shield absorbed that loss.</p>}
          {outcome.shieldEarned && <p className="result__line">Five wins in a row. You earned a streak shield.</p>}
          {outcome.goalsDone.map((g) => (
            <p key={g} className="result__line result__line--goal">
              Goal done: {g}
            </p>
          ))}
          {breakNote && <p className="result__note">You have been playing a while. A short stretch is a great move before the next one.</p>}
          {note && <p className="result__note">{note}</p>}
        </Overlay>
      )}
    </div>
  );
}
