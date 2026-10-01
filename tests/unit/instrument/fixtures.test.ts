import { describe, expect, it } from 'vitest';
import {
  AF_21,
  AF_7,
  INSTRUMENT_FIXTURES,
  fixtureInstrument
} from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';

const names = (i: {
  openStrings: readonly { letter: string; accidental: number; octave: number }[];
}) =>
  i.openStrings.map(
    (s) => `${s.letter}${s.accidental === 0 ? '' : s.accidental > 0 ? '#' : 'b'}${s.octave}`
  );

describe('instrument fixtures (contracts/test-hooks.md)', () => {
  it('AF-7 is DADGAD with 22 frets', () => {
    expect(names(AF_7)).toEqual(['D4', 'A3', 'G3', 'D3', 'A2', 'D2']);
    expect(AF_7.stringCount).toBe(6);
    expect(AF_7.fretCount).toBe(22);
  });

  it('AF-21 is 7-string standard with 22 frets', () => {
    expect(names(AF_21)).toEqual(['E4', 'B3', 'G3', 'D3', 'A2', 'E2', 'B1']);
    expect(AF_21.stringCount).toBe(7);
    expect(AF_21.fretCount).toBe(22);
  });

  it('lookup is allow-listed and falls back to the default without throwing', () => {
    expect(fixtureInstrument('AF-7')).toBe(AF_7);
    expect(fixtureInstrument('AF-21')).toBe(AF_21);
    for (const bad of [undefined, 'nope', '__proto__', 'toString', 'constructor', 7, null]) {
      expect(fixtureInstrument(bad)).toBe(STANDARD_GUITAR);
    }
    expect(Object.keys(INSTRUMENT_FIXTURES).sort()).toEqual(['AF-21', 'AF-7']);
  });

  it('useInstrument revalidates: 7 strings kept, switching back drops string 7, keeps selection', () => {
    resetPlaybackForTests();
    resetNotesForTests();
    notes.toggleNote(2);
    notes.useInstrument(AF_21);
    expect(notes.state.activeStrings).toEqual([1, 2, 3, 4, 5, 6]);
    notes.toggleString(7);
    expect(notes.state.activeStrings).toEqual([1, 2, 3, 4, 5, 6, 7]);
    notes.useInstrument(STANDARD_GUITAR);
    expect(notes.state.activeStrings).toEqual([1, 2, 3, 4, 5, 6]);
    expect(notes.state.selection).toEqual([2]);
  });
});
