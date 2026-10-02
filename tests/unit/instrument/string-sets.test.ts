import { describe, expect, it } from 'vitest';
import { AF_21 } from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import {
  setLabel,
  setOpenPitches,
  setStrings,
  shapePositions,
  stringSets
} from '../../../src/lib/instrument/string-sets';

describe('string sets (data-model §3)', () => {
  it('lists bass → treble sets; MVP [6, 5, 4, 3]', () => {
    expect(stringSets(STANDARD_GUITAR)).toEqual([6, 5, 4, 3]);
    expect(stringSets(AF_21)).toEqual([7, 6, 5, 4, 3]);
  });

  it('every listed id is valid: integer and 3 ≤ id ≤ stringCount', () => {
    for (const id of stringSets(AF_21)) {
      expect(Number.isInteger(id) && id >= 3 && id <= AF_21.stringCount).toBe(true);
    }
    expect(stringSets({ ...STANDARD_GUITAR, stringCount: 2 })).toEqual([]);
  });

  it('setStrings runs low → high', () => {
    expect(setStrings(6)).toEqual([6, 5, 4]);
    expect(setStrings(3)).toEqual([3, 2, 1]);
  });

  it('setOpenPitches returns the open pitches low → high', () => {
    expect(setOpenPitches(STANDARD_GUITAR, 6)).toEqual([40, 45, 50]);
    expect(setOpenPitches(STANDARD_GUITAR, 3)).toEqual([55, 59, 64]);
    expect(setOpenPitches(AF_21, 7)).toEqual([35, 40, 45]);
  });

  it('setLabel is digits and hyphens', () => {
    expect(setLabel(6)).toBe('6-5-4');
    expect(setLabel(3)).toBe('3-2-1');
  });

  it('shapePositions maps frets onto the set strings, low → high', () => {
    expect(shapePositions(3, [5, 5, 3])).toEqual([
      { string: 3, fret: 5 },
      { string: 2, fret: 5 },
      { string: 1, fret: 3 }
    ]);
  });
});
