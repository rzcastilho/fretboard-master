import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tuningFromOffsets } from '../../src/lib/instrument/tunings';
import type { LinkInstrument } from '../../src/lib/link/types';
import { linkNoticeMessage, linkTuningText } from '../../src/lib/shell/link-notice';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import { notation, resetNotationForTests } from '../../src/lib/state/notation.svelte';

const DROP_D: LinkInstrument = {
  stringCount: 6,
  tuning: { kind: 'preset', id: 'AF-4' },
  fretCount: 22
};
// C♯ A D G B E: custom, with one altered note to spell.
const CUSTOM: LinkInstrument = {
  stringCount: 6,
  tuning: tuningFromOffsets([-3, 0, 0, 0, 0, 0]),
  fretCount: 22
};
const SEVEN: LinkInstrument = {
  stringCount: 7,
  tuning: { kind: 'preset', id: 'AF-21' },
  fretCount: 22
};

beforeEach(() => {
  resetLanguageForTests();
  resetNotationForTests();
  language.start(null);
  notation.start({ notation: null, accidentals: 'sharps' });
});

afterEach(() => {
  resetLanguageForTests();
  resetNotationForTests();
});

describe('linkTuningText', () => {
  it('names a preset through tuningLabel', () => {
    expect(linkTuningText(DROP_D)).toBe('Drop D');
  });

  it('lists a custom tuning lowest to highest, space separated', () => {
    expect(linkTuningText(CUSTOM)).toBe('C♯ A D G B E');
  });

  it('honors the flats preference for altered custom strings', () => {
    expect(linkTuningText(CUSTOM)).toBe('C♯ A D G B E');
    notation.chooseAccidentals('flats');
    expect(linkTuningText(CUSTOM)).toBe('D♭ A D G B E');
  });

  it('honors solfège in es', () => {
    language.restore('es');
    notation.choose('solfege');
    expect(linkTuningText(CUSTOM)).toBe('Do♯ La Re Sol Si Mi');
  });

  it('honors solfège in pt-BR', () => {
    language.restore('pt-BR');
    notation.choose('solfege');
    expect(linkTuningText(CUSTOM)).toBe('Dó♯ Lá Ré Sol Si Mi');
  });
});

describe('linkNoticeMessage', () => {
  it('same string count: tuning only', () => {
    expect(linkNoticeMessage(DROP_D, 6)).toBe('This view uses Drop D');
  });

  it('different string count: count prefix', () => {
    expect(linkNoticeMessage(SEVEN, 6)).toMatch(/^This view uses 7 strings: /);
  });

  it('uses the strings variant iff the counts differ', () => {
    expect(linkNoticeMessage(SEVEN, 7)).not.toContain('strings');
  });

  it('localizes in es and pt-BR', () => {
    language.restore('es');
    expect(linkNoticeMessage(DROP_D, 6)).toMatch(/^Esta vista usa /);
    expect(linkNoticeMessage(SEVEN, 6)).toMatch(/^Esta vista usa 7 cuerdas: /);
    language.restore('pt-BR');
    expect(linkNoticeMessage(SEVEN, 6)).toMatch(/^Esta vista usa 7 cordas: /);
  });
});
