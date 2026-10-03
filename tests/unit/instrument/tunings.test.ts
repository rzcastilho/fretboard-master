import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import {
  DEFAULT_FRETS,
  DEFAULT_TUNING_ID,
  MAX_FRETS,
  MIN_FRETS,
  TUNING_PRESETS,
  clampFrets,
  isTuningId,
  presetInstrument,
  tuningPreset,
  type TuningId
} from '../../../src/lib/instrument/tunings';
import { pitchOfSpelling } from '../../../src/lib/theory/pitch';

/** Low → high, e.g. "Eb2". */
const TABLE: Record<TuningId, string> = {
  'AF-1': 'E2 A2 D3 G3 B3 E4',
  'AF-2': 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4',
  'AF-3': 'D2 G2 C3 F3 A3 D4',
  'AF-4': 'D2 A2 D3 G3 B3 E4',
  'AF-5': 'C2 G2 C3 F3 A3 D4',
  'AF-6': 'D2 A2 D3 G3 B3 D4',
  'AF-7': 'D2 A2 D3 G3 A3 D4',
  'AF-8': 'D2 G2 D3 G3 B3 D4',
  'AF-9': 'D2 A2 D3 F#3 A3 D4',
  'AF-10': 'E2 B2 E3 G#3 B3 E4',
  'AF-11': 'E2 A2 E3 A3 C#4 E4'
};
const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const;

function parse(s: string) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(s);
  if (!m) throw new Error(`bad pitch ${s}`);
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const letter = m[1] as keyof typeof NATURAL;
  const octave = Number(m[3]);
  return { letter, accidental, octave, midi: (octave + 1) * 12 + NATURAL[letter] + accidental };
}

const ids = Object.keys(TABLE) as TuningId[];

describe('tuning presets (SC-002)', () => {
  const rows = ids.flatMap((id) => TABLE[id].split(' ').map((n, k) => [id, k, n] as const));
  it('has 66 rows', () => expect(rows).toHaveLength(66));

  it.each(rows)('%s string %i = %s', (id, k, name) => {
    const want = parse(name);
    const got = tuningPreset(id).strings[k];
    expect(got.letter).toBe(want.letter);
    expect(got.accidental).toBe(want.accidental);
    expect(got.octave).toBe(want.octave);
    expect(pitchOfSpelling(got)).toBe(want.midi);
  });

  it('every preset has 6 strictly rising strings', () => {
    for (const p of TUNING_PRESETS) {
      expect(p.strings).toHaveLength(6);
      for (let k = 1; k < 6; k++) {
        expect(pitchOfSpelling(p.strings[k])).toBeGreaterThan(pitchOfSpelling(p.strings[k - 1]));
      }
    }
  });

  it('is in AF-1…AF-11 order', () => {
    expect(TUNING_PRESETS.map((p) => p.id)).toEqual(ids);
  });
});

describe('presetInstrument', () => {
  it('AF-1 at 22 frets is STANDARD_GUITAR', () => {
    expect(presetInstrument('AF-1', 22)).toBe(STANDARD_GUITAR);
  });

  it('is memoized', () => {
    expect(presetInstrument('AF-4', 17)).toBe(presetInstrument('AF-4', 17));
  });

  it('string 1 is first (reversed low → high)', () => {
    for (const id of ids) {
      const inst = presetInstrument(id, 20);
      for (let k = 0; k < 6; k++) {
        expect(inst.openStrings[k]).toEqual(tuningPreset(id).strings[5 - k]);
      }
    }
  });

  it('is frozen with fixed shape', () => {
    const inst = presetInstrument('AF-7', 15);
    expect(Object.isFrozen(inst)).toBe(true);
    expect(inst.stringCount).toBe(6);
    expect(inst.handedness).toBe('right');
    expect(inst.orientation).toBe('highest-top');
    expect(inst.fretCount).toBe(15);
  });

  it('clamps the fret count', () => {
    expect(presetInstrument('AF-3', 99).fretCount).toBe(24);
    expect(presetInstrument('AF-3', 1).fretCount).toBe(12);
  });
});

describe('clampFrets, constants, guard', () => {
  it('clamps, rounds and defaults NaN', () => {
    expect(clampFrets(11)).toBe(12);
    expect(clampFrets(25)).toBe(24);
    expect(clampFrets(17.4)).toBe(17);
    expect(clampFrets(17.6)).toBe(18);
    expect(clampFrets(NaN)).toBe(22);
    expect(clampFrets(18)).toBe(18);
  });

  it('constants', () => {
    expect(MIN_FRETS).toBe(12);
    expect(MAX_FRETS).toBe(24);
    expect(DEFAULT_FRETS).toBe(22);
    expect(DEFAULT_TUNING_ID).toBe('AF-1');
  });

  it('isTuningId accepts only the 11 ids', () => {
    for (const id of ids) expect(isTuningId(id)).toBe(true);
    for (const bad of ['AF-0', 'AF-12', 'af-1', '', 'toString', '__proto__', 1, null, undefined]) {
      expect(isTuningId(bad)).toBe(false);
    }
  });
});
