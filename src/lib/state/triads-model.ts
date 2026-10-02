/**
 * Triads display model (data-model §5). Pure + paraglide for description text.
 * Turns the view state into the fretboard `DisplayModel` and the composition facts.
 * Other `ShapeView` kinds and the composition extras are filled by later stories.
 */
import { m } from '$lib/paraglide/messages.js';
import type { DisplayModel, FretboardTag, Marker } from '../fretboard/types';
import {
  lowestPositionOfPitch,
  positionPitch,
  type Instrument,
  type Position
} from '../instrument/instrument';
import {
  setOpenPitches,
  setStrings,
  shapePositions,
  stringSets,
  type StringSetId
} from '../instrument/string-sets';
import { defaultSpelling, spokenNote, spokenNoteList } from '../notation/notation';
import {
  pitchClassOfSpelling,
  pitchOfSpelling,
  type PitchClass,
  type Spelling
} from '../theory/pitch';
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
  inversionChain,
  isWideStretch,
  occurrences,
  span,
  triadShape,
  type Frets3,
  type Inversion
} from '../theory/triad-shape';
import type { ListenStep } from './listen';
import type { TriadsView, TriadsViewState } from './triads-view';

export interface NoteEntry {
  readonly function: TriadFunction;
  readonly spelling: Spelling;
}

export interface Composition {
  readonly name: {
    readonly root: Spelling;
    readonly quality: Quality;
    /** `null` in All notes (C10). */
    readonly inversion: Inversion | null;
  };
  /** R–3–5 order. */
  readonly notes: readonly [NoteEntry, NoteEntry, NoteEntry];
  readonly intervals: readonly [IntervalId, IntervalId, IntervalId];
  readonly stacking: StackingId;
  /** Inversion order, low → high; `null` in All notes (C10). */
  readonly lowToHigh: readonly [NoteEntry, NoteEntry, NoteEntry] | null;
  readonly soundsAs: readonly { readonly written: Spelling; readonly sounds: Spelling }[];
  readonly suggestion: Spelling | null;
  readonly canSwitchSpelling: boolean;
  readonly switchTo: Spelling | null;
  readonly symmetric: boolean;
  readonly characteristic: 'b5' | null;
}

/** One shape of the Full neck chain (data-model §4). */
export interface ChainShapeView {
  /** `${inversion}:${octave}` — stable tag id. */
  readonly id: string;
  readonly inversion: Inversion;
  readonly octave: number;
  /** Low → high. */
  readonly positions: readonly [Position, Position, Position];
  readonly functions: readonly [TriadFunction, TriadFunction, TriadFunction];
  readonly frets: Frets3;
  readonly span: number;
  readonly wideStretch: boolean;
  /** inversion === state.inversion (C3). */
  readonly selected: boolean;
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
  | { readonly kind: 'chain'; readonly shapes: readonly ChainShapeView[] }
  | { readonly kind: 'all-notes' }
  | { readonly kind: 'beyond'; readonly fretCount: number }
  | { readonly kind: 'does-not-close' };

export interface TriadsDisplay extends DisplayBody {
  /** Guidance shown outside All notes: offer the See all notes recovery action (C8). */
  readonly seeAllNotes: boolean;
}

interface DisplayBody {
  readonly view: TriadsView;
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
    /** Octave commands apply only in Isolated (C4). */
    readonly applies: boolean;
  };
  /** Enabled flags of the inversion and string-set controls (FR-010). */
  readonly controls: { readonly inversion: boolean; readonly stringSet: boolean };
  readonly anotherSet: StringSetId | null;
}

/** Re-exported so UI components never import `theory/*` directly. */
export { TRIADS_VIEWS } from './triads-view';
export type { TriadsView } from './triads-view';
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
  inversion: Inversion | null,
  rootPc: PitchClass
): Composition {
  const entry = (f: TriadFunction): NoteEntry => ({
    function: f,
    spelling: spelling[f]
  });
  const order = inversion === null ? null : INVERSION_ORDER[inversion];
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
    lowToHigh: order === null ? null : [entry(order[0]), entry(order[1]), entry(order[2])],
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

const TAG_LABEL: Readonly<Record<Inversion, () => string>> = {
  root: () => m.triads_tag_root(),
  first: () => m.triads_tag_first(),
  second: () => m.triads_tag_second()
};

/** Maps a fretboard tag id back to its chain shape; null when the view shows no such tag. */
export function tagTarget(
  display: TriadsDisplay,
  id: string
): { inversion: Inversion; octave: number } | null {
  if (display.shape.kind !== 'chain') return null;
  const shape = display.shape.shapes.find((x) => x.id === id);
  return shape ? { inversion: shape.inversion, octave: shape.octave } : null;
}

type BaseDisplay = Pick<
  DisplayBody,
  | 'view'
  | 'spelling'
  | 'rootSpelling'
  | 'composition'
  | 'listen'
  | 'listenSteps'
  | 'octave'
  | 'controls'
  | 'anotherSet'
>;

/** Full neck derivation (data-model §4): every chain shape, selected inversion highlighted. */
function fullNeck(
  s: TriadsViewState,
  instrument: Instrument,
  base: BaseDisplay,
  spelling: TriadSpelling,
  rootSpelling: Spelling,
  labelMode: 'interval' | 'note'
): DisplayBody {
  const result = inversionChain(
    setOpenPitches(instrument, s.stringSet),
    spelling,
    instrument.fretCount
  );
  const rootName = m.triads_name_no_inversion({
    root: spokenNote(rootSpelling),
    quality: qualityName(s.quality)
  });
  if (result.kind !== 'chain') {
    const guidance =
      result.kind === 'beyond'
        ? m.triads_desc_beyond({ name: rootName, fret: instrument.fretCount })
        : m.triads_desc_does_not_close({ name: rootName });
    return {
      ...base,
      anotherSet: result.kind === 'beyond' ? null : nearestClosingSet(s, instrument),
      shape:
        result.kind === 'beyond'
          ? { kind: 'beyond', fretCount: instrument.fretCount }
          : { kind: 'does-not-close' },
      model: { markers: [], labelMode, summary: guidance }
    };
  }

  const labels = QUALITY_LABELS[s.quality];
  const shapes: ChainShapeView[] = result.shapes.map((c) => {
    const frets = c.frets;
    return {
      id: `${c.inversion}:${c.octave}`,
      inversion: c.inversion,
      octave: c.octave,
      positions: shapePositions(s.stringSet, frets),
      functions: c.functions,
      frets,
      span: span(frets),
      wideStretch: isWideStretch(frets),
      selected: c.inversion === s.inversion
    };
  });

  const markerOf = (shape: ChainShapeView): Marker[] =>
    shape.positions.map((p, k) => {
      const fn = shape.functions[k];
      return {
        string: p.string,
        fret: p.fret,
        function: fn,
        emphasis: shape.selected ? 'highlighted' : 'normal',
        spelling: spelling[fn],
        interval: labels[FN_INDEX[fn]]
      };
    });
  // Highlighted first so a shared position keeps the highlighted marker (R-07).
  const markers = [
    ...shapes.filter((x) => x.selected).flatMap(markerOf),
    ...shapes.filter((x) => !x.selected).flatMap(markerOf)
  ];

  const tags: FretboardTag[] = shapes.map((x) => {
    const label = TAG_LABEL[x.inversion]();
    const name = m.triads_tag_name({
      inversion: inversionName(x.inversion),
      frets: x.frets.join('-')
    });
    return {
      id: x.id,
      start: Math.min(...x.frets),
      end: Math.max(...x.frets),
      label,
      name: x.wideStretch ? `${name}${m.triads_desc_chain_wide()}` : name,
      pressed: x.selected,
      ...(x.wideStretch ? { detail: m.triads_tag_wide_stretch() } : {})
    };
  });

  const description = m.triads_desc_full_neck({
    name: rootName,
    strings: setStrings(s.stringSet).slice().reverse().join(', '),
    shapes: shapes
      .map(
        (x) =>
          m.triads_desc_chain_entry({
            inversion: TAG_LABEL[x.inversion](),
            frets: x.frets.join('-')
          }) + (x.wideStretch ? m.triads_desc_chain_wide() : '')
      )
      .join('; '),
    inversion: inversionName(s.inversion)
  });

  const selected = shapes.filter((x) => x.selected);
  // Listen (C11): every chain shape in order, three notes low → high then the chord.
  const steps: readonly ListenStep[] = shapes.flatMap((x) => [...x.positions, [...x.positions]]);

  return {
    ...base,
    octave: {
      up: false,
      down: false,
      index: Math.max(0, s.occurrence),
      count: selected.length,
      applies: false
    },
    listen: { enabled: steps.length > 0 },
    listenSteps: steps,
    shape: { kind: 'chain', shapes },
    model: {
      markers,
      labelMode,
      tags,
      autoScroll: {
        key: `full-neck|${s.stringSet}|${s.rootPc}|${s.quality}|${instrument.fretCount}`,
        groups: selected.map((x) => x.positions)
      },
      description
    }
  };
}

/**
 * All notes Listen (C12): root at the lowest pitch where it occurs, third at the nearest
 * pitch above it, fifth nearest above the third. Stops at the first unreachable note.
 */
function allNotesListenSteps(
  instrument: Instrument,
  spelling: TriadSpelling
): readonly ListenStep[] {
  const opens = instrument.openStrings.map(pitchOfSpelling);
  const lowest = Math.min(...opens);
  const nextAtOrAbove = (from: number, pc: PitchClass): number =>
    from + ((pc - (from % 12) + 12) % 12);
  const steps: Position[] = [];
  let from = lowest;
  for (const f of ['root', 'third', 'fifth'] as const) {
    const pc = pitchClassOfSpelling(spelling[f]);
    const pitch = nextAtOrAbove(from, pc);
    const p = lowestPositionOfPitch(instrument, pitch);
    if (p === null) break;
    steps.push(p);
    from = pitch + 1;
  }
  return steps;
}

/** All notes (C9, C18): every root/third/fifth position, normal emphasis, independent of the set. */
function allNotes(
  s: TriadsViewState,
  instrument: Instrument,
  base: BaseDisplay,
  spelling: TriadSpelling,
  rootSpelling: Spelling,
  labelMode: 'interval' | 'note'
): DisplayBody {
  const labels = QUALITY_LABELS[s.quality];
  const FUNCTIONS: readonly TriadFunction[] = ['root', 'third', 'fifth'];
  const byPc = new Map<PitchClass, TriadFunction>(
    FUNCTIONS.map((f) => [pitchClassOfSpelling(spelling[f]), f] as const)
  );
  const markers: Marker[] = [];
  const frets = new Map<TriadFunction, Map<number, number[]>>(
    FUNCTIONS.map((f) => [f, new Map<number, number[]>()] as const)
  );
  // String 1 is the highest; list low → high so the text reads from the bass string.
  for (let string = instrument.stringCount; string >= 1; string--) {
    for (let fret = 0; fret <= instrument.fretCount; fret++) {
      const fn = byPc.get((positionPitch(instrument, { string, fret }) % 12) as PitchClass);
      if (fn === undefined) continue;
      markers.push({
        string,
        fret,
        function: fn,
        emphasis: 'normal',
        spelling: spelling[fn],
        interval: labels[FN_INDEX[fn]]
      });
      const perString = frets.get(fn);
      perString?.set(string, [...(perString.get(string) ?? []), fret]);
    }
  }
  const name = m.triads_name_no_inversion({
    root: spokenNote(rootSpelling),
    quality: qualityName(s.quality)
  });
  const functions = FUNCTIONS.map((f) =>
    m.triads_desc_note_entry({
      note: spokenNote(spelling[f]),
      strings: [...(frets.get(f) ?? [])]
        .map(([string, list]) => m.triads_desc_string_frets({ string, frets: list.join(', ') }))
        .join('; ')
    })
  ).join('. ');
  const steps = allNotesListenSteps(instrument, spelling);
  return {
    ...base,
    listen: { enabled: steps.length > 0 },
    listenSteps: steps,
    shape: { kind: 'all-notes' },
    controls: { inversion: false, stringSet: false },
    model: {
      markers,
      labelMode,
      autoScroll: { key: 'all-notes', groups: [] },
      description: m.triads_desc_all_notes({ name, functions })
    }
  };
}

export function buildTriadsModel(s: TriadsViewState, instrument: Instrument): TriadsDisplay {
  const d = buildDisplay(s, instrument);
  const guidance = d.shape.kind === 'beyond' || d.shape.kind === 'does-not-close';
  return { ...d, seeAllNotes: guidance && s.view !== 'all-notes' };
}

function buildDisplay(s: TriadsViewState, instrument: Instrument): DisplayBody {
  const rootSpelling = effectiveRootSpelling(s.rootPc, s.spellingOverride, s.quality);
  const spelling = spellTriad(rootSpelling, s.quality);
  const comp = composition(
    spelling,
    s.quality,
    s.view === 'all-notes' ? null : s.inversion,
    s.rootPc
  );
  const result = triadShape(setOpenPitches(instrument, s.stringSet), spelling, s.inversion);

  const display = {
    view: s.view,
    spelling,
    rootSpelling,
    composition: comp,
    listen: { enabled: false },
    listenSteps: [] as readonly ListenStep[],
    octave: { up: false, down: false, index: 0, count: 0, applies: s.view === 'isolated' },
    controls: { inversion: true, stringSet: true },
    anotherSet: null
  };

  const labelMode = s.labelType === 'interval' ? 'interval' : 'note';
  if (s.view === 'all-notes') {
    return allNotes(s, instrument, display, spelling, rootSpelling, labelMode);
  }
  if (s.view === 'full-neck') {
    return fullNeck(s, instrument, display, spelling, rootSpelling, labelMode);
  }
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
    count: occs.length,
    applies: true
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
