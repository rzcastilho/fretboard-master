import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  frequencyOf,
  octaveOf,
  pitchClass,
  pitchClassOfSpelling,
  pitchOfSpelling,
  sharpSpelling,
  spellSharp,
  transpose
} from '../../../src/lib/theory/pitch';

describe('pitchOfSpelling golden values (TM-1)', () => {
  it('maps spelled pitches to MIDI-style numbers (C4 = 60)', () => {
    expect(pitchOfSpelling({ letter: 'E', accidental: 0, octave: 2 })).toBe(40);
    expect(pitchOfSpelling({ letter: 'E', accidental: 0, octave: 4 })).toBe(64);
    expect(pitchOfSpelling({ letter: 'C', accidental: 0, octave: 4 })).toBe(60);
    expect(pitchOfSpelling({ letter: 'B', accidental: 1, octave: 3 })).toBe(60);
    expect(pitchOfSpelling({ letter: 'C', accidental: -1, octave: 4 })).toBe(59);
  });
});

describe('octaveOf (TM-1.3)', () => {
  it('changes octave at C', () => {
    expect(octaveOf(59)).toBe(3);
    expect(octaveOf(60)).toBe(4);
    expect(octaveOf(0)).toBe(-1);
  });
});

describe('pitchClass', () => {
  it('reduces mod 12, including negatives', () => {
    expect(pitchClass(60)).toBe(0);
    expect(pitchClass(61)).toBe(1);
    expect(pitchClass(-1)).toBe(11);
    expect(pitchClass(-12)).toBe(0);
    expect(pitchClass(-13)).toBe(11);
  });
});

describe('pitchClassOfSpelling', () => {
  it('handles accidentals and wraps', () => {
    expect(pitchClassOfSpelling({ letter: 'C', accidental: 0 })).toBe(0);
    expect(pitchClassOfSpelling({ letter: 'B', accidental: 1 })).toBe(0);
    expect(pitchClassOfSpelling({ letter: 'C', accidental: -1 })).toBe(11);
    expect(pitchClassOfSpelling({ letter: 'F', accidental: 2 })).toBe(7);
    expect(pitchClassOfSpelling({ letter: 'B', accidental: -2 })).toBe(9);
  });
});

describe('properties (TM-3)', () => {
  it('pitchClass is always an integer in 0..11', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2000, max: 2000 }), (p) => {
        const pc = pitchClass(p);
        return Number.isInteger(pc) && pc >= 0 && pc <= 11;
      })
    );
  });

  it('octave/pitch-class round-trip: (octave+1)*12 + pc === p', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2000, max: 2000 }), (p) => {
        return (octaveOf(p) + 1) * 12 + pitchClass(p) === p;
      })
    );
  });

  it('transpose adds semitones and composes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        (p, a, b) =>
          transpose(p, a) === p + a && transpose(transpose(p, a), b) === transpose(p, a + b)
      )
    );
  });

  it('transposing by 12 keeps pitch class and raises octave by 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: -500, max: 500 }), (p) => {
        const q = transpose(p, 12);
        return pitchClass(q) === pitchClass(p) && octaveOf(q) === octaveOf(p) + 1;
      })
    );
  });

  it('pitchOfSpelling agrees with pitchClassOfSpelling mod 12', () => {
    const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
    fc.assert(
      fc.property(
        fc.constantFrom(...letters),
        fc.constantFrom(-2, -1, 0, 1, 2),
        fc.integer({ min: -1, max: 9 }),
        (letter, accidental, octave) => {
          const s = { letter, accidental: accidental as -2 | -1 | 0 | 1 | 2 };
          return pitchClass(pitchOfSpelling({ ...s, octave })) === pitchClassOfSpelling(s);
        }
      )
    );
  });
});

describe('frequencyOf (12-TET, A4 = 440 Hz)', () => {
  it.each([
    [40, 82.41],
    [33, 55.0],
    [48, 130.81],
    [69, 440.0],
    [88, 1318.51]
  ])('pitch %i is %f Hz', (p, hz) => {
    expect(frequencyOf(p)).toBeCloseTo(hz, 2);
  });

  it('an octave up doubles the frequency', () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 100 }), (p) => {
        expect(frequencyOf(p + 12) / frequencyOf(p)).toBeCloseTo(2, 9);
      })
    );
  });
});

describe('sharpSpelling / spellSharp (011 R-03)', () => {
  it('spells the 12 pitch classes with sharps', () => {
    const names = Array.from({ length: 12 }, (_, pc) => {
      const s = sharpSpelling(pc);
      return `${s.letter}${s.accidental === 1 ? '#' : ''}`;
    });
    expect(names).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
  });

  it('uses the sounding octave and preserves pitch across B/C', () => {
    expect(spellSharp(59)).toEqual({ letter: 'B', accidental: 0, octave: 3 });
    expect(spellSharp(60)).toEqual({ letter: 'C', accidental: 0, octave: 4 });
    expect(spellSharp(41)).toEqual({ letter: 'F', accidental: 0, octave: 2 });
    for (let p = 21; p <= 96; p++) {
      const s = spellSharp(p);
      expect(s.octave).toBe(octaveOf(p));
      expect(pitchOfSpelling(s)).toBe(p);
    }
  });
});
