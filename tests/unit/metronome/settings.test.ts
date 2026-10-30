import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_LOOP2,
  DEFAULT_SUBDIVISION,
  SUBDIVISIONS,
  toSubdivision,
  atLimit,
  clampBeats,
  clampBpm,
  clampCount,
  effectiveCountIn,
  effectiveRepeatCountIn,
  runPlanFor,
  toRatio,
  stepSetting,
  type MetronomeSettings
} from '../../../src/lib/state/metronome-settings';

describe('metronome settings', () => {
  it('defaults to 85 BPM / 4 beats / 8th triplets, frozen', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      bpm: 85,
      beats: 4,
      subdivision: 3,
      countIn: true,
      initialCountIn: 4,
      repeatCountIn: 2,
      ratio: true,
      loop2: 6
    });
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
  });

  it('clampBpm clamps 30-300, rounds, NaN -> 30', () => {
    expect(clampBpm(0)).toBe(30);
    expect(clampBpm(1000)).toBe(300);
    expect(clampBpm(85.6)).toBe(86);
    expect(clampBpm(NaN)).toBe(30);
    expect(clampBpm(Infinity)).toBe(300);
  });

  it('clampBeats clamps 1-16, rounds, NaN -> 1', () => {
    expect(clampBeats(0)).toBe(1);
    expect(clampBeats(99)).toBe(16);
    expect(clampBeats(3.4)).toBe(3);
    expect(clampBeats(NaN)).toBe(1);
  });

  it('stepSetting steps by one and returns the same object at a limit', () => {
    expect(stepSetting(DEFAULT_SETTINGS, 'bpm', 1)).toEqual({ ...DEFAULT_SETTINGS, bpm: 86 });
    expect(stepSetting(DEFAULT_SETTINGS, 'beats', -1)).toEqual({ ...DEFAULT_SETTINGS, beats: 3 });
    const lo: MetronomeSettings = { ...DEFAULT_SETTINGS, bpm: 30, beats: 1 };
    const hi: MetronomeSettings = { ...DEFAULT_SETTINGS, bpm: 300, beats: 16 };
    expect(stepSetting(lo, 'bpm', -1)).toBe(lo);
    expect(stepSetting(lo, 'beats', -1)).toBe(lo);
    expect(stepSetting(hi, 'bpm', 1)).toBe(hi);
    expect(stepSetting(hi, 'beats', 1)).toBe(hi);
  });

  it('atLimit covers both fields and both directions', () => {
    expect(atLimit({ ...DEFAULT_SETTINGS, bpm: 30, beats: 1 }, 'bpm', -1)).toBe(true);
    expect(atLimit({ ...DEFAULT_SETTINGS, bpm: 30, beats: 1 }, 'bpm', 1)).toBe(false);
    expect(atLimit({ ...DEFAULT_SETTINGS, bpm: 300, beats: 16 }, 'bpm', 1)).toBe(true);
    expect(atLimit({ ...DEFAULT_SETTINGS, bpm: 300, beats: 16 }, 'bpm', -1)).toBe(false);
    expect(atLimit({ ...DEFAULT_SETTINGS, bpm: 30, beats: 1 }, 'beats', -1)).toBe(true);
    expect(atLimit({ ...DEFAULT_SETTINGS, bpm: 30, beats: 1 }, 'beats', 1)).toBe(false);
    expect(atLimit({ ...DEFAULT_SETTINGS, bpm: 300, beats: 16 }, 'beats', 1)).toBe(true);
    expect(atLimit({ ...DEFAULT_SETTINGS, bpm: 300, beats: 16 }, 'beats', -1)).toBe(false);
  });
});

describe('count in settings', () => {
  it('clampCount clamps 0-8, rounds, NaN -> fallback', () => {
    expect(clampCount(-1, 4)).toBe(0);
    expect(clampCount(9, 4)).toBe(8);
    expect(clampCount(2.6, 4)).toBe(3);
    expect(clampCount(NaN, 4)).toBe(4);
    expect(clampCount(NaN, 2)).toBe(2);
  });

  it('effectiveCountIn is the initial count when on, else 0', () => {
    for (const n of [0, 4, 8]) {
      expect(effectiveCountIn({ ...DEFAULT_SETTINGS, countIn: true, initialCountIn: n })).toBe(n);
      expect(effectiveCountIn({ ...DEFAULT_SETTINGS, countIn: false, initialCountIn: n })).toBe(0);
    }
  });

  it('atLimit and stepSetting cover both count fields', () => {
    for (const field of ['initialCountIn', 'repeatCountIn'] as const) {
      const lo = { ...DEFAULT_SETTINGS, [field]: 0 };
      const hi = { ...DEFAULT_SETTINGS, [field]: 8 };
      expect(atLimit(lo, field, -1)).toBe(true);
      expect(atLimit(lo, field, 1)).toBe(false);
      expect(atLimit(hi, field, 1)).toBe(true);
      expect(atLimit(hi, field, -1)).toBe(false);
      expect(stepSetting(lo, field, -1)).toBe(lo);
      expect(stepSetting(hi, field, 1)).toBe(hi);
      expect(stepSetting(lo, field, 1)[field]).toBe(1);
      expect(stepSetting(hi, field, -1)[field]).toBe(7);
    }
  });
});

describe('subdivision', () => {
  it('lists 1-8 with default 3', () => {
    expect([...SUBDIVISIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(DEFAULT_SUBDIVISION).toBe(3);
  });

  it('toSubdivision accepts the eight integers as numbers or strings', () => {
    expect(toSubdivision(3)).toBe(3);
    expect(toSubdivision('5')).toBe(5);
  });

  it('toSubdivision returns null for anything else, never throwing', () => {
    for (const v of [0, 9, 2.5, NaN, '', 'x', null, undefined, {}, [], Symbol('s')]) {
      expect(toSubdivision(v)).toBeNull();
    }
  });
});

describe('subdivision ratio settings (034)', () => {
  const base: MetronomeSettings = { ...DEFAULT_SETTINGS };

  it('S2: toRatio returns booleans as-is and true otherwise', () => {
    expect(toRatio(false)).toBe(false);
    expect(toRatio(true)).toBe(true);
    for (const v of [0, 'false', null, undefined, {}, NaN]) expect(toRatio(v)).toBe(true);
  });

  it('DEFAULT_LOOP2 is Sextuplets and toSubdivision falls back to it', () => {
    expect(DEFAULT_LOOP2).toBe(6);
    expect(toSubdivision('x') ?? DEFAULT_LOOP2).toBe(6);
    expect(toSubdivision(4) ?? DEFAULT_LOOP2).toBe(4);
  });

  it.each([
    [true, true, 2, 2],
    [true, false, 2, 0],
    [false, true, 2, 0],
    [false, false, 2, 0],
    [true, true, 0, 0]
  ])('effectiveRepeatCountIn countIn %s ratio %s r %i -> %i', (countIn, ratio, r, want) => {
    expect(effectiveRepeatCountIn({ ...base, countIn, ratio, repeatCountIn: r })).toBe(want);
  });

  it('S3: runPlanFor builds the alternation only when the section is on', () => {
    expect(runPlanFor(base)).toEqual({
      clicksPerBeat: 3,
      initialCountIn: 4,
      alternate: { clicksPerBeat: 6, repeatCountIn: 2 }
    });
    const off = runPlanFor({ ...base, ratio: false });
    expect(off).toEqual({ clicksPerBeat: 3, initialCountIn: 4 });
    expect('alternate' in off).toBe(false);
    expect(runPlanFor({ ...base, countIn: false })).toEqual({
      clicksPerBeat: 3,
      initialCountIn: 0,
      alternate: { clicksPerBeat: 6, repeatCountIn: 0 }
    });
  });
});
