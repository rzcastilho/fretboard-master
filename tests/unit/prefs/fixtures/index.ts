import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TuningId } from '$lib/instrument/tunings';
import type { LabelType } from '$lib/state/notes-view';
import type { TriadsLabelType } from '$lib/state/triads-view';
import type { ToolId } from '$lib/shell/tools';

/**
 * Seed fixtures from specs/010-remembered-preferences/contracts/storage-format.md.
 * Fixtures are only ever added, never removed (records written by v1 must keep loading).
 *
 * The expected shape mirrors `Preferences` (src/lib/prefs/schema.ts) structurally so this
 * file does not depend on the codec it exercises.
 */
export interface ExpectedPreferences {
  readonly tuningId: TuningId;
  /** Parsed `customTuning` field (011); null when absent or invalid. */
  readonly customTuning: readonly number[] | null;
  readonly fretCount: number;
  readonly muted: boolean;
  readonly volume: number;
  readonly lastTool: ToolId | null;
  readonly labels: { readonly notes: LabelType; readonly triads: TriadsLabelType };
}

/** Tuning the record loads as (011): a preset, or custom pitches (offsets, strings 6 → 1). */
export type ExpectedTuning =
  | { readonly kind: 'preset'; readonly id: TuningId }
  | { readonly kind: 'custom'; readonly offsets: readonly number[] };

export interface PrefsFixture {
  readonly name: string;
  /** Raw stored value, exactly as it would sit in `localStorage`. */
  readonly raw: string;
  readonly expected: ExpectedPreferences;
  /** Loaded tuning; defaults to the preset named by `expected.tuningId`. */
  readonly tuning: ExpectedTuning;
}

const defaults: ExpectedPreferences = {
  tuningId: 'AF-1',
  customTuning: null,
  fretCount: 22,
  muted: false,
  volume: 80,
  lastTool: null,
  labels: { notes: 'name', triads: 'interval' }
};

function load(name: string): string {
  return readFileSync(resolve(process.cwd(), 'tests/unit/prefs/fixtures', `${name}.txt`), 'utf8');
}

function fixture(
  name: string,
  expected: ExpectedPreferences,
  tuning?: ExpectedTuning
): PrefsFixture {
  return {
    name,
    raw: load(name),
    expected,
    tuning: tuning ?? { kind: 'preset', id: expected.tuningId }
  };
}

export const FIXTURES: readonly PrefsFixture[] = [
  fixture('v1-full', {
    tuningId: 'AF-3',
    customTuning: null,
    fretCount: 24,
    muted: true,
    volume: 35,
    lastTool: 'triads',
    labels: { notes: 'octave', triads: 'name' }
  }),
  fixture('bad-volume', { ...defaults, tuningId: 'AF-2' }),
  fixture('garbage', defaults),
  fixture('array', defaults),
  fixture('future', { ...defaults, tuningId: 'AF-5' }),
  fixture('wrong-types', defaults),
  fixture('markup', defaults),
  // 16 385 × 'a': one over MAX_RAW_LENGTH, so it is never parsed.
  fixture('oversize', defaults),
  fixture(
    'v1-custom',
    { ...defaults, customTuning: [-2, 0, 0, -1, 0, 0], fretCount: 24 },
    { kind: 'custom', offsets: [-2, 0, 0, -1, 0, 0] }
  ),
  fixture(
    'v1-custom-drop-d',
    { ...defaults, customTuning: [-2, 0, 0, 0, 0, 0] },
    {
      kind: 'preset',
      id: 'AF-4'
    }
  ),
  fixture('custom-wrong-length', { ...defaults, tuningId: 'AF-3', fretCount: 20 }),
  fixture('custom-out-of-range', { ...defaults, muted: true }),
  fixture('custom-non-integer', { ...defaults, tuningId: 'AF-2' }),
  fixture('custom-non-array', { ...defaults, volume: 50 })
];

export const FIXTURE_BY_NAME: Readonly<Record<string, PrefsFixture>> = Object.fromEntries(
  FIXTURES.map((f) => [f.name, f])
);
