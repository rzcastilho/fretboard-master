/**
 * Preferences codec (contracts/preferences-api.md §1, data-model §1–§2).
 * Pure: no DOM, Svelte or storage. `parsePreferences` is total; each field falls back on its own.
 */
import * as v from 'valibot';
import { isOffsets, type Offsets } from '$lib/instrument/custom-tuning';
import {
  DEFAULT_FRETS,
  MAX_FRETS,
  MIN_FRETS,
  isTuningId,
  tuningFromOffsets,
  type Tuning,
  type TuningId
} from '$lib/instrument/tunings';
import type { LabelType } from '$lib/state/notes-view';
import type { TriadsLabelType } from '$lib/state/triads-view';
import type { ToolId } from '$lib/shell/tools';

export interface Preferences {
  readonly tuningId: TuningId;
  /** Per-string semitone offsets (strings 6 → 1) of an unmatched custom tuning, else null. */
  readonly customTuning: Offsets | null;
  /** Integer 12–24. */
  readonly fretCount: number;
  readonly muted: boolean;
  /** Control scale 0–100, step 5. */
  readonly volume: number;
  readonly lastTool: ToolId | null;
  readonly labels: { readonly notes: LabelType; readonly triads: TriadsLabelType };
}

export const PREFS_VERSION = 1 as const;
export const MAX_RAW_LENGTH = 16_384 as const;

/** Checked against `TOOLS` by a unit test. */
export const TOOL_IDS = ['notes', 'triads'] as const satisfies readonly ToolId[];

export const DEFAULT_PREFERENCES: Preferences = Object.freeze({
  tuningId: 'AF-1',
  customTuning: null,
  fretCount: DEFAULT_FRETS,
  muted: false,
  volume: 80,
  lastTool: null,
  labels: Object.freeze({ notes: 'name', triads: 'interval' })
});

const NOTES_LABELS = ['name', 'octave', 'none'] as const satisfies readonly LabelType[];
const TRIADS_LABELS = ['interval', 'name'] as const satisfies readonly TriadsLabelType[];

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
  tuning: v.fallback(v.custom<TuningId>(isTuningId), d.tuningId),
  customTuning: v.fallback(v.nullable(v.custom<Offsets>(isOffsets)), null),
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
      triads: v.fallback(v.picklist(TRIADS_LABELS), d.labels.triads)
    }),
    d.labels
  )
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
    return {
      tuningId: r.tuning,
      customTuning: r.customTuning,
      fretCount: r.frets,
      muted: r.muted,
      volume: r.volume,
      lastTool: r.lastTool,
      labels: { notes: r.labels.notes, triads: r.labels.triads }
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Valid `customTuning` wins; it is canonicalized (a preset match loads as that preset). */
export function tuningOfPreferences(p: Preferences): Tuning {
  return p.customTuning !== null
    ? tuningFromOffsets(p.customTuning)
    : { kind: 'preset', id: p.tuningId };
}

/** v1 record, stable key order; `customTuning` and `lastTool` omitted when null. */
export function serializePreferences(p: Preferences): string {
  return JSON.stringify({
    version: PREFS_VERSION,
    tuning: p.tuningId,
    ...(p.customTuning === null ? {} : { customTuning: p.customTuning }),
    frets: p.fretCount,
    muted: p.muted,
    volume: p.volume / 100,
    ...(p.lastTool === null ? {} : { lastTool: p.lastTool }),
    labels: { notes: p.labels.notes, triads: p.labels.triads }
  });
}
