const QUEUE_KEY = "obsidian-break:telemetry";

interface TelemetryEvent {
  t: number;
  name: string;
  data?: Record<string, string | number | boolean>;
}

/**
 * Opt in, anonymous event logging. Nothing leaves the device unless
 * the player turns sharing on and a collector URL was set at build
 * time with VITE_TELEMETRY_URL. The collector can aggregate bandit
 * results across players to make experiments truly large scale.
 */
export class Telemetry {
  enabled = false;
  private queue: TelemetryEvent[] = [];
  private url: string | undefined;
  private installId: string;

  constructor() {
    this.url = (import.meta.env.VITE_TELEMETRY_URL as string | undefined) || undefined;
    this.installId = this.loadId();
    try {
      const raw = window.localStorage.getItem(QUEUE_KEY);
      if (raw) this.queue = JSON.parse(raw) as TelemetryEvent[];
    } catch {
      this.queue = [];
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flush();
    });
  }

  private loadId(): string {
    try {
      const existing = window.localStorage.getItem("obsidian-break:install");
      if (existing) return existing;
      const fresh = Math.random().toString(36).slice(2, 12);
      window.localStorage.setItem("obsidian-break:install", fresh);
      return fresh;
    } catch {
      return "anon";
    }
  }

  track(name: string, data?: TelemetryEvent["data"]): void {
    if (!this.enabled) return;
    this.queue.push({ t: Date.now(), name, data });
    this.queue = this.queue.slice(-200);
    if (this.queue.length >= 20) this.flush();
    else this.persist();
  }

  private persist(): void {
    try {
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // Ignore.
    }
  }

  flush(): void {
    if (!this.enabled || !this.url || this.queue.length === 0) return;
    const body = JSON.stringify({ id: this.installId, events: this.queue });
    try {
      if (navigator.sendBeacon?.(this.url, body)) this.queue = [];
    } catch {
      // Keep the queue for the next attempt.
    }
    this.persist();
  }
}
