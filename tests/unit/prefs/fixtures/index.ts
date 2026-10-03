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
  readonly fretCount: number;
  readonly muted: boolean;
  readonly volume: number;
  readonly lastTool: ToolId | null;
  readonly labels: { readonly notes: LabelType; readonly triads: TriadsLabelType };
}

export interface PrefsFixture {
  readonly name: string;
  /** Raw stored value, exactly as it would sit in `localStorage`. */
  readonly raw: string;
  readonly expected: ExpectedPreferences;
}

const defaults: ExpectedPreferences = {
  tuningId: 'AF-1',
  fretCount: 22,
  muted: false,
  volume: 80,
  lastTool: null,
  labels: { notes: 'name', triads: 'interval' }
};

function load(name: string): string {
  return readFileSync(resolve(process.cwd(), 'tests/unit/prefs/fixtures', `${name}.txt`), 'utf8');
}

function fixture(name: string, expected: ExpectedPreferences): PrefsFixture {
  return { name, raw: load(name), expected };
}

export const FIXTURES: readonly PrefsFixture[] = [
  fixture('v1-full', {
    tuningId: 'AF-3',
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
  fixture('oversize', defaults)
];

export const FIXTURE_BY_NAME: Readonly<Record<string, PrefsFixture>> = Object.fromEntries(
  FIXTURES.map((f) => [f.name, f])
);
