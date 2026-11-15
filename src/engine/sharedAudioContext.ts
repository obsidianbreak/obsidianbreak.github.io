/**
 * Mobile Safari (and some Android browsers) only allow an
 * AudioContext to be created/resumed inside the exact synchronous
 * call stack of a user gesture. Because the game's first sound is
 * usually triggered from a React effect that runs a tick after the
 * button tap that mounted it, creating the context lazily inside
 * AudioEngine was arriving too late and staying "suspended" forever
 * on iOS. This module creates one shared context as early as
 * possible and re-resumes it on every subsequent pointerdown/touch,
 * which is cheap and side-effect free once already running.
 */
let sharedContext: AudioContext | null = null;

function getAudioCtor(): typeof AudioContext {
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  );
}

export function getSharedAudioContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new (getAudioCtor())();
  }
  return sharedContext;
}

export function unlockSharedAudioContext(): void {
  const ctx = getSharedAudioContext();
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

let listenersAttached = false;

/** Call once, as early as possible (app boot), to arm the unlock listeners. */
export function armAudioUnlock(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  const unlock = () => unlockSharedAudioContext();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("touchend", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}
