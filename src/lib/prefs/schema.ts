/**
 * Preferences codec (contracts/preferences-api.md §1, data-model §1–§2).
 * Pure: no DOM, Svelte or storage. `parsePreferences` is total; each field falls back on its own.
 */
import * as v from 'valibot';
import type { Handedness, Orientation } from '$lib/instrument/instrument';
import { isOffsets, type Offsets } from '$lib/instrument/custom-tuning';
import {
  DEFAULT_FRETS,
  DEFAULT_STRING_COUNT,
  MAX_FRETS,
  MIN_FRETS,
  isStringCount,
  isTuningId,
  normalizePresetId,
  standardTuningId,
  tuningFromOffsets,
  type StringCount,
  type Tuning,
  type TuningId
} from '$lib/instrument/tunings';
import type { LabelType } from '$lib/state/notes-view';
import type { CagedLabelType } from '$lib/state/caged-view';
import type { TriadsLabelType } from '$lib/state/triads-view';
import type { ToolId } from '$lib/shell/tools';
import type { Tempo } from '$lib/state/listen';
import { LANGUAGE_TAGS, type LanguageTag } from '$lib/i18n/languages';
import {
  ACCIDENTAL_POLICIES,
  NOTATIONS,
  type AccidentalPolicy,
  type Notation
} from '$lib/notation/policy';

/** 026: the pinned theme; `null` follows the device. Mirrored by `static/theme-boot.js`. */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface Preferences {
  /** 6 or 7 (012); absent or invalid in a stored record → 6. */
  readonly stringCount: StringCount;
  readonly tuningId: TuningId;
  /** Per-string semitone offsets (strings count → 1) of an unmatched custom tuning, else null. */
  readonly customTuning: Offsets | null;
  /** Integer 12–24. */
  readonly fretCount: number;
  readonly muted: boolean;
  /** Control scale 0–100, step 5. */
  readonly volume: number;
  readonly lastTool: ToolId | null;
  readonly labels: {
    readonly notes: LabelType;
    readonly triads: TriadsLabelType;
    /** 017; absent or invalid in a stored record → 'interval'. Stored only when 'name'. */
    readonly caged: CagedLabelType;
  };
  /** 013; absent or invalid in a stored record → 'right'. */
  readonly handedness: Handedness;
  /** 013; absent or invalid in a stored record → 'highest-top'. */
  readonly orientation: Orientation;
  /** 019; absent or invalid in a stored record → 'medium'. Stored only when not 'medium'. */
  readonly tempo: Tempo;
  /** 020; absent or invalid in a stored record → null (no stored choice). Stored only when non-null. */
  readonly language: LanguageTag | null;
  /** 021; absent or invalid in a stored record → null (follow the language). Stored only when non-null. */
  readonly notation: Notation | null;
  /** 021; absent or invalid in a stored record → 'sharps'. Stored only when not 'sharps'. */
  readonly accidentals: AccidentalPolicy;
  /** 021; absent or invalid in a stored record → false. Stored as `cagedNote`, only when true. */
  readonly cagedNoteShown: boolean;
  /** 026; absent or invalid in a stored record → null (follow the device). Stored only when non-null. */
  readonly theme: Theme | null;
  /** 027; absent or invalid in a stored record → true. Stored only when false, last. */
  readonly shortcuts: boolean;
}

export const PREFS_VERSION = 1 as const;
export const MAX_RAW_LENGTH = 16_384 as const;

/** Checked against `TOOLS` by a unit test. */
export const TOOL_IDS = ['notes', 'triads', 'caged'] as const satisfies readonly ToolId[];

export const DEFAULT_PREFERENCES: Preferences = Object.freeze({
  stringCount: DEFAULT_STRING_COUNT,
  tuningId: 'AF-1',
  customTuning: null,
  fretCount: DEFAULT_FRETS,
  muted: false,
  volume: 80,
  lastTool: null,
  labels: Object.freeze({ notes: 'name', triads: 'interval', caged: 'interval' }),
  handedness: 'right',
  orientation: 'highest-top',
  tempo: 'medium',
  language: null,
  notation: null,
  accidentals: 'sharps',
  cagedNoteShown: false,
  theme: null,
  shortcuts: true
});

/**
 * 027 (FR-019(f)): which privacy-policy category (`about_privacy_stored`) names each stored
 * preference. A unit test requires every `Preferences` field here, so a new preference with no
 * policy category fails the build.
 */
export const PRIVACY_CATEGORIES = {
  language: ['language', 'notation', 'accidentals'],
  instrument: ['stringCount', 'tuningId', 'customTuning', 'fretCount', 'handedness', 'orientation'],
  sound: ['muted', 'volume', 'tempo'],
  theme: ['theme'],
  labelsAndTool: ['labels', 'lastTool'],
  hints: ['cagedNoteShown'],
  shortcuts: ['shortcuts']
} as const satisfies Record<string, readonly (keyof Preferences)[]>;

export const NOTES_LABELS = ['name', 'octave', 'none'] as const satisfies readonly LabelType[];
export const TRIADS_LABELS = ['interval', 'name'] as const satisfies readonly TriadsLabelType[];
const TEMPO_VALUES = ['slow', 'medium', 'fast'] as const satisfies readonly Tempo[];
export const CAGED_LABELS = ['interval', 'name'] as const satisfies readonly CagedLabelType[];

const d = DEFAULT_PREFERENCES;

const volumeSchema = v.fallback(
  v.pipe(
    v.number(),
    v.finite(),
    v.minValue(0),
    v.maxValue(1),
    v.transform((x) => Math.round(x * 20) * 5)
  ),
  d.volume
);

const recordSchema = v.object({
  strings: v.fallback(v.custom<StringCount>(isStringCount), d.stringCount),
  // Normalized for the read count below (reader rule 11).
  tuning: v.fallback(v.custom<TuningId>(isTuningId), d.tuningId),
  // Length is checked against the read count below (reader rule 12).
  customTuning: v.fallback(v.nullable(v.unknown()), null),
  frets: v.fallback(
    v.pipe(v.number(), v.integer(), v.minValue(MIN_FRETS), v.maxValue(MAX_FRETS)),
    d.fretCount
  ),
  muted: v.fallback(v.boolean(), d.muted),
  volume: volumeSchema,
  lastTool: v.fallback(v.nullable(v.picklist(TOOL_IDS)), null),
  labels: v.fallback(
    v.object({
      notes: v.fallback(v.picklist(NOTES_LABELS), d.labels.notes),
      triads: v.fallback(v.picklist(TRIADS_LABELS), d.labels.triads),
      caged: v.fallback(v.picklist(CAGED_LABELS), d.labels.caged)
    }),
    d.labels
  ),
  handedness: v.fallback(v.picklist(['right', 'left']), d.handedness),
  orientation: v.fallback(v.picklist(['highest-top', 'lowest-top']), d.orientation),
  tempo: v.fallback(v.picklist(TEMPO_VALUES), d.tempo),
  language: v.fallback(v.nullable(v.picklist(LANGUAGE_TAGS)), null),
  notation: v.fallback(v.nullable(v.picklist(NOTATIONS)), null),
  accidentals: v.fallback(v.picklist(ACCIDENTAL_POLICIES), d.accidentals),
  cagedNote: v.fallback(v.boolean(), d.cagedNoteShown),
  theme: v.fallback(v.nullable(v.picklist(THEMES)), null),
  shortcuts: v.fallback(v.boolean(), d.shortcuts)
});

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Total: null, oversize, non-JSON and non-object input give the defaults; never throws. */
export function parsePreferences(raw: string | null): Preferences {
  if (raw === null || raw.length > MAX_RAW_LENGTH) return DEFAULT_PREFERENCES;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return DEFAULT_PREFERENCES;
    const r = v.parse(recordSchema, parsed);
    const count = r.strings;
    const hasTuning = isTuningId(parsed.tuning);
    return {
      stringCount: count,
      tuningId: hasTuning ? normalizePresetId(r.tuning, count) : standardTuningId(count),
      customTuning: isOffsets(r.customTuning, count) ? r.customTuning : null,
      fretCount: r.frets,
      muted: r.muted,
      volume: r.volume,
      lastTool: r.lastTool,
      labels: { notes: r.labels.notes, triads: r.labels.triads, caged: r.labels.caged },
      handedness: r.handedness,
      orientation: r.orientation,
      tempo: r.tempo,
      language: r.language,
      notation: r.notation,
      accidentals: r.accidentals,
      cagedNoteShown: r.cagedNote,
      theme: r.theme,
      shortcuts: r.shortcuts
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Valid `customTuning` wins; it is canonicalized against the count's presets (a match loads as
 * that preset). Otherwise the preset id, normalized for the string count.
 */
export function tuningOfPreferences(p: Preferences): Tuning {
  return p.customTuning !== null && isOffsets(p.customTuning, p.stringCount)
    ? tuningFromOffsets(p.customTuning)
    : { kind: 'preset', id: normalizePresetId(p.tuningId, p.stringCount) };
}

/**
 * v1 record, stable key order; `strings` only for 7 strings (6 stays byte-identical to slice
 * 011), `customTuning` and `lastTool` omitted when null, `handedness`/`orientation` only when non-default (013),
 * `labels.caged` only when `'name'` (017),
 * `tempo` (after `orientation`) only when not `'medium'` (019), `language` (after `tempo`) only
 * when non-null (020), then `notation` (non-null), `accidentals` (not `'sharps'`) and
 * `cagedNote` (true only) (021), then `theme` (non-null) (026), then `shortcuts` (false only) last (027).
 */
export function serializePreferences(p: Preferences): string {
  return JSON.stringify({
    version: PREFS_VERSION,
    ...(p.stringCount === 6 ? {} : { strings: p.stringCount }),
    tuning: p.tuningId,
    ...(p.customTuning === null ? {} : { customTuning: p.customTuning }),
    frets: p.fretCount,
    muted: p.muted,
    volume: p.volume / 100,
    ...(p.lastTool === null ? {} : { lastTool: p.lastTool }),
    labels: {
      notes: p.labels.notes,
      triads: p.labels.triads,
      ...(p.labels.caged === 'name' ? { caged: 'name' } : {})
    },
    ...(p.handedness === 'left' ? { handedness: 'left' } : {}),
    ...(p.orientation === 'lowest-top' ? { orientation: 'lowest-top' } : {}),
    ...(p.tempo === 'medium' ? {} : { tempo: p.tempo }),
    ...(p.language === null ? {} : { language: p.language }),
    ...(p.notation === null ? {} : { notation: p.notation }),
    ...(p.accidentals === 'sharps' ? {} : { accidentals: p.accidentals }),
    ...(p.cagedNoteShown ? { cagedNote: true } : {}),
    ...(p.theme === null ? {} : { theme: p.theme }),
    ...(p.shortcuts ? {} : { shortcuts: false })
  });
}
