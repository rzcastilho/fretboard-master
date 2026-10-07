// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { buildTriadsModel } from '../../../src/lib/state/triads-model';
import {
  initialTriadsView,
  selectRoot,
  setInversion,
  setQuality,
  setView
} from '../../../src/lib/state/triads-view';
import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';
import { notation, resetNotationForTests } from '../../../src/lib/state/notation.svelte';

const initial = initialTriadsView(STANDARD_GUITAR);
const summary = (s: ReturnType<typeof initialTriadsView>) =>
  buildTriadsModel(s, STANDARD_GUITAR).summary;

beforeEach(() => {
  resetLanguageForTests();
  resetNotationForTests();
  notation.start({ notation: null, accidentals: 'sharps' });
});
afterEach(() => {
  resetLanguageForTests();
  resetNotationForTests();
});

describe('TriadsDisplay.summary', () => {
  it('names chord, inversion and notes low to high (sharps)', () => {
    const s = setInversion(selectRoot(setQuality(initial, 'major'), 9), 'first');
    expect(summary(s)).toBe('A major · 1st inversion · C♯ – E – A');
  });

  it('root position lists the notes root, third, fifth', () => {
    expect(summary(initial)).toBe('C major · Root position · C – E – G');
  });

  it('all notes drops the inversion', () => {
    expect(summary(setView(initial, 'all-notes'))).toBe('C major · C – E – G');
  });

  it('uses solfège names when that notation is chosen', () => {
    notation.choose('solfege');
    expect(summary(initial)).toBe('Do major · Root position · Do – Mi – Sol');
  });

  it('is localised', () => {
    language.start('pt-BR');
    expect(summary(initial)).toContain(' · ');
    expect(summary(initial)).toContain('C – E – G');
  });
});
