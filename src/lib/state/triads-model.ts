/**
 * Triads display model (data-model §5). Pure + paraglide for description text.
 * Turns the view state into the fretboard `DisplayModel` and the composition facts.
 * Other `ShapeView` kinds and the composition extras are filled by later stories.
 */
import { m } from '$lib/paraglide/messages.js';
import type { DisplayModel, Marker } from '../fretboard/types';
import type { Instrument, Position } from '../instrument/instrument';
import {
  setOpenPitches,
  setStrings,
  shapePositions,
  stringSets,
  type StringSetId
} from '../instrument/string-sets';
import { defaultSpelling, spokenNote, spokenNoteList } from '../notation/notation';
import { pitchClassOfSpelling, type PitchClass, type Spelling } from '../theory/pitch';
import {
  QUALITY_LABELS,
  QUALITY_STACKING,
  doubleAccidentalNotes,
  effectiveRootSpelling,
  isAlteredRoot,
  otherRootSpelling,
  spellTriad,
  type IntervalId,
  type Quality,
  type StackingId,
  type TriadFunction,
  type TriadSpelling
} from '../theory/triad';
import {
  INVERSION_ORDER,
  isWideStretch,
  occurrences,
  span,
  triadShape,
  type Frets3,
  type Inversion
} from '../theory/triad-shape';
import type { ListenStep } from './listen';
import type { TriadsViewState } from './triads-view';

export interface NoteEntry {
  readonly function: TriadFunction;
  readonly spelling: Spelling;
}

export interface Composition {
  readonly name: {
    readonly root: Spelling;
    readonly quality: Quality;
    readonly inversion: Inversion;
  };
  /** R–3–5 order. */
  readonly notes: readonly [NoteEntry, NoteEntry, NoteEntry];
  readonly intervals: readonly [IntervalId, IntervalId, IntervalId];
  readonly stacking: StackingId;
  /** Inversion order, low → high. */
  readonly lowToHigh: readonly [NoteEntry, NoteEntry, NoteEntry];
  readonly soundsAs: readonly { readonly written: Spelling; readonly sounds: Spelling }[];
  readonly suggestion: Spelling | null;
  readonly canSwitchSpelling: boolean;
  readonly switchTo: Spelling | null;
  readonly symmetric: boolean;
  readonly characteristic: 'b5' | null;
}

export type ShapeView =
  | {
      readonly kind: 'shown';
      /** Low → high. */
      readonly positions: readonly [Position, Position, Position];
      readonly functions: readonly [TriadFunction, TriadFunction, TriadFunction];
      readonly frets: Frets3;
      readonly span: number;
      readonly wideStretch: boolean;
    }
  | { readonly kind: 'beyond'; readonly fretCount: number }
  | { readonly kind: 'does-not-close' };

export interface TriadsDisplay {
  readonly model: DisplayModel;
  readonly spelling: TriadSpelling;
  readonly rootSpelling: Spelling;
  readonly shape: ShapeView;
  readonly composition: Composition;
  readonly listen: { readonly enabled: boolean };
  readonly listenSteps: readonly ListenStep[];
  readonly octave: {
    readonly up: boolean;
    readonly down: boolean;
    readonly index: number;
    readonly count: number;
  };
  readonly anotherSet: StringSetId | null;
}

/** Re-exported so UI components never import `theory/*` directly. */
export { QUALITIES } from '../theory/triad';
export { INVERSIONS } from '../theory/triad-shape';
export type { PitchClass } from '../theory/pitch';
export type { Quality } from '../theory/triad';
export type { Inversion } from '../theory/triad-shape';

const FN_INDEX: Readonly<Record<TriadFunction, 0 | 1 | 2>> = { root: 0, third: 1, fifth: 2 };

export function qualityName(q: Quality): string {
  switch (q) {
    case 'major':
      return m.triads_quality_major();
    case 'minor':
      return m.triads_quality_minor();
    case 'diminished':
      return m.triads_quality_diminished();
    default:
      return m.triads_quality_augmented();
  }
}

export function inversionName(inv: Inversion): string {
  switch (inv) {
    case 'root':
      return m.triads_inversion_root();
    case 'first':
      return m.triads_inversion_first();
    default:
      return m.triads_inversion_second();
  }
}

export function functionName(f: TriadFunction): string {
  return f === 'root'
    ? m.triads_function_root()
    : f === 'third'
      ? m.triads_function_third()
      : m.triads_function_fifth();
}

export function stackingName(id: StackingId): string {
  switch (id) {
    case 'M3+m3':
      return m.triads_stacking_major();
    case 'm3+M3':
      return m.triads_stacking_minor();
    case 'm3+m3':
      return m.triads_stacking_diminished();
    default:
      return m.triads_stacking_augmented();
  }
}

function composition(
  spelling: TriadSpelling,
  quality: Quality,
  inversion: Inversion,
  rootPc: PitchClass
): Composition {
  const entry = (f: TriadFunction): NoteEntry => ({
    function: f,
    spelling: spelling[f]
  });
  const order = INVERSION_ORDER[inversion];
  const other = otherRootSpelling(rootPc, spelling.root);
  // C4: altered root, current triad has a double accidental, the other spelling has none.
  const suggestion =
    other !== null &&
    doubleAccidentalNotes(spelling).length > 0 &&
    doubleAccidentalNotes(spellTriad(other, quality)).length === 0
      ? other
      : null;
  return {
    name: { root: spelling.root, quality, inversion },
    notes: [entry('root'), entry('third'), entry('fifth')],
    intervals: QUALITY_LABELS[quality],
    stacking: QUALITY_STACKING[quality],
    lowToHigh: [entry(order[0]), entry(order[1]), entry(order[2])],
    soundsAs: doubleAccidentalNotes(spelling).map((n) => ({
      written: n.spelling,
      sounds: defaultSpelling(pitchClassOfSpelling(n.spelling))
    })),
    suggestion,
    canSwitchSpelling: isAlteredRoot(rootPc),
    switchTo: other,
    symmetric: quality === 'augmented',
    characteristic: quality === 'diminished' ? 'b5' : null
  };
}

/**
 * C11: the nearest string set on which the current triad closes, searching from the
 * current set in bass → treble order: +1 (treble), −1 (bass), +2, −2, …; `null` when none.
 */
export function nearestClosingSet(s: TriadsViewState, i: Instrument): StringSetId | null {
  const sets = stringSets(i);
  const at = sets.indexOf(s.stringSet);
  if (at < 0) return null;
  const rootSpelling = effectiveRootSpelling(s.rootPc, s.spellingOverride, s.quality);
  const triad = spellTriad(rootSpelling, s.quality);
  const closes = (id: StringSetId): boolean =>
    triadShape(setOpenPitches(i, id), triad, s.inversion).kind === 'shape';
  for (let step = 1; step < sets.length; step++) {
    for (const k of [at + step, at - step]) {
      const id = sets[k];
      if (id !== undefined && closes(id)) return id;
    }
  }
  return null;
}

export function buildTriadsModel(s: TriadsViewState, instrument: Instrument): TriadsDisplay {
  const rootSpelling = effectiveRootSpelling(s.rootPc, s.spellingOverride, s.quality);
  const spelling = spellTriad(rootSpelling, s.quality);
  const comp = composition(spelling, s.quality, s.inversion, s.rootPc);
  const result = triadShape(setOpenPitches(instrument, s.stringSet), spelling, s.inversion);

  const display = {
    spelling,
    rootSpelling,
    composition: comp,
    listen: { enabled: false },
    listenSteps: [] as readonly ListenStep[],
    octave: { up: false, down: false, index: 0, count: 0 },
    anotherSet: null
  };

  const labelMode = s.labelType === 'interval' ? 'interval' : 'note';
  const name = m.triads_name({
    root: spokenNote(rootSpelling),
    quality: qualityName(s.quality),
    inversion: inversionName(s.inversion)
  });

  if (result.kind === 'does-not-close') {
    return {
      ...display,
      anotherSet: nearestClosingSet(s, instrument),
      shape: { kind: 'does-not-close' },
      model: {
        markers: [],
        labelMode,
        summary: m.triads_desc_does_not_close({ name })
      }
    };
  }

  const occs = occurrences(result.frets, instrument.fretCount);
  if (occs.length === 0) {
    return {
      ...display,
      shape: { kind: 'beyond', fretCount: instrument.fretCount },
      model: {
        markers: [],
        labelMode,
        summary: m.triads_desc_beyond({ name, fret: instrument.fretCount })
      }
    };
  }
  const index = Math.max(0, Math.min(s.occurrence, occs.length - 1));
  const frets: Frets3 = occs[index] ?? result.frets;
  const octave = {
    up: index < occs.length - 1,
    down: occs.length > 0 && index > 0,
    index,
    count: occs.length
  };

  const positions = shapePositions(s.stringSet, frets);
  const labels = QUALITY_LABELS[s.quality];
  const markers: Marker[] = positions.map((p, k) => {
    const fn = result.functions[k];
    return {
      string: p.string,
      fret: p.fret,
      function: fn,
      emphasis: 'highlighted',
      spelling: spelling[fn],
      interval: labels[FN_INDEX[fn]]
    };
  });

  const wide = isWideStretch(frets);
  const base = m.triads_desc_shape({
    name,
    notes: spokenNoteList([spelling.root, spelling.third, spelling.fifth]),
    strings: setStrings(s.stringSet).slice().reverse().join(', '),
    frets: frets.join(', ')
  });
  const summary = wide ? `${base} ${m.triads_desc_wide_stretch()}` : base;

  const [low, mid, high] = positions;
  // Listen: low → mid → high, then the whole block together (US7-1).
  const steps: readonly ListenStep[] = [low, mid, high, [low, mid, high]];

  return {
    ...display,
    octave,
    listen: { enabled: true },
    listenSteps: steps,
    shape: {
      kind: 'shown',
      positions,
      functions: result.functions,
      frets,
      span: span(frets),
      wideStretch: wide
    },
    model: {
      markers,
      labelMode,
      summary
    }
  };
}
