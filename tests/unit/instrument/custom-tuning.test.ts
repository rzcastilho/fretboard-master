import { afterEach, describe, expect, it } from 'vitest';
import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { notation, resetNotationForTests } from '../../../src/lib/state/notation.svelte';
import {
  OFFSET_MAX,
  addSeventh,
  dropSeventh,
  referencePitches,
  standardOffsets,
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
import { TUNING_PRESETS as ALL_PRESETS } from '../../../src/lib/instrument/tunings';

/** The six-string catalog AF-1 … AF-11 (AF-21 … AF-23 are seven-string only). */
const TUNING_PRESETS = ALL_PRESETS.filter((t) => t.strings.length === 6);
import { spellSharp } from '../../../src/lib/theory/pitch';

const name = (p: number): string => {
  const s = spellSharp(p);
  return `${s.letter}${s.accidental === 1 ? '#' : ''}${s.octave}`;
};
const STRINGS: readonly Exclude<StringNumber, 7>[] = [6, 5, 4, 3, 2, 1];
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
    const table: Record<Exclude<StringNumber, 7>, [string, string]> = {
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
    expect(isOffsets([0, 0, 0, 0, 0, 0], 6)).toBe(true);
    expect(isOffsets([-7, 4, 0, 1, -1, 2], 6)).toBe(true);
    expect(isOffsets('x', 6)).toBe(false);
    expect(isOffsets(null, 6)).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0], 6)).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, 0, 0], 6)).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, 0.5], 6)).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, '1'], 6)).toBe(false);
    expect(isOffsets([-8, 0, 0, 0, 0, 0], 6)).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, 5], 6)).toBe(false);
  });
});

describe('presets', () => {
  it('presetOffsets is in range for all 11 presets', () => {
    expect(TUNING_PRESETS).toHaveLength(11);
    for (const t of TUNING_PRESETS) expect(isOffsets(presetOffsets(t.id, 6), 6)).toBe(true);
    expect(presetOffsets('AF-1', 6)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(presetOffsets('AF-4', 6)).toEqual([-2, 0, 0, 0, 0, 0]);
    expect(presetOffsets('AF-2', 6)).toEqual([-1, -1, -1, -1, -1, -1]);
  });

  it('SC-004: all 11 presets are named by pitch from offsets', () => {
    expect(TUNING_PRESETS).toHaveLength(11);
    for (const t of TUNING_PRESETS) {
      const named = tuningFromOffsets(presetOffsets(t.id, 6));
      expect(named).toEqual({ kind: 'preset', id: t.id });
      expect(tuningLabel(named)).not.toBe('Custom');
    }
    expect(tuningLabel(tuningFromOffsets([1, 0, 0, 0, 0, 0]))).toBe('Custom');
  });

  it('SC-004: matchPreset returns each preset id, null otherwise', () => {
    for (const t of TUNING_PRESETS) expect(matchPreset(presetOffsets(t.id, 6))).toBe(t.id);
    expect(matchPreset([1, 0, 0, 0, 0, 0])).toBeNull();
    expect(matchPreset([-2, 0, 0, 0, 0, 1])).toBeNull();
  });

  it('presets are pairwise distinct', () => {
    const keys = new Set(TUNING_PRESETS.map((t) => presetOffsets(t.id, 6).join(',')));
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
    for (const t of TUNING_PRESETS) expect(invertedStrings(presetOffsets(t.id, 6))).toBe(false);
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
    expect(Object.isFrozen(presetOffsets('AF-3', 6))).toBe(true);
    expect(Object.isFrozen(offsetPitches(STANDARD_OFFSETS))).toBe(true);
    expect(Object.isFrozen(stepOffsets(STANDARD_OFFSETS, 6, -1))).toBe(true);
  });
});

describe('seven-string offsets (012)', () => {
  it('referencePitches', () => {
    expect([...referencePitches(6)]).toEqual([40, 45, 50, 55, 59, 64]);
    expect([...referencePitches(7)]).toEqual([35, 40, 45, 50, 55, 59, 64]);
  });

  it('standardOffsets', () => {
    expect([...standardOffsets(6)]).toEqual([0, 0, 0, 0, 0, 0]);
    expect([...standardOffsets(7)]).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('isOffsets(x, count) checks length and range', () => {
    expect(isOffsets([0, 0, 0, 0, 0, 0, 0], 7)).toBe(true);
    expect(isOffsets([0, 0, 0, 0, 0, 0, 0], 6)).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, 0], 7)).toBe(false);
    expect(isOffsets([-7, 4, 0, 1, -1, 2, 0], 7)).toBe(true);
    expect(isOffsets([-8, 0, 0, 0, 0, 0, 0], 7)).toBe(false);
    expect(isOffsets([0, 0, 0, 0, 0, 0, 5], 7)).toBe(false);
  });

  const o7 = (v: number): Offsets => [v, 0, 0, 0, 0, 0, 0];

  it('string 7 limits are E1 (28) and D#2 (39)', () => {
    expect(offsetPitches(o7(OFFSET_MIN))[0]).toBe(28);
    expect(offsetPitches(o7(OFFSET_MAX))[0]).toBe(39);
    expect(canStep(o7(OFFSET_MIN), 7, -1)).toBe(false);
    expect(canStep(o7(OFFSET_MIN), 7, 1)).toBe(true);
    expect(canStep(o7(OFFSET_MAX), 7, 1)).toBe(false);
    const lo = o7(OFFSET_MIN);
    expect(stepOffsets(lo, 7, -1)).toBe(lo);
    expect([...stepOffsets(o7(0), 7, -1)]).toEqual([-1, 0, 0, 0, 0, 0, 0]);
    expect([...stepOffsets(o7(0), 1, 1)]).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });

  it('string 7 is refused when the length is 6', () => {
    const six = standardOffsets(6);
    expect(canStep(six, 7, -1)).toBe(false);
    expect(stepOffsets(six, 7, -1)).toBe(six);
  });

  it('matchPreset on 7 offsets never returns AF-1/AF-2', () => {
    expect(matchPreset([0, 0, 0, 0, 0, 0, 0])).toBe('AF-21');
    expect(matchPreset([-2, 0, 0, 0, 0, 0, 0])).toBe('AF-23');
    expect(matchPreset([-1, -1, -1, -1, -1, -1, -1])).toBe('AF-22');
    expect(matchPreset([-2, -2, 0, 0, 0, 0, 0])).toBe('AF-4');
    expect(matchPreset([-3, 0, 0, 0, 0, 0, 0])).toBeNull();
  });

  it('matchPreset on 6 offsets never returns AF-21/22/23', () => {
    expect(matchPreset([0, 0, 0, 0, 0, 0])).toBe('AF-1');
  });

  it('addSeventh / dropSeventh', () => {
    const six: Offsets = [-2, 0, 0, -1, 0, 0];
    const seven = addSeventh(six);
    expect([...seven]).toEqual([-2, -2, 0, 0, -1, 0, 0]);
    expect(Object.isFrozen(seven)).toBe(true);
    expect([...dropSeventh(seven)]).toEqual([...six]);
    const s7 = standardOffsets(7);
    expect(addSeventh(s7)).toBe(s7);
    const s6 = standardOffsets(6);
    expect(dropSeventh(s6)).toBe(s6);
  });

  it('invertedStrings covers pair 7/6', () => {
    expect(invertedStrings([0, 0, 0, 0, 0, 0, 0])).toBe(false);
    expect(invertedStrings([4, 0, 0, 0, 0, 0, 0])).toBe(false); // B1+4 = D#2 < E2
    expect(invertedStrings([0, -5, 0, 0, 0, 0, 0])).toBe(false); // string 6 = B1 (35) = string 7: unison
    expect(invertedStrings([0, -6, 0, 0, 0, 0, 0])).toBe(true); // string 6 = A#1 (34) < B1 (35)
    expect(invertedStrings([4, -7, 0, 0, 0, 0, 0])).toBe(true); // D#2 (39) > A1 (33)
  });
});

describe('T-1 tuning names follow the notation', () => {
  const label = (id: 'AF-4' | 'AF-6' | 'AF-8' | 'AF-7') => tuningLabel({ kind: 'preset', id });

  afterEach(() => {
    resetNotationForTests();
    resetLanguageForTests();
  });

  it('solfège in en', () => {
    resetNotationForTests();
    resetLanguageForTests();
    language.start('en');
    notation.start({ notation: 'solfege', accidentals: 'sharps' });
    expect(label('AF-4')).toBe('Drop Re');
    expect(label('AF-6')).toBe('Double Drop Re');
    expect(label('AF-8')).toBe('Open Sol');
    expect(tuningLabel({ kind: 'preset', id: 'AF-5' })).toBe('Drop Do');
  });

  it('solfège in pt-BR and es', () => {
    resetNotationForTests();
    resetLanguageForTests();
    language.start('pt-BR');
    notation.start({ notation: 'solfege', accidentals: 'sharps' });
    expect(label('AF-8')).toBe('Aberta em Sol');
    language.restore('es');
    expect(label('AF-8')).toBe('Abierta en Sol');
  });

  it('letters keep the letter, and DADGAD stays literal everywhere', () => {
    resetNotationForTests();
    resetLanguageForTests();
    language.start('en');
    notation.start({ notation: 'letters', accidentals: 'sharps' });
    expect(label('AF-4')).toBe('Drop D');
    expect(label('AF-7')).toBe('DADGAD');
    notation.choose('solfege');
    expect(label('AF-7')).toBe('DADGAD');
  });
});
