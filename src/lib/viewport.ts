/** Height reserved for the bars, cards and hint around the board in a match. The banner overlays the board. */
const HUD_RESERVE = 150;

export function isStandalone(): boolean {
  return !!(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone);
}

/**
 * The real size of the app window. On iPhone, a game saved to the home
 * screen is full screen, but the browser can report a viewport that is
 * one status bar shorter at launch, which leaves a dead strip at the
 * bottom. In that case the physical screen size is the truth.
 */
export function appSize(): { w: number; h: number; fixed: boolean } {
  const portrait = window.matchMedia?.("(orientation: portrait)").matches ?? window.innerHeight >= window.innerWidth;
  const phone = Math.min(screen.width, screen.height) <= 600 && (window.matchMedia?.("(pointer: coarse)").matches ?? true);
  if (isStandalone() && portrait && phone) {
    const h = Math.max(window.innerHeight, Math.max(screen.width, screen.height));
    return { w: window.innerWidth, h, fixed: true };
  }
  return { w: window.innerWidth, h: window.innerHeight, fixed: false };
}

/** Publishes the exact height to CSS as --app-h so layout and background fill the whole screen. */
export function syncAppSize(): void {
  const { h, fixed } = appSize();
  const root = document.documentElement;
  if (fixed) root.style.setProperty("--app-h", `${h}px`);
  else root.style.removeProperty("--app-h");
}

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
  const height = Math.max(280, appSize().h - HUD_RESERVE - top - bottom);
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
