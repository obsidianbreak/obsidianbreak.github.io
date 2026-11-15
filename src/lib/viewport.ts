/** Height reserved for the bars, cards and hint around the board in a match. The banner overlays the board. */
const HUD_RESERVE = 150;

function safeInsets(): { top: number; bottom: number } {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return out;
}

/**
 * Width to height ratio of the area the board can use on this device.
 * The generator uses it to pick a board that fills the screen, so the
 * match feels full screen on any phone.
 */
export function boardAspect(): number {
  const { top, bottom } = safeInsets();
  const width = Math.min(window.innerWidth, 520);
  const height = Math.max(280, window.innerHeight - HUD_RESERVE - top - bottom);
  return width / height;
}

/** Android and desktop browsers can hide their chrome. iPhone Safari cannot, so use Add to Home Screen there. */
export function enterFullscreen(): void {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (standalone || document.fullscreenElement) return;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: "hide" }).catch(() => undefined);
    else el.webkitRequestFullscreen?.();
  } catch {
    // Not allowed here. The game still plays fine.
  }
}
