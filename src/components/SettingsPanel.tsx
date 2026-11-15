import { IconMoon, IconShield, IconSoundOff, IconSoundOn, IconSun, IconVibrate } from "./icons";
import type { Settings } from "../lib/save";

interface Props {
  settings: Settings;
  onChange: (partial: Partial<Settings>) => void;
}

export default function SettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="settings">
      <div className="settings__row">
        <button className={`chip ${settings.sound ? "chip--on" : ""}`} onClick={() => onChange({ sound: !settings.sound })} aria-pressed={settings.sound}>
          {settings.sound ? <IconSoundOn size={16} /> : <IconSoundOff size={16} />} Sound
        </button>
        <button className={`chip ${settings.haptics ? "chip--on" : ""}`} onClick={() => onChange({ haptics: !settings.haptics })} aria-pressed={settings.haptics}>
          <IconVibrate size={16} /> Haptics
        </button>
        <button className="chip chip--on" onClick={() => onChange({ theme: settings.theme === "day" ? "night" : "day" })}>
          {settings.theme === "day" ? <IconSun size={16} /> : <IconMoon size={16} />} {settings.theme === "day" ? "Day" : "Night"}
        </button>
      </div>
      <button className={`toggle ${settings.adaptive ? "toggle--on" : ""}`} onClick={() => onChange({ adaptive: !settings.adaptive })} aria-pressed={settings.adaptive}>
        <span className="toggle__head">
          <IconShield size={16} /> Adaptive difficulty
          <i className="toggle__dot" />
        </span>
        <span className="toggle__blurb">The game picks opponents near your level and lends small help after losses. Turn it off for a fixed challenge.</span>
      </button>
      <button className={`toggle ${settings.telemetry ? "toggle--on" : ""}`} onClick={() => onChange({ telemetry: !settings.telemetry })} aria-pressed={settings.telemetry}>
        <span className="toggle__head">
          Share anonymous stats
          <i className="toggle__dot" />
        </span>
        <span className="toggle__blurb">Optional. Helps tune the game. No personal data, off by default.</span>
      </button>
    </div>
  );
}
