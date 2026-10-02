/**
 * Triads view state (data-model §4, contracts/triads-state-api.md §1).
 * Pure: no Svelte, DOM or paraglide. Every function is total; a no-op returns the same object.
 */
import type { Instrument } from '../instrument/instrument';
import { setOpenPitches, type StringSetId } from '../instrument/string-sets';
import type { PitchClass } from '../theory/pitch';
import {
  QUALITIES,
  choiceOf,
  defaultRootSpelling,
  effectiveRootSpelling,
  isAlteredRoot,
  spellTriad,
  type Quality
} from '../theory/triad';
import { INVERSIONS, occurrences, triadShape, type Inversion } from '../theory/triad-shape';

export type TriadsView = 'isolated' | 'full-neck' | 'all-notes';
export const TRIADS_VIEWS: readonly TriadsView[] = ['isolated', 'full-neck', 'all-notes'];

export type TriadsLabelType = 'interval' | 'name';
export type SpellingOverride = 'none' | 'sharp' | 'flat';

export interface TriadsViewState {
  readonly rootPc: PitchClass;
  readonly spellingOverride: SpellingOverride;
  readonly quality: Quality;
  readonly inversion: Inversion;
  readonly stringSet: StringSetId;
  readonly labelType: TriadsLabelType;
  /** 0 = lowest occurrence. */
  readonly occurrence: number;
  /** Not persisted (C14, FR-019). */
  readonly view: TriadsView;
}

/** FR-001: C major, root position, strings 3-2-1, interval labels. */
export function initialTriadsView(i: Instrument): TriadsViewState {
  return {
    rootPc: 0,
    spellingOverride: 'none',
    quality: 'major',
    inversion: 'root',
    stringSet: Math.min(3, i.stringCount),
    labelType: 'interval',
    occurrence: 0,
    view: 'isolated'
  };
}

export function equalsTriadsView(a: TriadsViewState, b: TriadsViewState): boolean {
  return (
    a.rootPc === b.rootPc &&
    a.spellingOverride === b.spellingOverride &&
    a.quality === b.quality &&
    a.inversion === b.inversion &&
    a.stringSet === b.stringSet &&
    a.labelType === b.labelType &&
    a.occurrence === b.occurrence &&
    a.view === b.view
  );
}

export function setView(s: TriadsViewState, v: TriadsView): TriadsViewState {
  if (!TRIADS_VIEWS.includes(v) || v === s.view) return s;
  return { ...s, view: v };
}

export function seeAllNotes(s: TriadsViewState): TriadsViewState {
  return setView(s, 'all-notes');
}

/** Full neck tag tap (C3): select the inversion and the occurrence together. */
export function selectShape(
  s: TriadsViewState,
  inv: Inversion,
  octave: number,
  i: Instrument
): TriadsViewState {
  if (s.view !== 'full-neck' || !INVERSIONS.includes(inv)) return s;
  const count = occurrenceCount({ ...s, inversion: inv }, i);
  if (!Number.isInteger(octave) || octave < 0 || octave > count - 1) return s;
  if (inv === s.inversion && octave === s.occurrence) return s;
  return { ...s, inversion: inv, occurrence: octave };
}

/** Reset tool: back to the initial state, view isolated. */
export function resetTriads(i: Instrument): TriadsViewState {
  return initialTriadsView(i);
}

export function setLabelType(s: TriadsViewState, t: TriadsLabelType): TriadsViewState {
  if (t !== 'interval' && t !== 'name') return s;
  return t === s.labelType ? s : { ...s, labelType: t };
}

export function selectRoot(s: TriadsViewState, pc: PitchClass): TriadsViewState {
  if (!Number.isInteger(pc) || pc < 0 || pc > 11 || pc === s.rootPc) return s;
  return { ...s, rootPc: pc, spellingOverride: 'none', occurrence: 0 };
}

/** Toggle between the two spellings of an altered root; no-op on naturals. */
export function switchSpelling(s: TriadsViewState): TriadsViewState {
  if (!isAlteredRoot(s.rootPc)) return s;
  const current = choiceOf(
    s.rootPc,
    effectiveRootSpelling(s.rootPc, s.spellingOverride, s.quality)
  );
  return { ...s, spellingOverride: current === 'sharp' ? 'flat' : 'sharp' };
}

export function setQuality(s: TriadsViewState, q: Quality): TriadsViewState {
  if (!QUALITIES.includes(q) || q === s.quality) return s;
  return { ...s, quality: q, occurrence: 0 };
}

export function setInversion(s: TriadsViewState, inv: Inversion): TriadsViewState {
  if (s.view === 'all-notes' || !INVERSIONS.includes(inv) || inv === s.inversion) return s;
  return { ...s, inversion: inv, occurrence: 0 };
}

const validSet = (id: StringSetId, i: Instrument): boolean =>
  Number.isInteger(id) && id >= 3 && id <= i.stringCount;

export function setStringSet(s: TriadsViewState, id: StringSetId, i: Instrument): TriadsViewState {
  if (s.view === 'all-notes' || !validSet(id, i) || id === s.stringSet) return s;
  return { ...s, stringSet: id, occurrence: 0 };
}

/** Number of octave occurrences of the current shape on `i` (0 when none fits or it does not close). */
function occurrenceCount(s: TriadsViewState, i: Instrument): number {
  const triad = spellTriad(defaultRootSpelling(s.rootPc, s.quality), s.quality);
  const result = triadShape(setOpenPitches(i, s.stringSet), triad, s.inversion);
  return result.kind === 'shape' ? occurrences(result.frets, i.fretCount).length : 0;
}

/** Move to the next higher occurrence; no-op at the last one or when none exists (C9). */
export function octaveUp(s: TriadsViewState, i: Instrument): TriadsViewState {
  if (s.view !== 'isolated') return s;
  const count = occurrenceCount(s, i);
  return s.occurrence < count - 1 ? { ...s, occurrence: s.occurrence + 1 } : s;
}

/** Move to the next lower occurrence; no-op at the lowest or when none exists (C9). */
export function octaveDown(s: TriadsViewState, i: Instrument): TriadsViewState {
  if (s.view !== 'isolated') return s;
  const count = occurrenceCount(s, i);
  return count > 0 && s.occurrence > 0 ? { ...s, occurrence: s.occurrence - 1 } : s;
}

/** Make the state valid for `i`: clamp the string set and the occurrence index. */
export function revalidate(s: TriadsViewState, i: Instrument): TriadsViewState {
  const stringSet = validSet(s.stringSet, i)
    ? s.stringSet
    : Math.max(3, Math.min(s.stringSet, i.stringCount));
  const base = stringSet === s.stringSet ? s : { ...s, stringSet };
  const max = Math.max(0, occurrenceCount(base, i) - 1);
  const occurrence = Math.max(0, Math.min(base.occurrence, max));
  return occurrence === base.occurrence ? base : { ...base, occurrence };
}
