/**
 * Notes tool view state (data-model §1–§2). Pure: no Svelte, DOM, or paraglide.
 * Every function is total; a no-op returns the same object (`Object.is`).
 */
import {
  isValidPosition,
  positionsWithPitchClass,
  type Instrument,
  type Position
} from '../instrument/instrument';
import type { PitchClass } from '../theory/pitch';

export type LabelType = 'name' | 'octave' | 'none';
export type Background = 'naturals' | 'all' | 'none';
export type RegionShortcut = '0-4' | '5-9' | '10-14' | 'whole';

export interface Region {
  readonly start: number;
  readonly end: number;
}

export interface NotesViewState {
  /** 0–12 distinct pitch classes, first-selected order. */
  readonly selection: readonly PitchClass[];
  readonly labelType: LabelType;
  readonly background: Background;
  readonly hideNames: boolean;
  /** Sorted ascending, non-empty, each in 1..stringCount. */
  readonly activeStrings: readonly number[];
  readonly region: Region;
  /** The tapped position whose card is open. */
  readonly card: Position | null;
}

export function initialNotesView(instrument: Instrument): NotesViewState {
  return {
    selection: [],
    labelType: 'name',
    background: 'naturals',
    hideNames: false,
    activeStrings: Array.from({ length: instrument.stringCount }, (_, i) => i + 1),
    region: { start: 0, end: instrument.fretCount },
    card: null
  };
}

const sameList = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function equalsNotesView(a: NotesViewState, b: NotesViewState): boolean {
  if (a === b) return true;
  return (
    a.labelType === b.labelType &&
    a.background === b.background &&
    a.hideNames === b.hideNames &&
    a.region.start === b.region.start &&
    a.region.end === b.region.end &&
    sameList(a.selection, b.selection) &&
    sameList(a.activeStrings, b.activeStrings) &&
    (a.card === b.card ||
      (a.card !== null &&
        b.card !== null &&
        a.card.string === b.card.string &&
        a.card.fret === b.card.fret))
  );
}

/** Append `pc` if absent, remove it if present. Invalid pitch classes are ignored. */
export function toggleNote(s: NotesViewState, pc: PitchClass): NotesViewState {
  if (!Number.isInteger(pc) || pc < 0 || pc > 11) return s;
  const selection = s.selection.includes(pc)
    ? s.selection.filter((v) => v !== pc)
    : [...s.selection, pc];
  return { ...s, selection };
}

/** Append `pc` if absent; never removes. Invalid or already-selected pitch classes are a no-op. */
export function addNote(s: NotesViewState, pc: PitchClass): NotesViewState {
  if (!Number.isInteger(pc) || pc < 0 || pc > 11 || s.selection.includes(pc)) return s;
  return { ...s, selection: [...s.selection, pc] };
}

/** Choose what markers show as labels. Unchanged is a same-object no-op. */
export function setLabelType(s: NotesViewState, t: LabelType): NotesViewState {
  return s.labelType === t ? s : { ...s, labelType: t };
}

/** Choose which notes show as background. Unchanged is a same-object no-op. */
export function setBackground(s: NotesViewState, b: Background): NotesViewState {
  return s.background === b ? s : { ...s, background: b };
}

/** Hide or show all names. `labelType` is kept while on and restored when off. */
export function setHideNames(s: NotesViewState, on: boolean): NotesViewState {
  return s.hideNames === on ? s : { ...s, hideNames: on };
}

/**
 * Clear (FR-013): empty the selection, turn every string on, whole-neck region, close the card.
 * Keeps `labelType`, `background` and `hideNames`. Already matching is a same-object no-op.
 */
export function clear(s: NotesViewState, i: Instrument): NotesViewState {
  const base = initialNotesView(i);
  const next: NotesViewState = {
    ...base,
    labelType: s.labelType,
    background: s.background,
    hideNames: s.hideNames
  };
  return equalsNotesView(next, s) ? s : next;
}

/** Reset tool (FR-014): the initial view for `i`. */
export function reset(i: Instrument): NotesViewState {
  return initialNotesView(i);
}

/** Open the position card on `p` (replaces any open card). Same position is a no-op. */
export function openCard(s: NotesViewState, p: Position): NotesViewState {
  if (s.card !== null && s.card.string === p.string && s.card.fret === p.fret) return s;
  return { ...s, card: { string: p.string, fret: p.fret } };
}

export function closeCard(s: NotesViewState): NotesViewState {
  return s.card === null ? s : { ...s, card: null };
}

/**
 * Turn string `n` off or on, keeping `activeStrings` ascending. Removing the only active string
 * is a no-op (EC-4.2). With `i`, a string outside `1..stringCount` is ignored.
 */
export function toggleString(s: NotesViewState, n: number, i?: Instrument): NotesViewState {
  if (!Number.isInteger(n) || n < 1 || (i !== undefined && n > i.stringCount)) return s;
  if (s.activeStrings.includes(n)) {
    if (s.activeStrings.length === 1) return s;
    return { ...s, activeStrings: s.activeStrings.filter((v) => v !== n) };
  }
  return { ...s, activeStrings: [...s.activeStrings, n].sort((a, b) => a - b) };
}

const clampFret = (v: number, i: Instrument): number | null =>
  Number.isNaN(v) ? null : Math.min(i.fretCount, Math.max(0, Math.round(v)));

function withRegion(s: NotesViewState, start: number, end: number): NotesViewState {
  return start === s.region.start && end === s.region.end ? s : { ...s, region: { start, end } };
}

/** Set the first fret of the region; a start past the end pushes the end along. */
export function setRegionStart(s: NotesViewState, v: number, i: Instrument): NotesViewState {
  const start = clampFret(v, i);
  if (start === null) return s;
  return withRegion(s, start, Math.max(start, s.region.end));
}

/** Set the last fret of the region; an end before the start pushes the start along. */
export function setRegionEnd(s: NotesViewState, v: number, i: Instrument): NotesViewState {
  const end = clampFret(v, i);
  if (end === null) return s;
  return withRegion(s, Math.min(end, s.region.start), end);
}

export function setRegionShortcut(
  s: NotesViewState,
  k: RegionShortcut,
  i: Instrument
): NotesViewState {
  switch (k) {
    case '0-4':
      return withRegion(s, 0, Math.min(4, i.fretCount));
    case '5-9':
      return withRegion(s, Math.min(5, i.fretCount), Math.min(9, i.fretCount));
    case '10-14':
      return withRegion(s, Math.min(10, i.fretCount), Math.min(14, i.fretCount));
    case 'whole':
      return withRegion(s, 0, i.fretCount);
    default:
      return s;
  }
}

/** Selected notes (selection order) with no position on an active string inside the region. */
export function missingNotes(s: NotesViewState, i: Instrument): readonly PitchClass[] {
  return s.selection.filter(
    (pc) =>
      !positionsWithPitchClass(i, pc).some(
        (p) =>
          s.activeStrings.includes(p.string) && p.fret >= s.region.start && p.fret <= s.region.end
      )
  );
}

/**
 * Smallest growth of the region that brings every selected note into view (research R-06).
 * Exhaustive over (start, end) pairs: the board is at most a few dozen frets wide, and a greedy
 * nearest-note walk can keep a start extension that a later end extension makes redundant.
 * Ties on total growth prefer extending the end. Never touches strings or the selection;
 * nothing missing is a same-object no-op.
 */
export function widenRegion(s: NotesViewState, i: Instrument): NotesViewState {
  if (missingNotes(s, i).length === 0) return s;
  const { start: s0, end: e0 } = s.region;
  let best: { start: number; end: number; growth: number } | null = null;
  for (let start = s0; start >= 0; start--) {
    for (let end = e0; end <= i.fretCount; end++) {
      const growth = s0 - start + (end - e0);
      if (best !== null && growth > best.growth) break;
      if (best !== null && growth === best.growth && start < best.start) continue;
      if (missingNotes({ ...s, region: { start, end } }, i).length > 0) continue;
      if (best === null || growth < best.growth) {
        best = { start, end, growth };
      }
      break;
    }
  }
  return best === null ? s : withRegion(s, best.start, best.end);
}

/** Make the state valid for `i`: drop strings and card that no longer exist, clamp the region. */
export function revalidate(s: NotesViewState, i: Instrument): NotesViewState {
  let strings = s.activeStrings.filter((n) => n >= 1 && n <= i.stringCount);
  if (strings.length === 0) strings = Array.from({ length: i.stringCount }, (_, k) => k + 1);
  const start = Math.min(i.fretCount, Math.max(0, s.region.start));
  const end = Math.max(start, Math.min(i.fretCount, Math.max(0, s.region.end)));
  const card = s.card !== null && isValidPosition(i, s.card) ? s.card : null;
  if (
    strings.length === s.activeStrings.length &&
    start === s.region.start &&
    end === s.region.end &&
    card === s.card
  ) {
    return s;
  }
  return { ...s, activeStrings: strings, region: { start, end }, card };
}

/**
 * String filter step for a change of string count (data-model §6, R-09). 6 → 7 turns string 7 on
 * only when every string was on; 7 → 6 drops string 7 silently, unless it was the only active
 * string, in which case every string turns on and the change is `forced` (notice).
 */
function adaptStrings(
  s: NotesViewState,
  prev: Instrument,
  next: Instrument
): { strings: readonly number[]; forced: boolean } {
  const all = (n: number) => Array.from({ length: n }, (_, k) => k + 1);
  if (next.stringCount === prev.stringCount) return { strings: s.activeStrings, forced: false };
  if (next.stringCount > prev.stringCount) {
    const everyOn = sameList(s.activeStrings, all(prev.stringCount));
    return { strings: everyOn ? all(next.stringCount) : s.activeStrings, forced: false };
  }
  const kept = s.activeStrings.filter((n) => n <= next.stringCount);
  return kept.length === 0
    ? { strings: all(next.stringCount), forced: true }
    : { strings: kept, forced: false };
}

/**
 * Adapt the view to a new instrument (data-model §5.1, §6). A whole-neck region follows the new
 * fret count; otherwise `revalidate` clamps it. `adjusted = regionClamped || cardClosed ||
 * filterForced`: a clamped region, a card that no longer exists, or a string filter that had to
 * be reset. A whole-neck follow and a silent string-count change never adjust.
 */
export function adaptNotesView(
  s: NotesViewState,
  prev: Instrument,
  next: Instrument
): { view: NotesViewState; adjusted: boolean } {
  const { strings, forced: filterForced } = adaptStrings(s, prev, next);
  const stringsStep = sameList(strings, s.activeStrings) ? s : { ...s, activeStrings: strings };
  const whole = s.region.start === 0 && s.region.end === prev.fretCount;
  const base = whole ? { ...stringsStep, region: { start: 0, end: next.fretCount } } : stringsStep;
  const view = revalidate(base, next);
  const cardClosed = s.card !== null && view.card === null;
  const regionClamped =
    !whole && (view.region.start !== s.region.start || view.region.end !== s.region.end);
  const adjusted = regionClamped || cardClosed || filterForced;
  return { view: equalsNotesView(view, s) ? s : view, adjusted };
}
