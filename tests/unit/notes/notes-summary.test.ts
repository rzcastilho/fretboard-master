// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { buildNotesModel } from '../../../src/lib/state/notes-model';
import {
  initialNotesView,
  openCard,
  setRegionEnd,
  setRegionStart,
  toggleNote
} from '../../../src/lib/state/notes-view';
import { notation, resetNotationForTests } from '../../../src/lib/state/notation.svelte';
import { resetLanguageForTests } from '../../../src/lib/state/language.svelte';

const INIT = initialNotesView(STANDARD_GUITAR);
const summary = (s: typeof INIT) => buildNotesModel(s, STANDARD_GUITAR).summary;

beforeEach(() => {
  resetLanguageForTests();
  resetNotationForTests();
  notation.start({ notation: null, accidentals: 'sharps' });
});
afterEach(() => {
  resetLanguageForTests();
  resetNotationForTests();
});

describe('NotesDisplay.summary', () => {
  it('says no notes selected when the selection is empty', () => {
    expect(summary(INIT)).toBe('No notes selected');
  });

  it('lists the notes and the position count', () => {
    const s = [0, 4].reduce(toggleNote, INIT);
    const count = buildNotesModel(s, STANDARD_GUITAR).highlightedCount;
    expect(summary(s)).toBe(`C – E · ${count} positions`);
  });

  it('uses the singular for a single position', () => {
    // Fret 1 only: the B string's fret 1 is the one C in the region.
    const one = toggleNote(INIT, 0);
    const s = setRegionEnd(setRegionStart(one, 1, STANDARD_GUITAR), 1, STANDARD_GUITAR);
    expect(summary(s)).toBe('C · 1 position');
  });

  it('names the selected position when a card is open', () => {
    const s = openCard(toggleNote(INIT, 0), { string: 2, fret: 1 });
    expect(summary(s)).toBe('C · C4');
  });

  it('uses sharps for altered notes and solfège when chosen', () => {
    const s = toggleNote(toggleNote(INIT, 1), 4);
    expect(summary(s)).toMatch(/^C♯ – E · /);
    notation.choose('solfege');
    expect(summary(s)).toMatch(/^Do♯ – Mi · /);
  });
});
