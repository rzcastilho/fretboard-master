/**
 * CAGED Triad layer rules (contracts/triad-layer-api §3, research R-05).
 * Pure: no Svelte, DOM or paraglide. Every function is total and never throws.
 */
import type { Instrument } from '../instrument/instrument';
import { stringSets, type StringSetId } from '../instrument/string-sets';
import type { CagedQuality, ShapeOccurrence } from '../theory/caged';
import { shapeTriad, type ShapeTriad } from '../theory/caged-triad';
import { pitchOfSpelling, type PitchClass, type Spelling } from '../theory/pitch';
import { spellTriad } from '../theory/triad';
import type { Inversion } from '../theory/triad-shape';
import type { CagedViewState, SpellingOverride } from './caged-view';

export interface SetAvailability {
  readonly set: number;
  /** null ⇔ no close-position triad on this set inside the shape. */
  readonly triad: ShapeTriad | null;
}

/** What "Open in Triads" carries (data-model §6). */
export interface TriadsHandoff {
  readonly rootPc: PitchClass;
  readonly spelling: SpellingOverride;
  readonly quality: CagedQuality;
  readonly inversion: Inversion;
  readonly stringSet: StringSetId;
  /** Raw Triads octave index k. */
  readonly occurrence: number;
}

/** One entry per string set, bass → treble; `[]` when no occurrence is in focus. */
export function triadAvailability(
  occ: ShapeOccurrence | null,
  instrument: Instrument,
  root: Spelling,
  quality: CagedQuality
): readonly SetAvailability[] {
  if (!occ || !instrument?.openStrings || !root) return [];
  const open = instrument.openStrings.map(pitchOfSpelling);
  const triad = spellTriad(root, quality);
  return stringSets(instrument).map((set) => ({
    set,
    triad: shapeTriad(occ, open, triad, set, instrument.fretCount)
  }));
}

/** Strings 3-2-1 when available, else the first available bass → treble, else null. */
export function defaultTriadSet(avail: readonly SetAvailability[]): StringSetId | null {
  const list = avail ?? [];
  if (list.some((a) => a.set === 3 && a.triad !== null)) return 3;
  return list.find((a) => a.triad !== null)?.set ?? null;
}

/**
 * Keep `current` when it is available; otherwise move to the default. When nothing is available
 * the selection is kept so it is not lost for the next shape (R-05).
 */
export function settleTriadSet(
  current: StringSetId | null,
  avail: readonly SetAvailability[]
): { readonly set: StringSetId | null; readonly moved: boolean } {
  const fallback = defaultTriadSet(avail);
  if (fallback === null) return { set: current, moved: false };
  if (current === null) return { set: fallback, moved: false };
  if ((avail ?? []).some((a) => a.set === current && a.triad !== null))
    return { set: current, moved: false };
  return { set: fallback, moved: true };
}

export function selectedTriad(
  set: StringSetId | null,
  avail: readonly SetAvailability[]
): ShapeTriad | null {
  if (set === null || set === undefined) return null;
  return (avail ?? []).find((a) => a.set === set)?.triad ?? null;
}

/** `triad:s:f` ids, pitch ascending (ties → higher string number first). */
export function triadRevealIds(t: ShapeTriad | null): readonly string[] {
  if (!t) return [];
  return t.frets
    .map((fret, i) => ({ string: t.set - i, fret, pitch: t.pitches[i] }))
    .sort((a, b) => a.pitch - b.pitch || b.string - a.string)
    .map((p) => `triad:${p.string}:${p.fret}`);
}

/** Null when no triad is drawn or in CAGED's temporary standard view (R-11). */
export function triadHandoff(
  view: CagedViewState,
  t: ShapeTriad | null,
  temporary: boolean
): TriadsHandoff | null {
  if (!view || !t || temporary) return null;
  return {
    rootPc: view.rootPc,
    spelling: view.spellingOverride,
    quality: view.quality,
    inversion: t.inversion,
    stringSet: t.set,
    occurrence: t.occurrence
  };
}
