import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { decodeLink, encodeLink, type LinkInstrument, type ShareSnapshot } from '$lib/link';
import { OFFSET_MAX, OFFSET_MIN } from '$lib/instrument/custom-tuning';
import {
  MAX_FRETS,
  MIN_FRETS,
  equalsTuning,
  presetsFor,
  tuningFromOffsets,
  tuningInstrument,
  type StringCount,
  type Tuning
} from '$lib/instrument/tunings';
import type { Instrument } from '$lib/instrument/instrument';
import { QUALITIES, isAlteredRoot } from '$lib/theory/triad';
import { INVERSIONS } from '$lib/theory/triad-shape';
import { CAGED_CYCLE } from '$lib/theory/caged';
import {
  equalsNotesView,
  revalidate as revalidateNotes,
  type NotesViewState
} from '$lib/state/notes-view';
import {
  TRIADS_VIEWS,
  equalsTriadsView,
  revalidate as revalidateTriads,
  type TriadsViewState
} from '$lib/state/triads-view';
import { equalsCagedView, type CagedViewState } from '$lib/state/caged-view';

const ORIGIN = 'https://fretboard.example';
const RUNS = 500;

/* ---------- arbitraries (valid snapshots only) ---------- */

const arbTuning = (count: StringCount): fc.Arbitrary<Tuning> =>
  fc.oneof(
    fc.constantFrom(...presetsFor(count)).map((id): Tuning => ({ kind: 'preset', id })),
    fc
      .array(fc.integer({ min: OFFSET_MIN, max: OFFSET_MAX }), {
        minLength: count,
        maxLength: count
      })
      .map((o) => tuningFromOffsets(o))
  );

const arbInstrument: fc.Arbitrary<LinkInstrument> = fc
  .constantFrom<StringCount>(6, 7)
  .chain((stringCount) =>
    fc.record({
      stringCount: fc.constant(stringCount),
      tuning: arbTuning(stringCount),
      fretCount: fc.integer({ min: MIN_FRETS, max: MAX_FRETS })
    })
  );

const instOf = (i: LinkInstrument): Instrument =>
  tuningInstrument(i.tuning, i.stringCount, i.fretCount);

const arbNotes: fc.Arbitrary<ShareSnapshot> = arbInstrument.chain((instrument) => {
  const inst = instOf(instrument);
  const strings = Array.from({ length: instrument.stringCount }, (_, k) => k + 1);
  return fc
    .record({
      selection: fc.shuffledSubarray(
        Array.from({ length: 12 }, (_, k) => k),
        { minLength: 0, maxLength: 12 }
      ),
      labelType: fc.constantFrom('name', 'octave', 'none'),
      background: fc.constantFrom('naturals', 'all', 'none'),
      hideNames: fc.boolean(),
      activeStrings: fc.subarray(strings, { minLength: 1 }),
      a: fc.integer({ min: 0, max: instrument.fretCount }),
      b: fc.integer({ min: 0, max: instrument.fretCount }),
      cardString: fc.integer({ min: 1, max: instrument.stringCount }),
      cardFret: fc.integer({ min: 0, max: instrument.fretCount }),
      hasCard: fc.boolean()
    })
    .map((r): ShareSnapshot => {
      const view: NotesViewState = revalidateNotes(
        {
          selection: r.selection,
          labelType: r.labelType,
          background: r.background,
          hideNames: r.hideNames,
          activeStrings: r.activeStrings,
          region: { start: Math.min(r.a, r.b), end: Math.max(r.a, r.b) },
          card: r.hasCard ? { string: r.cardString, fret: r.cardFret } : null
        },
        inst
      );
      return { tool: 'notes', view, instrument };
    });
});

const arbTriads: fc.Arbitrary<ShareSnapshot> = arbInstrument.chain((instrument) => {
  const inst = instOf(instrument);
  return fc
    .record({
      rootPc: fc.integer({ min: 0, max: 11 }),
      override: fc.constantFrom('none', 'sharp', 'flat'),
      quality: fc.constantFrom(...QUALITIES),
      inversion: fc.constantFrom(...INVERSIONS),
      stringSet: fc.integer({ min: 3, max: instrument.stringCount }),
      labelType: fc.constantFrom('interval', 'name'),
      occurrence: fc.integer({ min: 0, max: 5 }),
      view: fc.constantFrom(...TRIADS_VIEWS),
      cq: fc.constantFrom(null, ...QUALITIES),
      cmpOn: fc.boolean()
    })
    .map((r): ShareSnapshot => {
      const cq = r.cq === r.quality ? null : r.cq;
      const on = r.cmpOn && cq !== null && r.view !== 'all-notes';
      const view: TriadsViewState = revalidateTriads(
        {
          rootPc: r.rootPc,
          spellingOverride: isAlteredRoot(r.rootPc) ? r.override : 'none',
          quality: r.quality,
          inversion: r.inversion,
          stringSet: r.stringSet,
          labelType: r.labelType,
          occurrence: r.occurrence,
          view: r.view,
          compare: { on, quality: cq }
        },
        inst
      );
      return { tool: 'triads', view, instrument };
    });
});

const arbCaged: fc.Arbitrary<ShareSnapshot> = arbInstrument.chain((instrument) =>
  fc
    .record({
      rootPc: fc.integer({ min: 0, max: 11 }),
      override: fc.constantFrom('none', 'sharp', 'flat'),
      quality: fc.constantFrom('major', 'minor'),
      focus: fc.option(
        fc.record({
          letter: fc.constantFrom(...CAGED_CYCLE),
          ordinal: fc.integer({ min: 0, max: 3 })
        }),
        { nil: null }
      ),
      layerBits: fc.integer({ min: 1, max: 31 }),
      connections: fc.boolean(),
      triadSet: fc.integer({ min: 3, max: instrument.stringCount }),
      withSet: fc.boolean(),
      labelType: fc.constantFrom('interval', 'name'),
      temporary: fc.boolean()
    })
    .map((r): ShareSnapshot => {
      const layers = {
        chord: (r.layerBits & 1) !== 0,
        arpeggio: (r.layerBits & 2) !== 0,
        pentatonic: (r.layerBits & 4) !== 0,
        scale: (r.layerBits & 8) !== 0,
        triad: (r.layerBits & 16) !== 0
      };
      const view: CagedViewState = {
        rootPc: r.rootPc,
        spellingOverride: isAlteredRoot(r.rootPc) ? r.override : 'none',
        quality: r.quality,
        focus: r.focus,
        connections: r.connections,
        layers,
        triadSet: layers.triad && r.withSet ? r.triadSet : null,
        labelType: r.labelType
      };
      return { tool: 'caged', view, instrument, temporary: r.temporary };
    })
);

const TOOLS = { notes: arbNotes, triads: arbTriads, caged: arbCaged } as const;

/* ---------- equality under the tools' own rules ---------- */

const sameInstrument = (a: LinkInstrument, b: LinkInstrument): boolean =>
  a.stringCount === b.stringCount &&
  a.fretCount === b.fretCount &&
  equalsTuning(a.tuning, b.tuning);

function sameSnapshot(a: ShareSnapshot, b: ShareSnapshot): boolean {
  if (!sameInstrument(a.instrument, b.instrument)) return false;
  if (a.tool === 'notes' && b.tool === 'notes') return equalsNotesView(a.view, b.view);
  if (a.tool === 'triads' && b.tool === 'triads') return equalsTriadsView(a.view, b.view);
  if (a.tool === 'caged' && b.tool === 'caged') {
    return a.temporary === b.temporary && equalsCagedView(a.view, b.view);
  }
  return false;
}

/* ---------- properties ---------- */

describe('link round trip (SC-002)', () => {
  for (const tool of ['notes', 'triads', 'caged'] as const) {
    it(`${tool}: decode(encode(s)) equals s with no fallbacks`, () => {
      fc.assert(
        fc.property(TOOLS[tool], (s) => {
          const link = encodeLink(s, ORIGIN);
          expect(link.length).toBeLessThan(1000);
          expect(decodeLink(new URL(link))).toEqual({ kind: 'ok', snapshot: s, fellBack: [] });
        }),
        { numRuns: RUNS }
      );
    });
  }
});

describe('link canonical form (E1, SC-003)', () => {
  for (const tool of ['notes', 'triads', 'caged'] as const) {
    it(`${tool}: snapshots are equal iff their links are equal`, () => {
      const pair = fc.tuple(
        TOOLS[tool],
        TOOLS[tool],
        fc.boolean() // true: compare a with a rebuilt-from-decode copy, false: with the independent b
      );
      fc.assert(
        fc.property(pair, ([a, b, useCopy]) => {
          let other = b;
          if (useCopy) {
            const r = decodeLink(new URL(encodeLink(a, ORIGIN)));
            if (r.kind !== 'ok') throw new Error('decode failed');
            other = r.snapshot;
          }
          expect(encodeLink(a, ORIGIN) === encodeLink(other, ORIGIN)).toBe(sameSnapshot(a, other));
        }),
        { numRuns: RUNS }
      );
    });
  }

  it('encoding is deterministic', () => {
    fc.assert(
      fc.property(fc.oneof(arbNotes, arbTriads, arbCaged), (s) => {
        expect(encodeLink(s, ORIGIN)).toBe(encodeLink(s, ORIGIN));
      }),
      { numRuns: 200 }
    );
  });
});
