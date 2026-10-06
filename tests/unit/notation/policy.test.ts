import { describe, expect, it } from 'vitest';
import {
  ACCIDENTAL_POLICIES,
  DEFAULT_NOTATION_CONTEXT,
  NOTATIONS
} from '../../../src/lib/notation/policy';

describe('notation policy constants', () => {
  it('lists the notations in order', () => {
    expect([...NOTATIONS]).toEqual(['letters', 'solfege']);
  });

  it('lists the accidental policies in order', () => {
    expect([...ACCIDENTAL_POLICIES]).toEqual(['sharps', 'flats', 'both']);
  });

  it('defaults to letters and sharps, frozen', () => {
    expect(DEFAULT_NOTATION_CONTEXT).toEqual({ notation: 'letters', accidentals: 'sharps' });
    expect(Object.isFrozen(DEFAULT_NOTATION_CONTEXT)).toBe(true);
  });
});
