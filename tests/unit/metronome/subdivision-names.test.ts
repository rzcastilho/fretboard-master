import { describe, expect, it } from 'vitest';
import {
  subdivisionLabel,
  subdivisionName
} from '../../../src/lib/state/metronome-subdivision-names';
import type { Subdivision } from '../../../src/lib/state/metronome-settings';

const EN = [
  'Quarter notes',
  '8th notes',
  '8th Triplets',
  '16th notes',
  'Quintuplets',
  'Sextuplets',
  'Septuplets',
  '32nd notes'
];

describe('subdivision names', () => {
  it('names each of 1-8', () => {
    EN.forEach((name, i) => expect(subdivisionName((i + 1) as Subdivision)).toBe(name));
  });

  it('labels with the count', () => {
    expect(subdivisionLabel(3)).toBe('8th Triplets (3)');
  });
});
