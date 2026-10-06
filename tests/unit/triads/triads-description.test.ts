import { afterEach, describe, expect, it } from 'vitest';
import { STANDARD_GUITAR, withPresentation } from '../../../src/lib/instrument/instrument';
import {
  overwriteNotationSource,
  resetNotationSourceForTests
} from '../../../src/lib/notation/notation';
import { overwriteGetLocale } from '../../../src/lib/paraglide/runtime.js';
import { presetInstrument } from '../../../src/lib/instrument/tunings';
import { describeView } from '../../../src/lib/fretboard/description';
import { buildTriadsModel } from '../../../src/lib/state/triads-model';
import {
  initialTriadsView,
  selectRoot,
  setInversion,
  setStringSet,
  switchSpelling
} from '../../../src/lib/state/triads-view';

const A_FIRST_432 = setInversion(
  setStringSet(selectRoot(initialTriadsView(STANDARD_GUITAR), 9), 4, STANDARD_GUITAR),
  'first'
);
const text = (s = A_FIRST_432, i = STANDARD_GUITAR) => {
  const d = buildTriadsModel(s, i);
  return d.model.description ?? describeView(i, d.model);
};

afterEach(() => {
  overwriteGetLocale(() => 'en');
  resetNotationSourceForTests();
});

describe('Triads description (FR-003)', () => {
  it('A major, first inversion, strings 4-3-2 reads the exact sentence', () => {
    const d = buildTriadsModel(A_FIRST_432, STANDARD_GUITAR);
    expect(d.model.wideStretch).toBeFalsy();
    expect(text()).toBe(
      'A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root.'
    );
  });

  it('appends "Wide stretch." and sets wideStretch for a wide shape', () => {
    const dropD = presetInstrument('AF-4', 6, 22);
    const s = setStringSet(initialTriadsView(dropD), 6, dropD);
    const d = buildTriadsModel(s, dropD);
    expect(d.model.wideStretch).toBe(true);
    expect(d.model.description?.endsWith(' Wide stretch.')).toBe(true);
  });

  it('reads in Portuguese with solfège', () => {
    overwriteGetLocale(() => 'pt-BR');
    overwriteNotationSource(() => ({ notation: 'solfege', accidentals: 'both' }));
    const t = text();
    expect(t).toMatch(/^Lá maior, primeira inversão, cordas 4, 3, e 2: corda 4, casa 11, /);
    expect(t).toContain('Dó sustenido');
  });

  it('spells double sharps in full', () => {
    const base = setStringSet(
      selectRoot(initialTriadsView(STANDARD_GUITAR), 3),
      3,
      STANDARD_GUITAR
    );
    expect(text(switchSpelling(base))).toContain('F double sharp');
  });

  it('is identical for left-handed and strings-on-top instruments', () => {
    const base = text();
    const left = withPresentation(STANDARD_GUITAR, 'left', 'highest-top');
    const top = withPresentation(STANDARD_GUITAR, 'right', 'lowest-top');
    expect(text(A_FIRST_432, left)).toBe(base);
    expect(text(A_FIRST_432, top)).toBe(base);
  });
});
