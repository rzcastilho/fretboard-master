/**
 * Triads display model (data-model §5). Pure + paraglide for description text.
 * Turns the view state into the fretboard `DisplayModel` and the composition facts.
 * Other `ShapeView` kinds and the composition extras are filled by later stories.
 */
import { m } from '$lib/paraglide/messages.js';
import type { DisplayModel, FretboardArrow, FretboardTag, Marker } from '../fretboard/types';
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
import { defaultSpelling, noteLabel, spokenNote, spokenNoteList } from '../notation/notation';
import {
  pitchClassOfSpelling,
  pitchOfSpelling,
  type PitchClass,
  type Spelling
} from '../theory/pitch';
import {
  QUALITIES,
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
  comparisonFrets,
  inversionChain,
  isWideStretch,
  noteMoves,
  occurrences,
  pairOccurrences,
  span,
  triadShape,
  type Frets3,
  type Inversion,
  type NoteMove
} from '../theory/triad-shape';
import type { ListenStep } from './listen';
import { cagedCanShow } from './links';
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
  /** The comparison quality's composition (same inversion); `null` without a comparison. */
  readonly comparison: Composition | null;
  /** Functions whose interval differs between the two qualities (empty without a comparison). */
  readonly changed: readonly TriadFunction[];
}

/** One first triad and its comparison counterpart (data-model §4). */
export interface ComparisonPair {
  /** `'iso'` or the chain shape id. */
  readonly scope: string;
  readonly firstFrets: Frets3;
  /** May be out of range. */
  readonly comparisonFrets: Frets3;
  readonly moves: readonly NoteMove[];
  /** Moves whose `toFret` is outside the board. */
  readonly offBoard: readonly {
    readonly move: NoteMove;
    readonly edge: 'nut' | 'end';
    readonly spelling: Spelling;
  }[];
}

export interface ComparisonView {
  readonly quality: Quality;
  readonly spelling: TriadSpelling;
  /** Isolated: the pair is shown an octave above occurrence 0. */
  readonly shifted: boolean;
  /** false → fallback with off-board arrows. */
  readonly fits: boolean;
  readonly pairs: readonly ComparisonPair[];
}

export interface CompareDisplay {
  /** false in All notes. */
  readonly offered: boolean;
  readonly on: boolean;
  readonly quality: Quality | null;
  /** `QUALITIES` without the current quality, in product order (C4). */
  readonly options: readonly Quality[];
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
  readonly compare: CompareDisplay;
  /** Guidance shown outside All notes: offer the See all notes recovery action (C8). */
  readonly seeAllNotes: boolean;
  /** Listen to comparison: first triad, a rest, then the comparison triad (R-10, M9). */
  readonly listenComparison: ListenComparison;
  /** "View in CAGED" is available only for major and minor (CAGED draws no others). */
  readonly viewInCaged: { readonly enabled: boolean };
}

export interface ListenComparison {
  readonly enabled: boolean;
  /** `[first, [], comparisonOnBoard]`, or empty when disabled. */
  readonly steps: readonly ListenStep[];
  /** Comparison spellings left out because they fall off the fretboard. */
  readonly omitted: readonly Spelling[];
}

interface DisplayBody {
  readonly view: TriadsView;
  /** Non-null iff Compare is on, the view shows shapes and the first triad has a shape. */
  readonly comparison: ComparisonView | null;
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
export type { Quality, TriadFunction } from '../theory/triad';
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
    characteristic: quality === 'diminished' ? 'b5' : null,
    comparison: null,
    changed: []
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
  | 'comparison'
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
  labelMode: 'interval' | 'note',
  cq: Quality | null
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

  const shapeKey = `${s.rootPc}:${s.stringSet}`;
  const comparisons = new Map<string, ReturnType<typeof buildComparison>>();
  if (cq !== null) {
    for (const x of shapes) {
      comparisons.set(
        x.id,
        buildComparison({
          s,
          instrument,
          quality: cq,
          rootSpelling,
          scope: x.id,
          shapeKey,
          frets: x.frets,
          functions: x.functions,
          emphasis: x.selected ? 'highlighted' : 'normal',
          firstSpelling: spelling,
          name: rootName,
          positions: x.positions,
          shifted: false
        })
      );
    }
  }
  const markerOf = (shape: ChainShapeView): Marker[] => [
    ...shape.positions.map((p, k): Marker => {
      const fn = shape.functions[k];
      return {
        string: p.string,
        fret: p.fret,
        function: fn,
        emphasis: shape.selected ? 'highlighted' : 'normal',
        spelling: spelling[fn],
        interval: labels[FN_INDEX[fn]],
        id: `${shape.id}:first:${fn}@${shapeKey}`
      };
    }),
    ...(comparisons.get(shape.id)?.markers ?? [])
  ];
  // Highlighted first so a shared position keeps the highlighted marker (R-07).
  const markers = [
    ...shapes.filter((x) => x.selected).flatMap(markerOf),
    ...shapes.filter((x) => !x.selected).flatMap(markerOf)
  ];

  const tags: FretboardTag[] = shapes.map((x) => {
    const label = TAG_LABEL[x.inversion]();
    const tagParams = { inversion: inversionName(x.inversion), frets: x.frets.join('-') };
    const name = x.wideStretch ? m.triads_tag_name_wide(tagParams) : m.triads_tag_name(tagParams);
    return {
      id: x.id,
      start: Math.min(...x.frets),
      end: Math.max(...x.frets),
      label,
      name,
      pressed: x.selected,
      ...(x.wideStretch ? { detail: m.triads_tag_wide_stretch() } : {})
    };
  });

  const description = m.triads_desc_full_neck({
    name: rootName,
    strings: setStrings(s.stringSet).slice().reverse().join(', '),
    shapes: shapes
      .map((x) => {
        const entry = { inversion: TAG_LABEL[x.inversion](), frets: x.frets.join('-') };
        return x.wideStretch
          ? m.triads_desc_chain_entry_wide(entry)
          : m.triads_desc_chain_entry(entry);
      })
      .join('; '),
    inversion: inversionName(s.inversion)
  });

  const cmps = shapes.flatMap((x) => {
    const c = comparisons.get(x.id);
    return c === undefined ? [] : [c];
  });
  const firstCmp = cmps[0];
  const arrows = cmps.flatMap((c) => c.arrows);
  const withComparison =
    firstCmp === undefined
      ? base.composition
      : { ...base.composition, comparison: firstCmp.composition, changed: firstCmp.changed };
  const comparison: ComparisonView | null =
    firstCmp === undefined
      ? null
      : {
          quality: firstCmp.view.quality,
          spelling: firstCmp.view.spelling,
          shifted: false,
          fits: cmps.every((c) => c.view.fits),
          pairs: cmps.flatMap((c) => c.view.pairs)
        };

  const selected = shapes.filter((x) => x.selected);
  // Listen (C11): every chain shape in order, three notes low → high then the chord.
  const steps: readonly ListenStep[] = shapes.flatMap((x) => [...x.positions, [...x.positions]]);

  return {
    ...base,
    comparison,
    composition: withComparison,
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
      ...(cmps.length === 0 ? {} : { arrows }),
      description:
        cmps.length === 0 ? description : [description, ...cmps.map((c) => c.description)].join(' ')
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
  const compare: CompareDisplay = {
    offered: s.view !== 'all-notes',
    on: s.compare.on,
    quality: s.compare.quality,
    options: QUALITIES.filter((q) => q !== s.quality)
  };
  return {
    ...d,
    compare,
    seeAllNotes: guidance && s.view !== 'all-notes',
    listenComparison: buildListenComparison(s, d, instrument),
    viewInCaged: { enabled: cagedCanShow(s.quality) }
  };
}

const NO_LISTEN_COMPARISON: ListenComparison = { enabled: false, steps: [], omitted: [] };

/**
 * M9 / C13: Full neck uses the selected pair (inversion + occurrence), else the lowest shape of
 * that inversion; Isolated uses its single pair. Off-board comparison notes are omitted.
 */
function buildListenComparison(
  s: TriadsViewState,
  d: DisplayBody,
  instrument: Instrument
): ListenComparison {
  const cmp = d.comparison;
  if (!s.compare.on || s.view === 'all-notes' || cmp === null || cmp.pairs.length === 0) {
    return NO_LISTEN_COMPARISON;
  }
  let pair: ComparisonPair | undefined;
  if (s.view === 'isolated') {
    pair = cmp.pairs[0];
  } else {
    const octaveOf = (x: ComparisonPair): number => Number(x.scope.split(':')[1]);
    const ofInversion = cmp.pairs.filter((x) => x.scope.startsWith(`${s.inversion}:`));
    pair =
      ofInversion.find((x) => x.scope === `${s.inversion}:${s.occurrence}`) ??
      ofInversion.reduce<ComparisonPair | undefined>(
        (low, x) => (low === undefined || octaveOf(x) < octaveOf(low) ? x : low),
        undefined
      );
  }
  if (pair === undefined) return NO_LISTEN_COMPARISON;
  const first = shapePositions(s.stringSet, pair.firstFrets);
  const second = shapePositions(s.stringSet, pair.comparisonFrets).filter(
    (p) => p.fret >= 0 && p.fret <= instrument.fretCount
  );
  return {
    enabled: true,
    steps: [first, [], second],
    omitted: pair.offBoard.map((o) => o.spelling)
  };
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
    comparison: null,
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
    const cq = s.compare.on && s.compare.quality !== s.quality ? s.compare.quality : null;
    return fullNeck(s, instrument, display, spelling, rootSpelling, labelMode, cq);
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
  const cq = s.compare.on && s.compare.quality !== s.quality ? s.compare.quality : null;
  // M3: with Compare on, step through the occurrences whose pair fits; none fits → first triad.
  const pairs =
    cq === null ? [] : pairOccurrences(occs, result.functions, s.quality, cq, instrument.fretCount);
  const paired = pairs.length > 0;
  const count = paired ? pairs.length : occs.length;
  const index = Math.max(0, Math.min(s.occurrence, count - 1));
  const occIndex = paired ? (pairs[index] ?? 0) : index;
  const frets: Frets3 = occs[occIndex] ?? result.frets;
  // R-15: shifted only when the user is on the first step and occurrence 0 had no pair.
  const shifted = paired && index === 0 && occIndex > 0;
  const octave = {
    up: index < count - 1,
    down: count > 0 && index > 0,
    index,
    count,
    applies: true
  };

  const positions = shapePositions(s.stringSet, frets);
  const labels = QUALITY_LABELS[s.quality];
  const shapeKey = `${s.rootPc}:${s.inversion}:${s.stringSet}`;
  const firstMarkers: Marker[] = positions.map((p, k) => {
    const fn = result.functions[k];
    return {
      string: p.string,
      fret: p.fret,
      function: fn,
      emphasis: 'highlighted',
      spelling: spelling[fn],
      interval: labels[FN_INDEX[fn]],
      id: `iso:first:${fn}@${shapeKey}`
    };
  });
  const cmp =
    cq === null
      ? null
      : buildComparison({
          s,
          instrument,
          quality: cq,
          rootSpelling,
          scope: 'iso',
          shapeKey,
          frets,
          functions: result.functions,
          emphasis: 'highlighted',
          firstSpelling: spelling,
          name,
          positions,
          shifted
        });
  const markers: Marker[] = [...firstMarkers, ...(cmp?.markers ?? [])];

  const wide = isWideStretch(frets);
  const base = m.triads_desc_shape({
    name,
    notes: spokenNoteList([spelling.root, spelling.third, spelling.fifth]),
    strings: setStrings(s.stringSet).slice().reverse().join(', '),
    frets: frets.join(', ')
  });
  const summary = wide ? `${base} ${m.triads_desc_wide_stretch()}` : base;
  const withComparison =
    cmp === null ? comp : { ...comp, comparison: cmp.composition, changed: cmp.changed };

  const [low, mid, high] = positions;
  // Listen: low → mid → high, then the whole block together (US7-1).
  const steps: readonly ListenStep[] = [low, mid, high, [low, mid, high]];

  return {
    ...display,
    comparison: cmp?.view ?? null,
    composition: withComparison,
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
      summary,
      ...(cmp === null ? {} : { arrows: cmp.arrows, description: cmp.description })
    }
  };
}

interface ComparisonInput {
  readonly s: TriadsViewState;
  readonly instrument: Instrument;
  readonly quality: Quality;
  readonly rootSpelling: Spelling;
  readonly scope: string;
  readonly shapeKey: string;
  readonly frets: Frets3;
  readonly functions: readonly [TriadFunction, TriadFunction, TriadFunction];
  readonly emphasis: Marker['emphasis'];
  readonly firstSpelling: TriadSpelling;
  readonly name: string;
  readonly positions: readonly [Position, Position, Position];
  /** Isolated: the pair is shown an octave above occurrence 0. */
  readonly shifted: boolean;
}

/** The comparison markers, arrows, composition and description for one first triad (M4, M5, M8). */
function buildComparison(c: ComparisonInput): {
  readonly view: ComparisonView;
  readonly markers: readonly Marker[];
  readonly arrows: readonly FretboardArrow[];
  readonly composition: Composition;
  readonly changed: readonly TriadFunction[];
  readonly description: string;
} {
  const { s, instrument, quality, scope, shapeKey, frets, functions } = c;
  const spelling = spellTriad(c.rootSpelling, quality);
  const cmpFrets = comparisonFrets(frets, functions, s.quality, quality);
  const moves = noteMoves(frets, functions, s.quality, quality);
  const onBoard = (x: NoteMove): boolean => x.toFret >= 0 && x.toFret <= instrument.fretCount;
  const offBoard = moves
    .filter((x) => !onBoard(x))
    .map((move) => ({
      move,
      edge: move.toFret < 0 ? ('nut' as const) : ('end' as const),
      spelling: spelling[move.function]
    }));
  const shown = moves.filter(onBoard);
  const labels = QUALITY_LABELS[quality];
  const markers: Marker[] = shown.map((x) => ({
    string: c.positions[x.index].string,
    fret: x.toFret,
    function: x.function,
    emphasis: c.emphasis,
    spelling: spelling[x.function],
    interval: labels[FN_INDEX[x.function]],
    variant: 'comparison' as const,
    id: `${scope}:cmp:${x.function}@${shapeKey}`
  }));
  const size = (x: NoteMove): string => {
    const count = Math.abs(x.delta);
    return count === 1
      ? m.triads_compare_arrow_one({ count })
      : m.triads_compare_arrow_other({ count });
  };
  const arrows: FretboardArrow[] = shown.map((x) => ({
    kind: 'move' as const,
    id: `${scope}:arrow:${x.function}`,
    string: c.positions[x.index].string,
    fromFret: x.fromFret,
    toFret: x.toFret,
    label: size(x)
  }));
  // M5: a note that falls off the board keeps its first-triad marker and gets a labelled arrow.
  for (const o of offBoard) {
    arrows.push({
      kind: 'off-board',
      id: `${scope}:arrow:${o.move.function}`,
      string: c.positions[o.move.index].string,
      fromFret: o.move.fromFret,
      edge: o.edge,
      label: noteLabel(o.spelling)
    });
  }
  const changed = moves.map((x) => x.function);
  const moved = new Set<TriadFunction>(changed);
  const shared = functions
    .map((fn, k) => ({ fn, k }))
    .filter(({ fn }) => !moved.has(fn))
    .map(({ fn, k }) =>
      m.triads_desc_compare_shared_entry({
        note: spokenNote(c.firstSpelling[fn]),
        string: c.positions[k].string,
        fret: c.positions[k].fret
      })
    )
    .join('; ');
  const changes = moves
    .map((x) =>
      m.triads_desc_compare_move({
        function: functionName(x.function),
        from: spokenNote(c.firstSpelling[x.function]),
        string: c.positions[x.index].string,
        fromFret: x.fromFret,
        size: size(x),
        direction: x.delta < 0 ? m.triads_compare_toward_nut() : m.triads_compare_toward_body(),
        to: spokenNote(spelling[x.function]),
        toFret: x.toFret
      })
    )
    .join('; ');
  const edgeText = (e: 'nut' | 'end'): string =>
    e === 'nut' ? m.triads_compare_off_nut() : m.triads_compare_off_end();
  const off = offBoard
    .map((o) => m.triads_desc_compare_off({ note: spokenNote(o.spelling), edge: edgeText(o.edge) }))
    .join('');
  const description = m.triads_desc_compare({
    first: m.triads_name_no_inversion({
      root: spokenNote(c.rootSpelling),
      quality: qualityName(s.quality)
    }),
    second: m.triads_name_no_inversion({
      root: spokenNote(c.rootSpelling),
      quality: qualityName(quality)
    }),
    inversion: inversionName(s.inversion),
    strings: setStrings(s.stringSet).slice().reverse().join(', '),
    shift: c.shifted ? m.triads_desc_compare_shift() : '',
    shared,
    changed: changes !== '' ? changes : offBoard.map((o) => spokenNote(o.spelling)).join('; '),
    off
  });
  return {
    view: {
      quality,
      spelling,
      shifted: c.shifted,
      fits: offBoard.length === 0,
      pairs: [{ scope, firstFrets: frets, comparisonFrets: cmpFrets, moves, offBoard }]
    },
    markers,
    arrows,
    composition: composition(spelling, quality, s.inversion, s.rootPc),
    changed,
    description
  };
}
