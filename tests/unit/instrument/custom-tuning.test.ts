import { describe, expect, it } from 'vitest';
import {
  OFFSET_MAX,
  OFFSET_MIN,
  STANDARD_OFFSETS,
  canStep,
  invertedStrings,
  isOffsets,
  matchPreset,
  offsetPitches,
  presetOffsets,
  stepOffsets,
  type Offsets,
  type StringNumber
} from '../../../src/lib/instrument/custom-tuning';
import { tuningLabel } from '../../../src/lib/shell/tuning-names';
import { tuningFromOffsets } from '../../../src/lib/instrument/tunings';
import { TUNING_PRESETS } from '../../../src/lib/instrument/tunings';
import { spellSharp } from '../../../src/lib/theory/pitch';

const name = (p: number): string => {
  const s = spellSharp(p);
  return `${s.letter}${s.accidental === 1 ? '#' : ''}${s.octave}`;
};
const STRINGS: readonly StringNumber[] = [6, 5, 4, 3, 2, 1];
const at = (string: StringNumber, v: number): Offsets => {
  const o = [0, 0, 0, 0, 0, 0];
  o[6 - string] = v;
  return o as unknown as Offsets;
};

describe('limits', () => {
  it('are −7 and +4', () => {
    expect(OFFSET_MIN).toBe(-7);
    expect(OFFSET_MAX).toBe(4);
  });

  it('give the per-string lowest/highest pitches', () => {
    const table: Record<StringNumber, [string, string]> = {
      6: ['A1', 'G#2'],
      5: ['D2', 'C#3'],
      4: ['G2', 'F#3'],
      3: ['C3', 'B3'],
      2: ['E3', 'D#4'],
      1: ['A3', 'G#4']
    };
    for (const s of STRINGS) {
      expect(name(offsetPitches(at(s, OFFSET_MIN))[6 - s])).toBe(table[s][0]);
      expect(name(offsetPitches(at(s, OFFSET_MAX))[6 - s])).toBe(table[s][1]);
    }
  });

  it('SC-002: 12 positions × 6 strings give the right pitch', () => {
    for (const s of STRINGS) {
      for (let v = OFFSET_MIN; v <= OFFSET_MAX; v++) {
        const base = offsetPitches(STANDARD_OFFSETS)[6 - s];
        expect(offsetPitches(at(s, v))[6 - s]).toBe(base + v);
      }
    }
  });
});

describe('isOffsets', () => {
  it('accepts valid and rejects invalid', () => {
    expect(isOffsets([0, 0, 0, 0, 0, 0])).toBe(true);
    expect(isOffsets([-7, 4, 0, 1, -1, 2])).toBe(true);
    expect(isOffsets('x')).toBe(false);
    expect(isOffsets(null)).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0])).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, 0, 0])).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, 0.5])).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, '1'])).toBe(false);
    expect(isOffsets([-8, 0, 0, 0, 0, 0])).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, 5])).toBe(false);
  });
});

describe('presets', () => {
  it('presetOffsets is in range for all 11 presets', () => {
    expect(TUNING_PRESETS).toHaveLength(11);
    for (const t of TUNING_PRESETS) expect(isOffsets(presetOffsets(t.id))).toBe(true);
    expect(presetOffsets('AF-1')).toEqual([0, 0, 0, 0, 0, 0]);
    expect(presetOffsets('AF-4')).toEqual([-2, 0, 0, 0, 0, 0]);
    expect(presetOffsets('AF-2')).toEqual([-1, -1, -1, -1, -1, -1]);
  });

  it('SC-004: all 11 presets are named by pitch from offsets', () => {
    expect(TUNING_PRESETS).toHaveLength(11);
    for (const t of TUNING_PRESETS) {
      const named = tuningFromOffsets(presetOffsets(t.id));
      expect(named).toEqual({ kind: 'preset', id: t.id });
      expect(tuningLabel(named)).not.toBe('Custom');
    }
    expect(tuningLabel(tuningFromOffsets([1, 0, 0, 0, 0, 0]))).toBe('Custom');
  });

  it('SC-004: matchPreset returns each preset id, null otherwise', () => {
    for (const t of TUNING_PRESETS) expect(matchPreset(presetOffsets(t.id))).toBe(t.id);
    expect(matchPreset([1, 0, 0, 0, 0, 0])).toBeNull();
    expect(matchPreset([-2, 0, 0, 0, 0, 1])).toBeNull();
  });

  it('presets are pairwise distinct', () => {
    const keys = new Set(TUNING_PRESETS.map((t) => presetOffsets(t.id).join(',')));
    expect(keys.size).toBe(11);
  });
});

describe('canStep / stepOffsets', () => {
  it('steps within limits', () => {
    expect(stepOffsets(STANDARD_OFFSETS, 6, -1)).toEqual([-1, 0, 0, 0, 0, 0]);
    expect(stepOffsets(STANDARD_OFFSETS, 1, 1)).toEqual([0, 0, 0, 0, 0, 1]);
  });

  it('refuses at limits and returns the same reference', () => {
    for (const s of STRINGS) {
      const lo = at(s, OFFSET_MIN);
      const hi = at(s, OFFSET_MAX);
      expect(canStep(lo, s, -1)).toBe(false);
      expect(canStep(lo, s, 1)).toBe(true);
      expect(canStep(hi, s, 1)).toBe(false);
      expect(canStep(hi, s, -1)).toBe(true);
      expect(stepOffsets(lo, s, -1)).toBe(lo);
      expect(stepOffsets(hi, s, 1)).toBe(hi);
    }
  });
});

describe('invertedStrings', () => {
  it('Standard and presets are not inverted', () => {
    expect(invertedStrings(STANDARD_OFFSETS)).toBe(false);
    for (const t of TUNING_PRESETS) expect(invertedStrings(presetOffsets(t.id))).toBe(false);
  });

  it('equal pitches are not inverted', () => {
    // string 3 (G3=55) lowered... string 2 B3=59; raise nothing: G3+4 = B3 → unison
    expect(invertedStrings(at(3, 4))).toBe(false);
  });

  it('string n strictly lower than n+1 is inverted', () => {
    // string 3 = G3 − 7 ... need string 3 < string 4? string 4 = D3 (50); 3 → C3(48) is lower
    expect(invertedStrings(at(3, -7))).toBe(true);
    expect(invertedStrings(at(6, 4))).toBe(false);
    expect(invertedStrings(at(6, 4).map((v, i) => (i === 1 ? -7 : v)) as unknown as Offsets)).toBe(
      true
    );
  });
});

describe('frozen results', () => {
  it('returns frozen arrays', () => {
    expect(Object.isFrozen(STANDARD_OFFSETS)).toBe(true);
    expect(Object.isFrozen(presetOffsets('AF-3'))).toBe(true);
    expect(Object.isFrozen(offsetPitches(STANDARD_OFFSETS))).toBe(true);
    expect(Object.isFrozen(stepOffsets(STANDARD_OFFSETS, 6, -1))).toBe(true);
  });
});
