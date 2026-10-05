/**
 * Preset tunings and fret-count rules (data-model §1, contracts/instrument-config-api.md §1).
 * Pure: no DOM, Svelte or i18n. Spelling is stored per preset, never re-derived (FR-005).
 */
import {
  fourthBelow,
  spellSharp,
  type Accidental,
  type Letter,
  type SpelledPitch
} from '../theory/pitch';
import { STANDARD_GUITAR, withPresentation, type Instrument } from './instrument';
import { matchPreset, offsetPitches, presetOffsets, type Offsets } from './custom-tuning';

export type TuningId =
  | 'AF-1'
  | 'AF-2'
  | 'AF-3'
  | 'AF-4'
  | 'AF-5'
  | 'AF-6'
  | 'AF-7'
  | 'AF-8'
  | 'AF-9'
  | 'AF-10'
  | 'AF-11'
  | 'AF-21'
  | 'AF-22'
  | 'AF-23';

export type StringCount = 6 | 7;
export const DEFAULT_STRING_COUNT = 6 as const;

export function isStringCount(x: unknown): x is StringCount {
  return x === 6 || x === 7;
}

export interface TuningPreset {
  readonly id: TuningId;
  /** Low → high, the preset's own spelling. */
  readonly strings: readonly SpelledPitch[];
}

export const MIN_FRETS = 12 as const;
export const MAX_FRETS = 24 as const;
export const DEFAULT_FRETS = 22 as const;
export const DEFAULT_TUNING_ID = 'AF-1' as const;

const p = (letter: Letter, octave: number, accidental: Accidental = 0): SpelledPitch =>
  Object.freeze({ letter, accidental, octave });

const preset = (id: TuningId, strings: readonly SpelledPitch[]): TuningPreset =>
  Object.freeze({ id, strings: Object.freeze(strings) });

/** AF-1 … AF-11 (6 strings), then AF-21 … AF-23 (7 strings). Panel order: `presetsFor`. */
export const TUNING_PRESETS: readonly TuningPreset[] = Object.freeze([
  preset('AF-1', [p('E', 2), p('A', 2), p('D', 3), p('G', 3), p('B', 3), p('E', 4)]),
  preset('AF-2', [
    p('E', 2, -1),
    p('A', 2, -1),
    p('D', 3, -1),
    p('G', 3, -1),
    p('B', 3, -1),
    p('E', 4, -1)
  ]),
  preset('AF-3', [p('D', 2), p('G', 2), p('C', 3), p('F', 3), p('A', 3), p('D', 4)]),
  preset('AF-4', [p('D', 2), p('A', 2), p('D', 3), p('G', 3), p('B', 3), p('E', 4)]),
  preset('AF-5', [p('C', 2), p('G', 2), p('C', 3), p('F', 3), p('A', 3), p('D', 4)]),
  preset('AF-6', [p('D', 2), p('A', 2), p('D', 3), p('G', 3), p('B', 3), p('D', 4)]),
  preset('AF-7', [p('D', 2), p('A', 2), p('D', 3), p('G', 3), p('A', 3), p('D', 4)]),
  preset('AF-8', [p('D', 2), p('G', 2), p('D', 3), p('G', 3), p('B', 3), p('D', 4)]),
  preset('AF-9', [p('D', 2), p('A', 2), p('D', 3), p('F', 3, 1), p('A', 3), p('D', 4)]),
  preset('AF-10', [p('E', 2), p('B', 2), p('E', 3), p('G', 3, 1), p('B', 3), p('E', 4)]),
  preset('AF-11', [p('E', 2), p('A', 2), p('E', 3), p('A', 3), p('C', 4, 1), p('E', 4)]),
  preset('AF-21', [p('B', 1), p('E', 2), p('A', 2), p('D', 3), p('G', 3), p('B', 3), p('E', 4)]),
  preset('AF-22', [
    p('B', 1, -1),
    p('E', 2, -1),
    p('A', 2, -1),
    p('D', 3, -1),
    p('G', 3, -1),
    p('B', 3, -1),
    p('E', 4, -1)
  ]),
  preset('AF-23', [p('A', 1), p('E', 2), p('A', 2), p('D', 3), p('G', 3), p('B', 3), p('E', 4)])
]);

/** AF-1 … AF-11, catalog order. */
const SIX_IDS: readonly TuningId[] = Object.freeze(TUNING_PRESETS.slice(0, 11).map((t) => t.id));
const SEVEN_IDS: readonly TuningId[] = Object.freeze([
  'AF-21',
  'AF-22',
  'AF-23',
  ...SIX_IDS.slice(2)
]);

/** Preset ids shown for a string count, in panel order (6: 11 rows, 7: 12 rows). */
export function presetsFor(count: StringCount): readonly TuningId[] {
  return count === 7 ? SEVEN_IDS : SIX_IDS;
}

export function isTuningIdFor(x: unknown, count: StringCount): x is TuningId {
  return typeof x === 'string' && presetsFor(count).includes(x as TuningId);
}

export function standardTuningId(count: StringCount): 'AF-1' | 'AF-21' {
  return count === 7 ? 'AF-21' : 'AF-1';
}

/** 7: AF-1 → AF-21, AF-2 → AF-22; 6: AF-21/22/23 → AF-1; otherwise the id itself. */
export function normalizePresetId(id: TuningId, count: StringCount): TuningId {
  if (count === 7) return id === 'AF-1' ? 'AF-21' : id === 'AF-2' ? 'AF-22' : id;
  return id === 'AF-21' || id === 'AF-22' || id === 'AF-23' ? 'AF-1' : id;
}

export function isTuningId(x: unknown): x is TuningId {
  return typeof x === 'string' && TUNING_PRESETS.some((t) => t.id === x);
}

export function tuningPreset(id: TuningId): TuningPreset {
  return TUNING_PRESETS.find((t) => t.id === id) ?? TUNING_PRESETS[0];
}

const stringsCache = new Map<string, readonly SpelledPitch[]>();

/**
 * Spelled strings low → high for `count` strings. 7-string AF-3 … AF-11 prepend a perfect fourth
 * below string 6; a non-canonical (id, count) pair falls back to the count's standard.
 */
export function presetStrings(id: TuningId, count: StringCount): readonly SpelledPitch[] {
  const key = `${id}|${count}`;
  const hit = stringsCache.get(key);
  if (hit) return hit;
  const canonical = isTuningIdFor(id, count) ? id : standardTuningId(count);
  const base = tuningPreset(canonical).strings;
  let made: readonly SpelledPitch[] = base;
  if (count === 7 && base.length === 6) {
    const low = fourthBelow(base[0]);
    made = Object.freeze(low ? [low, ...base] : [...base]);
  }
  stringsCache.set(key, made);
  return made;
}

/** Non-integer → round; clamp to 12..24; NaN → default. */
export function clampFrets(n: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return DEFAULT_FRETS;
  return Math.min(MAX_FRETS, Math.max(MIN_FRETS, Math.round(n)));
}

const cache = new Map<string, Instrument>();

/** Frozen; `lowToHigh` is reversed so string 1 (highest) comes first. */
const build = (count: StringCount, frets: number, lowToHigh: readonly SpelledPitch[]): Instrument =>
  Object.freeze({
    stringCount: count,
    fretCount: frets,
    openStrings: Object.freeze([...lowToHigh].reverse()),
    handedness: 'right',
    orientation: 'highest-top'
  });

/** Memoized and frozen; string 1 (highest) first. `('AF-1', 6, 22)` is `STANDARD_GUITAR`. */
export function presetInstrument(id: TuningId, count: StringCount, fretCount: number): Instrument {
  const frets = clampFrets(fretCount);
  const key = `${id}|${count}|${frets}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const made: Instrument =
    id === 'AF-1' && count === 6 && frets === DEFAULT_FRETS
      ? STANDARD_GUITAR
      : build(count, frets, presetStrings(id, count));
  cache.set(key, made);
  return made;
}

/**
 * The standard tuning for `inst`'s string count, keeping its frets, handedness and orientation.
 * Memoized through `presetInstrument` and `withPresentation`. Used for CAGED's temporary view.
 */
export function standardCounterpart(inst: Instrument): Instrument {
  const count: StringCount = inst.stringCount === 7 ? 7 : 6;
  return withPresentation(
    presetInstrument(standardTuningId(count), count, inst.fretCount),
    inst.handedness,
    inst.orientation
  );
}

/** A preset, or per-string offsets (one per string) that match no preset (canonical form, 011 R-01). */
export type Tuning =
  | { readonly kind: 'preset'; readonly id: TuningId }
  | { readonly kind: 'custom'; readonly offsets: Offsets };

export const STANDARD_TUNING: Tuning = Object.freeze({ kind: 'preset', id: DEFAULT_TUNING_ID });

/** The only constructor of `custom`: a matching preset wins. */
export function tuningFromOffsets(o: Offsets): Tuning {
  const id = matchPreset(o);
  return id !== null
    ? Object.freeze({ kind: 'preset', id })
    : Object.freeze({ kind: 'custom', offsets: o });
}

export function offsetsOfTuning(t: Tuning, count: StringCount): Offsets {
  return t.kind === 'preset' ? presetOffsets(t.id, count) : t.offsets;
}

export function equalsTuning(a: Tuning, b: Tuning): boolean {
  if (a.kind === 'preset') return b.kind === 'preset' && a.id === b.id;
  return b.kind === 'custom' && a.offsets.every((v, i) => v === b.offsets[i]);
}

export function isStandard(t: Tuning): boolean {
  return t.kind === 'preset' && (t.id === DEFAULT_TUNING_ID || t.id === 'AF-21');
}

/** Low → high. Presets keep their own spelling; custom tunings use sharps (R-03). */
export function tuningStrings(t: Tuning, count: StringCount): readonly SpelledPitch[] {
  return t.kind === 'preset'
    ? presetStrings(t.id, count)
    : offsetPitches(t.offsets).map(spellSharp);
}

const customCache = new Map<string, Instrument>();

/** Memoized and frozen; string 1 (highest) first. */
export function tuningInstrument(t: Tuning, count: StringCount, fretCount: number): Instrument {
  if (t.kind === 'preset') return presetInstrument(t.id, count, fretCount);
  const frets = clampFrets(fretCount);
  const key = `${t.offsets.join(',')}|${count}|${frets}`;
  const hit = customCache.get(key);
  if (hit) return hit;
  const made = build(count, frets, tuningStrings(t, count));
  customCache.set(key, made);
  return made;
}
