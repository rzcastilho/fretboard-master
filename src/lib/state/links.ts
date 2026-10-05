/**
 * Tool links (contracts/links-api.md §1, data-model §4–5). Pure: no Svelte, DOM or paraglide.
 * Every transition is total; a no-op returns the same object.
 */
import type { Instrument } from '../instrument/instrument';
import type { PitchClass } from '../theory/pitch';
import { QUALITY_INTERVALS, isAlteredRoot, type Quality } from '../theory/triad';
import type { TriadMatch } from '../theory/triad-detect';
import type { NotesViewState } from './notes-view';
import type { TriadsHandoff } from './caged-triad';
import { setOpenPitches } from '../instrument/string-sets';
import { defaultRootSpelling, spellTriad } from '../theory/triad';
import { occurrences, pairOccurrences, triadShape } from '../theory/triad-shape';
import {
  equalsTriadsView,
  revalidate,
  setQuality,
  setView,
  type SpellingOverride,
  type TriadsViewState
} from './triads-view';

/** FR-8.6 will make this a preference. */
export const NOTES_PRIMARY_CHOICE = 'sharp' as const;

export type CarryContext =
  | { readonly kind: 'root'; readonly rootPc: PitchClass }
  | {
      readonly kind: 'triad';
      readonly rootPc: PitchClass;
      readonly quality: Quality;
      readonly spelling: SpellingOverride;
    }
  | { readonly kind: 'notes'; readonly selection: readonly [PitchClass, PitchClass, PitchClass] };

const validPc = (pc: unknown): pc is PitchClass =>
  Number.isInteger(pc) && (pc as number) >= 0 && (pc as number) <= 11;

/** One selected note → root (FR-001, FR-003). */
export function carryFromNotes(n: NotesViewState): CarryContext | null {
  return n.selection.length === 1 ? { kind: 'root', rootPc: n.selection[0] } : null;
}

/** View as triad (FR-008). */
export function carryFromDetected(d: TriadMatch): CarryContext {
  return {
    kind: 'triad',
    rootPc: d.rootPc,
    quality: d.quality,
    spelling: isAlteredRoot(d.rootPc) ? NOTES_PRIMARY_CHOICE : 'none'
  };
}

/** Main triad only, never the comparison quality (FR-002). */
export function carryFromTriads(t: TriadsViewState): CarryContext {
  const { third, fifth } = QUALITY_INTERVALS[t.quality];
  return {
    kind: 'notes',
    selection: [t.rootPc, (t.rootPc + third) % 12, (t.rootPc + fifth) % 12]
  };
}

export function carryRoot(t: TriadsViewState, pc: PitchClass): TriadsViewState {
  if (!validPc(pc) || pc === t.rootPc) return t;
  return { ...t, rootPc: pc, spellingOverride: 'none', occurrence: 0 };
}

export function carryTriad(
  t: TriadsViewState,
  pc: PitchClass,
  q: Quality,
  spelling: SpellingOverride,
  i: Instrument
): TriadsViewState {
  if (!validPc(pc)) return t;
  if (pc === t.rootPc && spelling === t.spellingOverride && q === t.quality) return t;
  // Quality goes through setQuality so the Compare swap invariant holds.
  const withQuality = setQuality(t, q);
  const next: TriadsViewState = {
    ...withQuality,
    rootPc: pc,
    spellingOverride: spelling,
    occurrence: 0
  };
  const clamped = revalidate(next, i);
  return equalsTriadsView(clamped, t) ? t : clamped;
}

export function carrySelection(n: NotesViewState, sel: readonly PitchClass[]): NotesViewState {
  if (n.selection.length === sel.length && n.selection.every((v, k) => v === sel[k])) return n;
  return { ...n, selection: [...sel] };
}

/**
 * CAGED "Open in Triads" (R-11): land on the occurrence equal to the drawn triad, Isolated.
 * `compareOff` is true when Compare had to be turned off so the drawn shape is shown.
 */
export function carryCagedTriad(
  t: TriadsViewState,
  h: TriadsHandoff,
  i: Instrument
): { readonly state: TriadsViewState; readonly compareOff: boolean } {
  if (!validPc(h.rootPc)) return { state: t, compareOff: false };
  const base = setQuality(setView(t, 'isolated'), h.quality);
  let next: TriadsViewState = {
    ...base,
    rootPc: h.rootPc,
    spellingOverride: h.spelling,
    inversion: h.inversion,
    stringSet: h.stringSet,
    occurrence: h.occurrence
  };
  let compareOff = false;
  const cq = next.compare.quality;
  if (next.compare.on && cq !== null && cq !== next.quality) {
    const triad = spellTriad(defaultRootSpelling(next.rootPc, next.quality), next.quality);
    const shape = triadShape(setOpenPitches(i, next.stringSet), triad, next.inversion);
    if (shape.kind === 'shape') {
      const occs = occurrences(shape.frets, i.fretCount);
      const pairs = pairOccurrences(occs, shape.functions, next.quality, cq, i.fretCount);
      if (pairs.length > 0) {
        const idx = pairs.indexOf(h.occurrence);
        if (idx >= 0) next = { ...next, occurrence: idx };
        else {
          next = { ...next, compare: { on: false, quality: cq } };
          compareOff = true;
        }
      }
    }
  }
  const clamped = revalidate(next, i);
  return equalsTriadsView(clamped, t)
    ? { state: t, compareOff: false }
    : { state: clamped, compareOff };
}
