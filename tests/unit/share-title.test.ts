import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ShareSnapshot } from '../../src/lib/link';
import { shareTitle } from '../../src/lib/shell/share-title';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import { notation, resetNotationForTests } from '../../src/lib/state/notation.svelte';
import { initialCagedView, type CagedViewState } from '../../src/lib/state/caged-view';
import { initialTriadsView, type TriadsViewState } from '../../src/lib/state/triads-view';
import { initialNotesView, type NotesViewState } from '../../src/lib/state/notes-view';
import { STANDARD_GUITAR } from '../../src/lib/instrument/instrument';
import { QUALITIES } from '../../src/lib/theory/triad';
import { INVERSIONS } from '../../src/lib/theory/triad-shape';
import type { LanguageTag } from '../../src/lib/i18n/languages';
import type { AccidentalPolicy, Notation } from '../../src/lib/notation/policy';

const INSTRUMENT = {
  stringCount: 6,
  tuning: { kind: 'preset', id: 'AF-1' },
  fretCount: 22
} as const;

const caged = (patch: Partial<CagedViewState>): ShareSnapshot => ({
  tool: 'caged',
  view: { ...initialCagedView(), ...patch },
  instrument: INSTRUMENT,
  temporary: false
});
const triads = (patch: Partial<TriadsViewState>): ShareSnapshot => ({
  tool: 'triads',
  view: { ...initialTriadsView(STANDARD_GUITAR), ...patch },
  instrument: INSTRUMENT
});
const notes = (patch: Partial<NotesViewState>): ShareSnapshot => ({
  tool: 'notes',
  view: { ...initialNotesView(STANDARD_GUITAR), ...patch },
  instrument: INSTRUMENT
});

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

describe('shareTitle (en, letters, sharps)', () => {
  it('CAGED with a focused shape', () => {
    expect(
      shareTitle(caged({ rootPc: 9, quality: 'minor', focus: { letter: 'E', ordinal: 0 } }))
    ).toBe('A minor — CAGED, E shape');
  });

  it('CAGED without a focus', () => {
    expect(shareTitle(caged({ rootPc: 9, quality: 'minor', focus: null }))).toBe('A minor — CAGED');
  });

  it('Triads in root position', () => {
    expect(shareTitle(triads({ rootPc: 0, quality: 'major', inversion: 'root' }))).toBe(
      'C major — Triads, root position'
    );
  });

  it('Notes lists the selection in first-selected order', () => {
    expect(shareTitle(notes({ selection: [0, 4, 7] }))).toBe('C, E, G — Notes');
    expect(shareTitle(notes({ selection: [7, 0] }))).toBe('G, C — Notes');
  });

  it('Notes with an empty selection', () => {
    expect(shareTitle(notes({ selection: [] }))).toBe('Notes');
  });
});

describe('shareTitle matrix', () => {
  const SNAPSHOTS: readonly ShareSnapshot[] = [
    caged({}),
    caged({ rootPc: 1, quality: 'minor', focus: { letter: 'A', ordinal: 1 } }),
    ...QUALITIES.flatMap((quality) =>
      INVERSIONS.flatMap((inversion) =>
        [0, 1, 6, 10].map((rootPc) => triads({ rootPc, quality, inversion }))
      )
    ),
    notes({ selection: [] }),
    notes({ selection: [1] }),
    notes({ selection: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
  ];
  const LOCALES: readonly LanguageTag[] = ['en', 'es', 'pt-BR'];
  const NOTATIONS: readonly Notation[] = ['letters', 'solfege'];
  const POLICIES: readonly AccidentalPolicy[] = ['sharps', 'flats', 'both'];

  it.each(
    LOCALES.flatMap((l) => NOTATIONS.flatMap((n) => POLICIES.map((p) => [l, n, p] as const)))
  )(
    '%s / %s / %s: never empty, no undefined, no dangling separators',
    (locale, notationChoice, policy) => {
      language.restore(locale);
      notation.restore(notationChoice, policy);
      for (const snapshot of SNAPSHOTS) {
        const title = shareTitle(snapshot);
        expect(title.trim()).not.toBe('');
        expect(title).not.toContain('undefined');
        expect(title).not.toMatch(/\{|\}/);
        expect(title).not.toMatch(/[—,]\s*$/);
        expect(title).not.toMatch(/^\s*[—,]/);
        expect(title).not.toMatch(/,\s*,/);
        expect(title).not.toMatch(/—\s*—/);
        expect(title).not.toMatch(/\s{2,}/);
      }
    }
  );

  it('is translated: es and pt-BR differ from en', () => {
    const snap = triads({ rootPc: 0, quality: 'major', inversion: 'first' });
    const en = shareTitle(snap);
    language.restore('es');
    expect(shareTitle(snap)).toBe('Do mayor — Tríadas, 1.ª inversión');
    language.restore('pt-BR');
    expect(shareTitle(snap)).toBe('C maior — Tríades, 1ª inversão');
    expect(en).toBe('C major — Triads, 1st inversion');
  });

  it('follows notation and accidental policy (sharer settings)', () => {
    notation.restore('solfege', 'sharps');
    expect(shareTitle(notes({ selection: [0, 4, 7] }))).toBe('Do, Mi, Sol — Notes');
  });
});

describe('FR-015: the title derives from the same snapshot as the link', () => {
  it('two snapshots that differ only in the view give different titles', () => {
    expect(shareTitle(triads({ rootPc: 0 }))).not.toBe(shareTitle(triads({ rootPc: 2 })));
    expect(shareTitle(caged({ rootPc: 0 }))).not.toBe(shareTitle(caged({ rootPc: 2 })));
  });

  it('ignores instrument and other non-title fields', () => {
    const a = triads({ rootPc: 0 });
    const b = { ...a, instrument: { ...INSTRUMENT, fretCount: 12 } } as ShareSnapshot;
    expect(shareTitle(a)).toBe(shareTitle(b));
  });
});
