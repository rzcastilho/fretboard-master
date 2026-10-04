import { describe, expect, it } from 'vitest';
import {
  HANDEDNESS,
  ORIENTATIONS,
  STANDARD_GUITAR,
  allPositions,
  equalsMusicalInstrument,
  withPresentation,
  isValidPosition,
  lowestPositionOfPitch,
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

describe('test-only fixtures AF-8 and SHORT-7 (feature 006)', () => {
  it('AF-8 is Open G, 22 frets', async () => {
    const { fixtureInstrument } = await import('../../../src/lib/instrument/fixtures');
    const i = fixtureInstrument('AF-8');
    expect(i.stringCount).toBe(6);
    expect(i.fretCount).toBe(22);
    expect(i.openStrings.map((s) => `${s.letter}${s.octave}`)).toEqual([
      'D4',
      'B3',
      'G3',
      'D3',
      'G2',
      'D2'
    ]);
    expect(Object.isFrozen(i)).toBe(true);
  });

  it('SHORT-7 is standard tuning with 7 frets', async () => {
    const { fixtureInstrument } = await import('../../../src/lib/instrument/fixtures');
    const i = fixtureInstrument('SHORT-7');
    expect(i.fretCount).toBe(7);
    expect(i.openStrings).toEqual(STANDARD_GUITAR.openStrings);
  });
});

describe('lowestPositionOfPitch (feature 006)', () => {
  it('picks the lowest fret', () => {
    // E4 = 64: string 1 fret 0 beats string 2 fret 5.
    expect(lowestPositionOfPitch(STANDARD_GUITAR, 64)).toEqual({ string: 1, fret: 0 });
    // A2 = 45: open string 5 beats string 6 fret 5.
    expect(lowestPositionOfPitch(STANDARD_GUITAR, 45)).toEqual({ string: 5, fret: 0 });
    // E3 = 52: string 4 fret 2 beats string 5 fret 7 and string 6 fret 12.
    expect(lowestPositionOfPitch(STANDARD_GUITAR, 52)).toEqual({ string: 4, fret: 2 });
  });

  it('ties go to the thicker (higher-numbered) string', () => {
    const twin = Object.freeze({
      ...STANDARD_GUITAR,
      openStrings: Object.freeze([
        ...STANDARD_GUITAR.openStrings.slice(0, 1),
        STANDARD_GUITAR.openStrings[1],
        STANDARD_GUITAR.openStrings[1],
        ...STANDARD_GUITAR.openStrings.slice(3)
      ])
    });
    expect(lowestPositionOfPitch(twin, 59)).toEqual({ string: 3, fret: 0 });
  });

  it('is null when the pitch is not on the board', () => {
    expect(lowestPositionOfPitch(STANDARD_GUITAR, 39)).toBeNull();
    expect(lowestPositionOfPitch(STANDARD_GUITAR, 64 + 22 + 1)).toBeNull();
  });
});

describe('withPresentation (contracts/orientation-api §1)', () => {
  it('lists the value sets', () => {
    expect(HANDEDNESS).toEqual(['right', 'left']);
    expect(ORIENTATIONS).toEqual(['highest-top', 'lowest-top']);
  });

  it('default arguments return base itself', () => {
    expect(withPresentation(STANDARD_GUITAR, 'right', 'highest-top')).toBe(STANDARD_GUITAR);
  });

  it('non-default is frozen, keeps musical fields, and is memoized', () => {
    const left = withPresentation(STANDARD_GUITAR, 'left', 'highest-top');
    expect(left).not.toBe(STANDARD_GUITAR);
    expect(Object.isFrozen(left)).toBe(true);
    expect(left.handedness).toBe('left');
    expect(left.orientation).toBe('highest-top');
    expect(equalsMusicalInstrument(left, STANDARD_GUITAR)).toBe(true);
    expect(withPresentation(STANDARD_GUITAR, 'left', 'highest-top')).toBe(left);
    expect(withPresentation(STANDARD_GUITAR, 'left', 'lowest-top')).not.toBe(left);
  });

  it('positionPitch is identical for every position in all four combinations', () => {
    for (const h of HANDEDNESS) {
      for (const o of ORIENTATIONS) {
        const inst = withPresentation(STANDARD_GUITAR, h, o);
        for (const p of allPositions(STANDARD_GUITAR)) {
          expect(positionPitch(inst, p)).toBe(positionPitch(STANDARD_GUITAR, p));
        }
      }
    }
  });

  it('equalsMusicalInstrument detects musical differences only', () => {
    const shorter = { ...STANDARD_GUITAR, fretCount: 12 };
    expect(equalsMusicalInstrument(STANDARD_GUITAR, shorter)).toBe(false);
    expect(
      equalsMusicalInstrument(
        STANDARD_GUITAR,
        withPresentation(STANDARD_GUITAR, 'left', 'lowest-top')
      )
    ).toBe(true);
  });
});
