/** rAF scroll animation with an injectable clock (R-09). No Svelte. */

export interface Clock {
  now(): number;
  frame(cb: (t: number) => void): number;
  cancel(id: number): void;
}

export const browserClock: Clock = {
  now: () => performance.now(),
  frame: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id)
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Animates `el.scrollLeft` to `to`; `durationMs <= 0` jumps synchronously. Returns cancel. */
export function animateScroll(
  el: { scrollLeft: number },
  to: number,
  durationMs: number,
  clock: Clock
): () => void {
  if (durationMs <= 0) {
    el.scrollLeft = to;
    return () => {};
  }
  const from = el.scrollLeft;
  const startedAt = clock.now();
  let id = 0;
  let cancelled = false;
  const step = (t: number) => {
    if (cancelled) return;
    const p = Math.min(1, Math.max(0, (t - startedAt) / durationMs));
    el.scrollLeft = p >= 1 ? to : from + (to - from) * easeOutCubic(p);
    if (p < 1) id = clock.frame(step);
  };
  id = clock.frame(step);
  return () => {
    cancelled = true;
    clock.cancel(id);
  };
}
