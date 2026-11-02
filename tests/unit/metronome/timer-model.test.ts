import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMER_MINUTES,
  FLASH_MS,
  LATE_CHIME_LIMIT_MS,
  TICK_SLACK_MS,
  TIMER_PRESETS,
  announcementFor,
  formatReadout,
  nextTickDelay,
  secondsLeft,
  shouldChime,
  toPreset
} from '../../../src/lib/state/timer-model';

describe('constants', () => {
  it('has the documented values', () => {
    expect(TIMER_PRESETS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(DEFAULT_TIMER_MINUTES).toBe(2);
    expect(FLASH_MS).toBe(5000);
    expect(LATE_CHIME_LIMIT_MS).toBe(2000);
    expect(TICK_SLACK_MS).toBe(15);
  });
});

describe('M1 toPreset', () => {
  it.each([1, 2, 5, 10])('accepts %d', (n) => expect(toPreset(n)).toBe(n));
  it.each(['5', 5.5, 0, 11, -1, NaN, Infinity, null, undefined, true, {}, []])('rejects %j', (v) =>
    expect(toPreset(v)).toBeNull()
  );
  it('accepts exactly the integers 1–10', () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), (n) => {
        expect(toPreset(n) !== null).toBe(n >= 1 && n <= 10);
      })
    );
  });
});

describe('M2 secondsLeft', () => {
  it.each([
    [120000, 120],
    [119001, 120],
    [119000, 119],
    [1, 1],
    [0, 0],
    [-5, 0],
    [NaN, 0]
  ])('secondsLeft(%d) = %d', (ms, s) => expect(secondsLeft(ms)).toBe(s));
});

describe('M3 formatReadout', () => {
  it.each([
    [600, '10:00'],
    [120, '02:00'],
    [119, '01:59'],
    [9, '00:09'],
    [0, '00:00'],
    [99999, '99:59'],
    [-3, '00:00']
  ])('formatReadout(%d) = %s', (s, out) => expect(formatReadout(s)).toBe(out));

  it('round-trips for 0–5999', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5999 }), (s) => {
        const out = formatReadout(s);
        expect(out).toMatch(/^\d\d:\d\d$/);
        const [mm, ss] = out.split(':').map(Number);
        expect(mm * 60 + ss).toBe(s);
      })
    );
  });
});

describe('M4 nextTickDelay', () => {
  it('lies in (slack, 1000 + slack] and lands one second lower', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 600_000 }), (r) => {
        const d = nextTickDelay(r);
        expect(d).toBeGreaterThan(TICK_SLACK_MS);
        expect(d).toBeLessThanOrEqual(1000 + TICK_SLACK_MS);
        expect(secondsLeft(r - d)).toBe(secondsLeft(r) - 1);
      })
    );
  });
  it('matches the formula on a whole second', () => {
    expect(nextTickDelay(120000)).toBe(1000 + TICK_SLACK_MS);
    expect(nextTickDelay(119001)).toBe(1 + TICK_SLACK_MS);
  });
});

describe('M5 shouldChime', () => {
  it('chimes up to 2000 ms late, not beyond', () => {
    expect(shouldChime(0)).toBe(true);
    expect(shouldChime(2000)).toBe(true);
    expect(shouldChime(2001)).toBe(false);
  });
});

describe('M6 announcementFor', () => {
  it('is null when unchanged or above 10', () => {
    expect(announcementFor(5, 5)).toBeNull();
    expect(announcementFor(12, 11)).toBeNull();
    expect(announcementFor(120, 119)).toBeNull();
  });
  it('announces seconds, second and finished', () => {
    expect(announcementFor(11, 10)).toEqual({ kind: 'seconds', count: 10 });
    expect(announcementFor(3, 2)).toEqual({ kind: 'seconds', count: 2 });
    expect(announcementFor(2, 1)).toEqual({ kind: 'second' });
    expect(announcementFor(1, 0)).toEqual({ kind: 'finished' });
  });
});
