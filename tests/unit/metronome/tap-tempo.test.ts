import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { tap, type TapRun } from '../../../src/lib/state/tap-tempo';

/** Feed timestamps through `tap`, returning the final result. */
function feed(times: number[], run: TapRun = []): { run: TapRun; bpm: number | null } {
  let r = { run, bpm: null as number | null };
  for (const t of times) r = tap(r.run, t);
  return r;
}

describe('tap tempo', () => {
  it.each([
    [[0, 500, 1000, 1500], 120],
    [[0, 100, 200, 300], 300],
    [[0, 0, 0, 0], 300],
    [[0, 2000, 4000, 6000], 30]
  ])('T3/T4/T11: %j gives %d', (times, bpm) => {
    expect(feed(times).bpm).toBe(bpm);
  });

  it('T2: taps 1–3 give null', () => {
    expect(tap([], 0).bpm).toBeNull();
    expect(feed([0, 500]).bpm).toBeNull();
    expect(feed([0, 500, 1000]).bpm).toBeNull();
  });

  it('T5: exactly 2000 ms continues, 2000.001 ms starts a new run', () => {
    expect(feed([0, 500, 1000, 3000]).run).toEqual([0, 500, 1000, 3000]);
    expect(feed([0, 500, 1000, 3000.001])).toEqual({ run: [3000.001], bpm: null });
  });

  it('T6: tap 5 uses the gaps of taps 1–5; only the last 8 taps count', () => {
    expect(feed([0, 500, 1000, 1500, 1900]).bpm).toBe(126);
    const nine = feed(Array.from({ length: 9 }, (_, i) => i * 1000));
    expect(nine.run).toHaveLength(8);
    expect(nine.run[0]).toBe(1000);
    const slowThenFast = feed([0, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700]);
    expect(slowThenFast.bpm).toBe(300);
  });

  it('T7: rounds half up', () => {
    // gap 60000/120.5 ms → 120.5 BPM → 121
    const gap = 60000 / 120.5;
    expect(feed([0, gap, 2 * gap, 3 * gap]).bpm).toBe(121);
  });

  it('T10: backwards or non-finite time', () => {
    expect(tap([100, 200], 50)).toEqual({ run: [50], bpm: null });
    expect(tap([100, 200], NaN)).toEqual({ run: [], bpm: null });
    expect(tap([100, 200], Infinity)).toEqual({ run: [], bpm: null });
  });

  it('T1: never mutates its input', () => {
    const run = Object.freeze([0, 500, 1000]);
    expect(() => tap(run, 1500)).not.toThrow();
    expect(run).toEqual([0, 500, 1000]);
  });

  it('T8: every non-null bpm is an integer in 30–300', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 5000 }), { maxLength: 30 }), (gaps) => {
        let r: { run: TapRun; bpm: number | null } = { run: [], bpm: null };
        let t = 0;
        for (const g of gaps) {
          t += g;
          r = tap(r.run, t);
          expect(r.run.length).toBeLessThanOrEqual(8);
          if (r.bpm !== null) {
            expect(Number.isInteger(r.bpm)).toBe(true);
            expect(r.bpm).toBeGreaterThanOrEqual(30);
            expect(r.bpm).toBeLessThanOrEqual(300);
          }
        }
      })
    );
  });

  it('T9: a constant gap gives round(60000 / g)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 200, max: 2000 }), fc.integer({ min: 4, max: 20 }), (g, k) => {
        const r = feed(Array.from({ length: k }, (_, i) => i * g));
        expect(r.bpm).toBe(Math.round(60000 / g));
      })
    );
  });
});
