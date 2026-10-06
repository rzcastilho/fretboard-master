import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { encodeLink, readReceivedLink, type LinkInstrument, type ShareSnapshot } from '$lib/link';
import { OFFSET_MAX, OFFSET_MIN } from '$lib/instrument/custom-tuning';
import {
  MAX_FRETS,
  MIN_FRETS,
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
import { revalidate as revalidateNotes, type NotesViewState } from '$lib/state/notes-view';
import {
  TRIADS_VIEWS,
  revalidate as revalidateTriads,
  type TriadsViewState
} from '$lib/state/triads-view';
import type { CagedViewState } from '$lib/state/caged-view';

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

const STORED: LinkInstrument = {
  stringCount: 6,
  tuning: { kind: 'preset', id: 'AF-1' },
  fretCount: 22
};

describe('receive properties', () => {
  it('R1: readReceivedLink never throws for arbitrary paths and queries', () => {
    const arbPath = fc.oneof(
      fc.constantFrom('/', '/notes', '/triads', '/caged', '/caged/', '/about', '/scales'),
      fc.string({ maxLength: 40 }).map((s) => '/' + encodeURIComponent(s))
    );
    const arbQuery = fc.oneof(
      fc.constant(''),
      fc.string({ maxLength: 200 }).map((s) => '?' + s),
      fc
        .array(fc.tuple(fc.string({ maxLength: 6 }), fc.string({ maxLength: 30 })), {
          maxLength: 12
        })
        .map(
          (kv) =>
            '?' + kv.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
        )
    );
    fc.assert(
      fc.property(arbPath, arbQuery, (path, query) => {
        const url = new URL(ORIGIN + path + query);
        const r = readReceivedLink(url, STORED);
        expect(['none', 'unknown-tool', 'tool']).toContain(r.kind);
      }),
      { numRuns: RUNS }
    );
  });

  for (const tool of ['notes', 'triads', 'caged'] as const) {
    it(`R2 ${tool}: a link of a snapshot opens as exactly that snapshot`, () => {
      fc.assert(
        fc.property(TOOLS[tool], (s) => {
          const r = readReceivedLink(new URL(encodeLink(s, ORIGIN)), s.instrument);
          expect(r).toEqual({ kind: 'tool', snapshot: s, fellBack: [], forcedNotice: false });
        }),
        { numRuns: RUNS }
      );
    });
  }
});
