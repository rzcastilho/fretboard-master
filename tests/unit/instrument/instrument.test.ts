import { describe, expect, it } from 'vitest';
import {
  STANDARD_GUITAR,
  allPositions,
  isValidPosition,
  positionKey,
  positionPitch
} from '../../../src/lib/instrument/instrument';
import { pitchClass } from '../../../src/lib/theory/pitch';

describe('STANDARD_GUITAR', () => {
  it('has 6 strings, 22 frets, E4 B3 G3 D3 A2 E2 for strings 1→6', () => {
    expect(STANDARD_GUITAR.stringCount).toBe(6);
    expect(STANDARD_GUITAR.fretCount).toBe(22);
    expect(STANDARD_GUITAR.openStrings.map((s) => `${s.letter}${s.accidental}${s.octave}`)).toEqual(
      ['E04', 'B03', 'G03', 'D03', 'A02', 'E02']
    );
    expect(STANDARD_GUITAR.openStrings).toHaveLength(STANDARD_GUITAR.stringCount);
  });

  it('is right-handed, highest-top', () => {
    expect(STANDARD_GUITAR.handedness).toBe('right');
    expect(STANDARD_GUITAR.orientation).toBe('highest-top');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(STANDARD_GUITAR)).toBe(true);
    expect(Object.isFrozen(STANDARD_GUITAR.openStrings)).toBe(true);
  });
});

describe('positionPitch', () => {
  it('golden values', () => {
    expect(positionPitch(STANDARD_GUITAR, { string: 2, fret: 1 })).toBe(60);
    expect(positionPitch(STANDARD_GUITAR, { string: 6, fret: 0 })).toBe(40);
    expect(positionPitch(STANDARD_GUITAR, { string: 1, fret: 0 })).toBe(64);
  });

  // TM-3: pitch class of each string at frets 0..12 (6 × 13)
  const OPEN_PC = [4, 11, 7, 2, 9, 4];
  it.each(OPEN_PC.map((pc, i) => [i + 1, pc] as const))(
    'string %i: pitch class at frets 0–12',
    (string, openPc) => {
      for (let fret = 0; fret <= 12; fret++) {
        expect(pitchClass(positionPitch(STANDARD_GUITAR, { string, fret }))).toBe(
          (openPc + fret) % 12
        );
      }
    }
  );

  it('frets 13–22 equal frets 1–10 plus an octave', () => {
    for (let string = 1; string <= 6; string++) {
      for (let fret = 1; fret <= 10; fret++) {
        expect(positionPitch(STANDARD_GUITAR, { string, fret: fret + 12 })).toBe(
          positionPitch(STANDARD_GUITAR, { string, fret }) + 12
        );
      }
    }
  });
});

describe('isValidPosition', () => {
  it('accepts the grid and rejects outside/non-integer', () => {
    expect(isValidPosition(STANDARD_GUITAR, { string: 1, fret: 0 })).toBe(true);
    expect(isValidPosition(STANDARD_GUITAR, { string: 6, fret: 22 })).toBe(true);
    expect(isValidPosition(STANDARD_GUITAR, { string: 0, fret: 0 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 7, fret: 0 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 1, fret: -1 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 1, fret: 23 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 1.5, fret: 0 })).toBe(false);
    expect(isValidPosition(STANDARD_GUITAR, { string: 1, fret: 0.5 })).toBe(false);
  });
});

describe('positionKey', () => {
  it('is "string:fret"', () => {
    expect(positionKey({ string: 2, fret: 1 })).toBe('2:1');
    expect(positionKey({ string: 6, fret: 0 })).toBe('6:0');
  });
});

describe('allPositions', () => {
  it('returns 138 unique valid positions, string 1..6 × fret 0..22', () => {
    const all = allPositions(STANDARD_GUITAR);
    expect(all).toHaveLength(138);
    expect(new Set(all.map(positionKey)).size).toBe(138);
    expect(all.every((p) => isValidPosition(STANDARD_GUITAR, p))).toBe(true);
    expect(all[0]).toEqual({ string: 1, fret: 0 });
    expect(all[137]).toEqual({ string: 6, fret: 22 });
  });
});
