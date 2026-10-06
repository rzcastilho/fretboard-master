/** Quiet period before a changed description is announced (FR-009). */
export const ANNOUNCE_DELAY_MS = 500;

export interface AnnouncerTimer {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface Announcer {
  update(text: string): void;
  dispose(): void;
}

/**
 * Debounced announcer. The first text is a silent baseline; each later differing text
 * restarts the timer, and once `delayMs` passes without a change the latest text is
 * emitted, unless it equals what was last announced.
 */
export function createAnnouncer(opts: {
  readonly delayMs: number;
  readonly timer: AnnouncerTimer;
  readonly emit: (text: string) => void;
}): Announcer {
  const { delayMs, timer, emit } = opts;
  let started = false;
  let lastSeen = '';
  let announced = '';
  let pending: string | null = null;
  let handle: unknown = null;

  const cancel = () => {
    if (handle !== null) {
      timer.clear(handle);
      handle = null;
    }
  };

  return {
    update(text) {
      if (!started) {
        started = true;
        lastSeen = text;
        announced = text;
        return;
      }
      if (text === lastSeen) return;
      lastSeen = text;
      cancel();
      pending = text;
      handle = timer.set(() => {
        handle = null;
        const t = pending;
        pending = null;
        if (t !== null && t !== announced) {
          announced = t;
          emit(t);
        }
      }, delayMs);
    },
    dispose() {
      cancel();
      pending = null;
    }
  };
}
