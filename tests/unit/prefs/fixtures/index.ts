import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TuningId } from '$lib/instrument/tunings';
import type { LabelType } from '$lib/state/notes-view';
import type { TriadsLabelType } from '$lib/state/triads-view';
import type { CagedLabelType } from '$lib/state/caged-view';
import type { ToolId } from '$lib/shell/tools';
import type { Tempo } from '$lib/state/listen';
import type { LanguageTag } from '$lib/i18n/languages';
import type { AccidentalPolicy, Notation } from '$lib/notation/policy';
import type { Theme } from '$lib/prefs/schema';

/**
 * Seed fixtures from specs/010-remembered-preferences/contracts/storage-format.md.
 * Fixtures are only ever added, never removed (records written by v1 must keep loading).
 *
 * The expected shape mirrors `Preferences` (src/lib/prefs/schema.ts) structurally so this
 * file does not depend on the codec it exercises.
 */
export interface ExpectedPreferences {
  /** String count (012): 6 or 7; absent/invalid in a record → 6. */
  readonly stringCount: 6 | 7;
  readonly tuningId: TuningId;
  /** Parsed `customTuning` field (011); null when absent or invalid. */
  readonly customTuning: readonly number[] | null;
  readonly fretCount: number;
  readonly muted: boolean;
  readonly volume: number;
  readonly lastTool: ToolId | null;
  readonly labels: {
    readonly notes: LabelType;
    readonly triads: TriadsLabelType;
    /** 017: absent or invalid in a record → 'interval'. */
    readonly caged: CagedLabelType;
  };
  /** 013: absent or invalid in a record → right / highest-top. */
  readonly handedness: 'right' | 'left';
  readonly orientation: 'highest-top' | 'lowest-top';
  /** 016: absent or invalid in a record → false. */
  readonly rotateHintShown: boolean;
  /** 019: absent or invalid in a record → 'medium'. */
  readonly tempo: Tempo;
  /** 020: absent or invalid in a record → null (no stored choice). */
  readonly language: LanguageTag | null;
  /** 021: absent or invalid in a record → null (follow the language). */
  readonly notation: Notation | null;
  /** 021: absent or invalid in a record → 'sharps'. */
  readonly accidentals: AccidentalPolicy;
  /** 021: stored as `cagedNote`; absent or invalid in a record → false. */
  readonly cagedNoteShown: boolean;
  readonly theme: Theme | null;
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
  stringCount: 6,
  tuningId: 'AF-1',
  customTuning: null,
  fretCount: 22,
  muted: false,
  volume: 80,
  lastTool: null,
  labels: { notes: 'name', triads: 'interval', caged: 'interval' },
  handedness: 'right',
  orientation: 'highest-top',
  rotateHintShown: false,
  tempo: 'medium',
  language: null,
  notation: null,
  accidentals: 'sharps',
  cagedNoteShown: false,
  theme: null
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
    stringCount: 6,
    tuningId: 'AF-3',
    customTuning: null,
    fretCount: 24,
    muted: true,
    volume: 35,
    lastTool: 'triads',
    labels: { notes: 'octave', triads: 'name', caged: 'interval' },
    handedness: 'right',
    orientation: 'highest-top',
    rotateHintShown: false,
    tempo: 'medium',
    language: null,
    notation: null,
    accidentals: 'sharps',
    cagedNoteShown: false,
    theme: null
  }),
  fixture('bad-volume', { ...defaults, tuningId: 'AF-2' }),
  fixture('garbage', defaults),
  fixture('array', defaults),
  // The reader ignores `version`; the record's fields are read as for v1 (handedness included).
  // (the record also carries `"tempo":"slow"`, read as for v1)
  fixture('future', { ...defaults, tuningId: 'AF-5', handedness: 'left', tempo: 'slow' }),
  fixture('wrong-types', { ...defaults, lastTool: 'caged' }),
  fixture('last-tool-caged', { ...defaults, lastTool: 'caged' }),
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
  fixture('custom-non-array', { ...defaults, volume: 50 }),
  // 012 seven-strings (contracts/storage-format.md)
  fixture('v1-seven-standard', {
    ...defaults,
    stringCount: 7,
    tuningId: 'AF-21',
    fretCount: 24
  }),
  fixture('v1-seven-drop-a', { ...defaults, stringCount: 7, tuningId: 'AF-23' }),
  fixture('v1-seven-drop-d', { ...defaults, stringCount: 7, tuningId: 'AF-4' }),
  fixture(
    'v1-seven-custom',
    { ...defaults, stringCount: 7, tuningId: 'AF-21', customTuning: [-3, 0, 0, 0, 0, 0, 0] },
    { kind: 'custom', offsets: [-3, 0, 0, 0, 0, 0, 0] }
  ),
  fixture(
    'v1-seven-custom-drop-a',
    { ...defaults, stringCount: 7, tuningId: 'AF-21', customTuning: [-2, 0, 0, 0, 0, 0, 0] },
    { kind: 'preset', id: 'AF-23' }
  ),
  fixture('seven-af1', { ...defaults, stringCount: 7, tuningId: 'AF-21' }),
  fixture('seven-af2', { ...defaults, stringCount: 7, tuningId: 'AF-22', fretCount: 20 }),
  fixture('six-af21', { ...defaults, stringCount: 6, tuningId: 'AF-1', fretCount: 18 }),
  fixture('strings-absent-af23', { ...defaults, tuningId: 'AF-1' }),
  fixture('strings-invalid', { ...defaults, tuningId: 'AF-4', muted: true }),
  fixture('strings-string', { ...defaults, tuningId: 'AF-1' }),
  fixture('seven-custom-six-long', { ...defaults, stringCount: 7, tuningId: 'AF-23' }),
  fixture('six-custom-seven-long', { ...defaults, tuningId: 'AF-3' }),
  // 013 left-handed and orientation (contracts/storage-format.md)
  fixture('left-only', { ...defaults, handedness: 'left' }),
  fixture('lowest-only', { ...defaults, orientation: 'lowest-top' }),
  fixture('bad-handed', { ...defaults, orientation: 'lowest-top', tuningId: 'AF-2' }),
  fixture('left-lowest-full', {
    ...defaults,
    stringCount: 7,
    tuningId: 'AF-21',
    fretCount: 24,
    handedness: 'left',
    orientation: 'lowest-top'
  }),
  fixture('bad-orientation', { ...defaults, handedness: 'left', fretCount: 18 }),
  // 017 CAGED label type: written only when 'name'
  fixture('labels-caged-name', {
    ...defaults,
    labels: { notes: 'name', triads: 'interval', caged: 'name' }
  }),
  // 019 Listen tempo: written only when not 'medium'
  fixture('tempo-fast', { ...defaults, tempo: 'fast' }),
  fixture('bad-tempo', { ...defaults, tuningId: 'AF-3', fretCount: 20, muted: true }),
  // 020 language: written only when non-null
  fixture('language-pt', { ...defaults, language: 'pt-BR' }),
  fixture('language-es', { ...defaults, language: 'es' }),
  fixture('bad-language', { ...defaults, tuningId: 'AF-3', fretCount: 20, muted: true }),
  fixture('language-number', { ...defaults, tuningId: 'AF-3', fretCount: 20, muted: true }),
  // 021 notation, accidentals and CAGED note: each written only when non-default
  fixture('notation-solfege', { ...defaults, notation: 'solfege' }),
  fixture('notation-letters', { ...defaults, notation: 'letters' }),
  fixture('accidentals-flats', { ...defaults, accidentals: 'flats' }),
  fixture('accidentals-both', { ...defaults, accidentals: 'both' }),
  fixture('bad-notation', { ...defaults, tuningId: 'AF-3', fretCount: 20, muted: true }),
  fixture('bad-accidentals', { ...defaults, tuningId: 'AF-3', fretCount: 20, muted: true }),
  fixture('caged-note', { ...defaults, cagedNoteShown: true })
];

export const FIXTURE_BY_NAME: Readonly<Record<string, PrefsFixture>> = Object.fromEntries(
  FIXTURES.map((f) => [f.name, f])
);
