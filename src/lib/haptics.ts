let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

/** Android vibrates, iOS Safari ignores the call. Both are safe. */
export function buzz(pattern: number | number[]): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // Vibration blocked by the browser or policy. Silent fallback.
  }
}
