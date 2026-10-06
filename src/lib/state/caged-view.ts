/**
 * CAGED view state (data-model §4, contracts/caged-api §2).
 * Pure: no Svelte, DOM or paraglide. Every function is total; a no-op returns the same object.
 */
import type { PitchClass, Spelling } from '../theory/pitch';
import type { CagedQuality, CagedShapeId } from '../theory/caged';
import { CHORD_ONLY } from './caged-layers';
import { choiceOf, effectiveRootSpelling, isAlteredRoot } from '../theory/triad';
import type { SpellingOverride } from './triads-view';
import type { StringSetId } from '../instrument/string-sets';

export type { SpellingOverride } from './triads-view';

export interface CagedFocus {
  readonly letter: CagedShapeId;
  /** 0 = that letter's drawn occurrence nearest the nut. */
  readonly ordinal: number;
}

/** Which layers are switched on (FR-002). Not persisted; encoded in share links by `src/lib/link` (`ly`). */
export interface LayersOn {
  readonly chord: boolean;
  readonly arpeggio: boolean;
  readonly pentatonic: boolean;
  readonly scale: boolean;
  readonly triad: boolean;
}

export type CagedLabelType = 'interval' | 'name';
export const CAGED_LABEL_TYPES: readonly CagedLabelType[] = ['interval', 'name'];

export interface CagedViewState {
  readonly rootPc: PitchClass;
  readonly spellingOverride: SpellingOverride;
  readonly quality: CagedQuality;
  /** null = "See all". */
  readonly focus: CagedFocus | null;
  /** Show connections (default false). */
  readonly connections: boolean;
  /** Layer switches; initial `CHORD_ONLY`. */
  readonly layers: LayersOn;
  /** Effective Triad string set; null while Triad is off or after reset. Not persisted; encoded in share links by `src/lib/link` (`ts`). */
  readonly triadSet: StringSetId | null;
  /** Marker label kind; initial = the preferred label. */
  readonly labelType: CagedLabelType;
}

export const CAGED_QUALITIES: readonly CagedQuality[] = ['major', 'minor'];

/** FR-002: C major, no spelling override, Chord layer only. */
export function initialCagedView(label: CagedLabelType = 'interval'): CagedViewState {
  return {
    rootPc: 0,
    spellingOverride: 'none',
    quality: 'major',
    focus: null,
    connections: false,
    layers: CHORD_ONLY,
    triadSet: null,
    labelType: CAGED_LABEL_TYPES.includes(label) ? label : 'interval'
  };
}

export function selectRoot(s: CagedViewState, pc: PitchClass): CagedViewState {
  if (!Number.isInteger(pc) || pc < 0 || pc > 11 || pc === s.rootPc) return s;
  return { ...s, rootPc: pc, spellingOverride: 'none' };
}

/** The override is kept (FR-003). */
export function setQuality(s: CagedViewState, q: CagedQuality): CagedViewState {
  if (!CAGED_QUALITIES.includes(q) || q === s.quality) return s;
  return { ...s, quality: q };
}

/** Toggle between the two spellings of an altered root; no-op on naturals. */
export function switchSpelling(s: CagedViewState): CagedViewState {
  if (!isAlteredRoot(s.rootPc)) return s;
  const current = choiceOf(s.rootPc, cagedRootSpelling(s));
  return { ...s, spellingOverride: current === 'sharp' ? 'flat' : 'sharp' };
}

export function equalsFocus(a: CagedFocus | null, b: CagedFocus | null): boolean {
  return a === b || (a !== null && b !== null && a.letter === b.letter && a.ordinal === b.ordinal);
}

export function setFocus(s: CagedViewState, f: CagedFocus | null): CagedViewState {
  return equalsFocus(s.focus, f) ? s : { ...s, focus: f };
}

export function setConnections(s: CagedViewState, on: boolean): CagedViewState {
  return s.connections === on ? s : { ...s, connections: on };
}

export function equalsLayers(a: LayersOn, b: LayersOn): boolean {
  return (
    a === b ||
    (a.chord === b.chord &&
      a.arpeggio === b.arpeggio &&
      a.pentatonic === b.pentatonic &&
      a.scale === b.scale &&
      a.triad === b.triad)
  );
}

/** Same reference when every flag is equal. */
export function setLayers(s: CagedViewState, l: LayersOn): CagedViewState {
  return equalsLayers(s.layers, l) ? s : { ...s, layers: l };
}

/** Same reference when equal. */
export function setTriadSet(s: CagedViewState, id: StringSetId | null): CagedViewState {
  return s.triadSet === id ? s : { ...s, triadSet: id };
}

/** No-op for an unknown or equal value. */
export function setLabelType(s: CagedViewState, t: CagedLabelType): CagedViewState {
  return !CAGED_LABEL_TYPES.includes(t) || t === s.labelType ? s : { ...s, labelType: t };
}

/** Back to the defaults; layers → `CHORD_ONLY`, label → the preferred one. */
export function resetCaged(preferredLabel: CagedLabelType = 'interval'): CagedViewState {
  return initialCagedView(preferredLabel);
}

export function equalsCagedView(a: CagedViewState, b: CagedViewState): boolean {
  return (
    a.rootPc === b.rootPc &&
    a.spellingOverride === b.spellingOverride &&
    a.quality === b.quality &&
    equalsFocus(a.focus, b.focus) &&
    a.connections === b.connections &&
    equalsLayers(a.layers, b.layers) &&
    a.triadSet === b.triadSet &&
    a.labelType === b.labelType
  );
}

export function cagedRootSpelling(s: CagedViewState): Spelling {
  return effectiveRootSpelling(s.rootPc, s.spellingOverride, s.quality);
}
