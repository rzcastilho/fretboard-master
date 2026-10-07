import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type InstrumentConfig } from '$lib/state/instrument-config';
import { tuningFromOffsets } from '$lib/instrument/tunings';
import { instrumentOf, sameTraits, traitsOf } from '../../../src/lib/measure/traits';

const cfg = (over: Partial<InstrumentConfig>): InstrumentConfig => ({ ...DEFAULT_CONFIG, ...over });

describe('traitsOf', () => {
  it('returns strings, preset tuning id and hand', () => {
    expect(traitsOf(cfg({ handedness: 'left' }))).toEqual({
      strings: 6,
      tuning: 'AF-1',
      hand: 'left'
    });
  });
  it('reports custom without offsets or notes', () => {
    const custom = tuningFromOffsets([1, 0, 0, 0, 0, 0]);
    const t = traitsOf(cfg({ tuning: custom }));
    expect(t).toEqual({ strings: 6, tuning: 'custom', hand: 'right' });
    expect(Object.keys(t).sort()).toEqual(['hand', 'strings', 'tuning']);
  });
});

describe('instrumentOf', () => {
  it('adds frets', () => {
    expect(instrumentOf(cfg({ fretCount: 19 }))).toEqual({
      strings: 6,
      tuning: 'AF-1',
      hand: 'right',
      frets: 19
    });
  });
});

describe('sameTraits', () => {
  it('compares all three fields', () => {
    const a = traitsOf(DEFAULT_CONFIG);
    expect(sameTraits(a, { ...a })).toBe(true);
    expect(sameTraits(a, { ...a, hand: 'left' })).toBe(false);
    expect(sameTraits(a, { ...a, strings: 7 })).toBe(false);
    expect(sameTraits(a, { ...a, tuning: 'AF-2' })).toBe(false);
  });
  it('orientation and fret count are not traits', () => {
    const a = traitsOf(DEFAULT_CONFIG);
    expect(sameTraits(a, traitsOf(cfg({ fretCount: 15, orientation: 'lowest-top' })))).toBe(true);
  });
});
