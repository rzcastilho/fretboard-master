import { describe, expect, it } from 'vitest';
import { animateScroll, type Clock } from '../../../src/lib/fretboard/scroll-animation';

/** Manual clock: `advance(ms)` runs the callbacks queued for the next frame. */
function fakeClock() {
  let time = 0;
  let nextId = 1;
  const pending = new Map<number, (t: number) => void>();
  const clock: Clock = {
    now: () => time,
    frame: (cb) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancel: (id) => {
      pending.delete(id);
    }
  };
  return {
    clock,
    pendingCount: () => pending.size,
    advance(ms: number) {
      time += ms;
      const batch = [...pending.entries()];
      pending.clear();
      for (const [, cb] of batch) cb(time);
    }
  };
}

describe('animateScroll', () => {
  it('reaches the target within durationMs', () => {
    const { clock, advance, pendingCount } = fakeClock();
    const el = { scrollLeft: 10 };
    animateScroll(el, 410, 300, clock);
    for (let i = 0; i < 18; i++) advance(16.7);
    expect(el.scrollLeft).toBe(410);
    expect(pendingCount()).toBe(0);
  });

  it('moves monotonically toward the target', () => {
    const { clock, advance } = fakeClock();
    const el = { scrollLeft: 0 };
    animateScroll(el, 200, 300, clock);
    let prev = 0;
    for (let i = 0; i < 18; i++) {
      advance(16.7);
      expect(el.scrollLeft).toBeGreaterThanOrEqual(prev);
      expect(el.scrollLeft).toBeLessThanOrEqual(200);
      prev = el.scrollLeft;
    }
  });

  it('works scrolling backwards', () => {
    const { clock, advance } = fakeClock();
    const el = { scrollLeft: 500 };
    animateScroll(el, 100, 200, clock);
    advance(250);
    expect(el.scrollLeft).toBe(100);
  });

  it('sets scrollLeft synchronously when durationMs is 0', () => {
    const { clock, pendingCount } = fakeClock();
    const el = { scrollLeft: 0 };
    animateScroll(el, 123, 0, clock);
    expect(el.scrollLeft).toBe(123);
    expect(pendingCount()).toBe(0);
  });

  it('cancel stops further frames', () => {
    const { clock, advance, pendingCount } = fakeClock();
    const el = { scrollLeft: 0 };
    const cancel = animateScroll(el, 300, 300, clock);
    advance(100);
    const mid = el.scrollLeft;
    expect(mid).toBeGreaterThan(0);
    cancel();
    expect(pendingCount()).toBe(0);
    advance(300);
    expect(el.scrollLeft).toBe(mid);
  });
});
