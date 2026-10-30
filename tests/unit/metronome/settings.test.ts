import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SUBDIVISION,
  SUBDIVISIONS,
  toSubdivision,
  atLimit,
  clampBeats,
  clampBpm,
  stepSetting,
  type MetronomeSettings
} from '../../../src/lib/state/metronome-settings';

describe('metronome settings', () => {
  it('defaults to 85 BPM / 4 beats / 8th triplets, frozen', () => {
    expect(DEFAULT_SETTINGS).toEqual({ bpm: 85, beats: 4, subdivision: 3 });
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
    expect(stepSetting(DEFAULT_SETTINGS, 'bpm', 1)).toEqual({ bpm: 86, beats: 4, subdivision: 3 });
    expect(stepSetting(DEFAULT_SETTINGS, 'beats', -1)).toEqual({
      bpm: 85,
      beats: 3,
      subdivision: 3
    });
    const lo: MetronomeSettings = { bpm: 30, beats: 1, subdivision: 3 };
    const hi: MetronomeSettings = { bpm: 300, beats: 16, subdivision: 3 };
    expect(stepSetting(lo, 'bpm', -1)).toBe(lo);
    expect(stepSetting(lo, 'beats', -1)).toBe(lo);
    expect(stepSetting(hi, 'bpm', 1)).toBe(hi);
    expect(stepSetting(hi, 'beats', 1)).toBe(hi);
  });

  it('atLimit covers both fields and both directions', () => {
    expect(atLimit({ bpm: 30, beats: 1, subdivision: DEFAULT_SUBDIVISION }, 'bpm', -1)).toBe(true);
    expect(atLimit({ bpm: 30, beats: 1, subdivision: DEFAULT_SUBDIVISION }, 'bpm', 1)).toBe(false);
    expect(atLimit({ bpm: 300, beats: 16, subdivision: DEFAULT_SUBDIVISION }, 'bpm', 1)).toBe(true);
    expect(atLimit({ bpm: 300, beats: 16, subdivision: DEFAULT_SUBDIVISION }, 'bpm', -1)).toBe(
      false
    );
    expect(atLimit({ bpm: 30, beats: 1, subdivision: DEFAULT_SUBDIVISION }, 'beats', -1)).toBe(
      true
    );
    expect(atLimit({ bpm: 30, beats: 1, subdivision: DEFAULT_SUBDIVISION }, 'beats', 1)).toBe(
      false
    );
    expect(atLimit({ bpm: 300, beats: 16, subdivision: DEFAULT_SUBDIVISION }, 'beats', 1)).toBe(
      true
    );
    expect(atLimit({ bpm: 300, beats: 16, subdivision: DEFAULT_SUBDIVISION }, 'beats', -1)).toBe(
      false
    );
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
