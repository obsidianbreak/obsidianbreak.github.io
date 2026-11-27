/**
 * Haptics. Android and Chromium: navigator.vibrate. iPhone Safari has no Vibration API; its only Taptic hook is a
 * native <input type="checkbox" switch>, which ticks when a finger lands on it. Since iOS 26.5 a script-made click
 * on such a switch no longer ticks, so on iPhone every button gets an invisible switch laid over it (mountIosHaptics):
 * the tap lands on the switch and is forwarded to the real button. Script ticks stay as a fallback for iOS 17.4 to
 * 26.4, which covers moments with no tap under the finger (casts from the board, wins, losses).
 */
let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
  if (typeof document !== "undefined") document.documentElement.classList.toggle("haptics-off", !on);
}

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
export const isIOS =
  /iP(hone|od|ad)/.test(ua) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

let lastOverlayTick = 0;
let lastFallback = 0;
let fallback: HTMLLabelElement | null = null;

function iosFallbackTick(): void {
  if (typeof document === "undefined") return;
  const now = Date.now();
  if (now - lastOverlayTick < 300 || now - lastFallback < 60) return;
  lastFallback = now;
  if (!fallback) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);
    document.head.appendChild(label);
    fallback = label;
  }
  fallback.click();
}

/** `pattern` is a vibration pattern; on iPhone every pulse (even index) becomes one tick at its start time. */
export function buzz(pattern: number | number[]): void {
  if (!enabled) return;
  try {
    if (canVibrate) {
      navigator.vibrate(pattern);
    } else if (isIOS) {
      const list = Array.isArray(pattern) ? pattern : [pattern];
      let at = 0;
      list.forEach((ms, i) => {
        if (i % 2 === 0) {
          if (at === 0) iosFallbackTick();
          else window.setTimeout(iosFallbackTick, at);
        }
        at += ms;
      });
    }
  } catch {
    // Vibration blocked by the browser or policy. Silent fallback.
  }
}

const HOSTS = "button, a[href]";
const SKIP = "[data-no-hx]";

/** A finger that lands on a native switch is owned by it and cannot start a scroll, so skip controls inside areas that really scroll. */
function inScrollingArea(el: HTMLElement): boolean {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 1) return true;
  }
  return false;
}

/** iPhone only: overlay an invisible switch on every control so a real tap produces a Taptic tick. */
export function mountIosHaptics(): void {
  if (typeof document === "undefined" || !isIOS || canVibrate) return;
  let queued = false;
  const decorate = (): void => {
    queued = false;
    document.querySelectorAll<HTMLElement>(HOSTS).forEach((host) => {
      if (host.querySelector(":scope > .hx") || host.closest(SKIP)) return;
      if ((host as HTMLButtonElement).disabled || host.getAttribute("aria-disabled") === "true") return;
      if (inScrollingArea(host)) return;
      // Inline style, not a class: React rewrites className on re-render and would drop a class.
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.style.isolation = "isolate";
      const sw = document.createElement("input");
      sw.type = "checkbox";
      sw.className = "hx";
      sw.tabIndex = -1;
      sw.setAttribute("switch", "");
      sw.setAttribute("aria-hidden", "true");
      let lastForward = 0;
      const forward = (): void => {
        const now = Date.now();
        if (now - lastForward < 400) return;
        lastForward = now;
        lastOverlayTick = now;
        if (!(host as HTMLButtonElement).disabled) host.click();
      };
      let from: { x: number; y: number } | null = null;
      sw.addEventListener("pointerdown", (e) => { from = { x: e.clientX, y: e.clientY }; });
      sw.addEventListener("pointercancel", () => { from = null; });
      sw.addEventListener("pointerup", (e) => {
        const start = from;
        from = null;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10) forward();
      });
      sw.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        forward();
      });
      host.append(sw);
    });
  };
  const queue = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(decorate);
  };
  new MutationObserver(queue).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "aria-disabled"],
  });
  decorate();
}
