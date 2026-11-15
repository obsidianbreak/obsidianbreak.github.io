import { useState } from "react";
import Logo from "../components/Logo";
import Overlay from "../components/Overlay";
import SettingsPanel from "../components/SettingsPanel";
import { IconFlame, IconPlay, IconSettings, IconShield } from "../components/icons";
import { PERSONAS } from "../duel/Brain";
import { MUTATORS } from "../duel/Generator";
import { toRating, tierOf } from "../duel/Rating";
import type { Plan } from "../director/Director";
import { dailyDoneToday, liveDailyStreak } from "../lib/save";
import type { SaveData, Settings } from "../lib/save";

interface HubProps {
  save: SaveData;
  plan: Plan | null;
  planning: boolean;
  bossNext: boolean;
  onPlay: () => void;
  onDaily: () => void;
  onSettings: (p: Partial<Settings>) => void;
}

export default function Hub({ save, plan, planning, bossNext, onPlay, onDaily, onSettings }: HubProps) {
  const [sheet, setSheet] = useState(false);
  const rating = toRating(save.skill);
  const tier = tierOf(rating);
  const done = dailyDoneToday(save);
  const spec = plan?.spec;
  const persona = spec ? PERSONAS[spec.persona] : null;
  const toNext = tier.next ? tier.next - rating : 0;

  return (
    <div className="screen hub">
      <div className="hub__column">
        <header className="hub__top">
          <Logo size={36} />
          <button className="round" onClick={() => setSheet(true)} aria-label="Settings">
            <IconSettings />
          </button>
        </header>

        <h1 className="hub__title">Latte <i>vs</i> Roast</h1>
        <p className="hub__tag">A territory duel. Your cream tiles against an AI that never sleeps.</p>

        <div className="rank">
          <div>
            <p className="caps">Your rating</p>
            <p className="rank__value">{rating}</p>
            <p className="rank__tier">
              {tier.name}
              {tier.next ? `, ${toNext} to next tier` : ""}
            </p>
          </div>
          <div className="rank__side">
            <span className="pill">
              <IconFlame size={14} /> {save.winStreak} streak
            </span>
            {save.shield > 0 && (
              <span className="pill pill--gold">
                <IconShield size={14} /> Shield
              </span>
            )}
          </div>
        </div>

        <section className="duel">
          <p className="caps">{bossNext ? "Boss duel" : "Next duel"}</p>
          {planning || !spec || !persona ? (
            <p className="duel__name duel__name--shimmer">Brewing your next duel</p>
          ) : (
            <>
              <h2 className="duel__name">{spec.name}</h2>
              <p className="duel__opp">
                vs <b>{persona.name}</b>, {persona.tagline.toLowerCase()}
              </p>
              <div className="chips">
                {spec.mutators.length === 0 && <span className="tag">Classic board</span>}
                {spec.mutators.map((m) => (
                  <span key={m} className="tag" title={MUTATORS[m].blurb}>
                    {MUTATORS[m].name}
                  </span>
                ))}
                <span className="tag tag--gold">{Math.round(spec.predictedWin * 100)}% win chance</span>
              </div>
              <p className="duel__fine">
                Built just now for your level, then tested with simulated duels. {spec.cfg.cols} by {spec.cfg.rows} tiles, {Math.round(spec.cfg.duration)} seconds.
              </p>
            </>
          )}
          <button className="btn btn--primary" onClick={onPlay} disabled={planning || !spec}>
            <IconPlay /> {planning ? "Brewing" : "Play"}
          </button>
        </section>

        <button className="daily" onClick={onDaily}>
          <span className="caps">Daily Roast</span>
          <span className="daily__line">
            {done ? `Cleared, margin ${(save.daily.lastMargin * 100).toFixed(1)}%` : "One shared board for everyone today"}
          </span>
          <span className="pill">
            <IconFlame size={14} /> {liveDailyStreak(save)}
          </span>
        </button>

        <section className="goals">
          <p className="caps">Today's goals</p>
          {save.goals.list.map((g) => (
            <div key={g.id} className={`goal ${g.progress >= g.target ? "goal--done" : ""}`}>
              <span>{g.label}</span>
              <span className="goal__bar">
                <i style={{ width: `${(g.progress / g.target) * 100}%` }} />
              </span>
            </div>
          ))}
        </section>
      </div>

      {sheet && (
        <Overlay
          eyebrow="Settings"
          title="Make it yours"
          actions={
            <button className="btn btn--glass" onClick={() => setSheet(false)}>
              Done
            </button>
          }
        >
          <SettingsPanel settings={save.settings} onChange={onSettings} />
          <dl className="stats">
            <div>
              <dt>Wins</dt>
              <dd>{save.wins}</dd>
            </div>
            <div>
              <dt>Tiles claimed</dt>
              <dd>{save.stats.flips.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Best streak</dt>
              <dd>{save.bestStreak}</dd>
            </div>
          </dl>
        </Overlay>
      )}
    </div>
  );
}
