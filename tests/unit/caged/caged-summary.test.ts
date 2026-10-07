// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { buildCagedModel, cagedOccurrencesFor } from '../../../src/lib/state/caged-model';
import { initialCagedView, setFocus } from '../../../src/lib/state/caged-view';
import { notation, resetNotationForTests } from '../../../src/lib/state/notation.svelte';
import { resetLanguageForTests } from '../../../src/lib/state/language.svelte';

const CTX = { tuningName: 'Standard', temporary: false };
const build = (v: ReturnType<typeof initialCagedView>) => buildCagedModel(v, STANDARD_GUITAR, CTX);

beforeEach(() => {
  resetLanguageForTests();
  resetNotationForTests();
  notation.start({ notation: null, accidentals: 'sharps' });
});
afterEach(() => {
  resetLanguageForTests();
  resetNotationForTests();
});

describe('CagedDisplay.summary', () => {
  it('all shapes when nothing is focused', () => {
    expect(build(initialCagedView()).summary).toBe('C major · all shapes · C – E – G');
  });

  it('names the focused shape', () => {
    const v = initialCagedView();
    const occs = cagedOccurrencesFor(v, STANDARD_GUITAR);
    const a = occs.find((o) => o.shape.id === 'A');
    if (a === undefined) throw new Error('expected an A shape');
    const focused = setFocus(v, { letter: 'A', ordinal: 0 });
    expect(build(focused).summary).toBe('C major · shape A · C – E – G');
  });

  it('uses solfège names when chosen', () => {
    notation.choose('solfege');
    expect(build(initialCagedView()).summary).toBe('Do major · all shapes · Do – Mi – Sol');
  });
});
