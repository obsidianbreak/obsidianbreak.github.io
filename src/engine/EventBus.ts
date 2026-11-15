type Listener<T> = (payload: T) => void;

/**
 * A minimal typed pub/sub so the engine can push discrete state
 * changes (score, lives, status) up to React without React ever
 * reaching into engine internals, and without re-rendering on every
 * animation frame.
 */
export class EventBus<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Set<Listener<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event]!.add(listener);
    return () => this.listeners[event]?.delete(listener);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners[event]?.forEach((l) => l(payload));
  }
}
