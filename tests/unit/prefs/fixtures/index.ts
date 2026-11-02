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
import {
  DEFAULT_PLAIN_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_SPEED_SETTINGS,
  type MetronomeMode,
  type MetronomeSettings,
  type PlainSettings,
  type SpeedSettings
} from '$lib/state/metronome-settings';

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
  /** 027: absent or invalid in a record → true. */
  readonly shortcuts: boolean;
  /** 035: set only by metronome fixtures; absent means every field at its default (DEFAULT_SETTINGS). */
  readonly metronome?: {
    readonly ratios?: MetronomeSettings;
    /** 036: absent means the plain defaults. */
    readonly plain?: PlainSettings;
    /** 036: absent means 'ratios'. */
    /** 037: absent means the speed defaults. */
    readonly speed?: SpeedSettings;
    readonly mode?: MetronomeMode;
    /** 039: absent means 2. */
    readonly timer?: number;
  };
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
  tempo: 'medium',
  language: null,
  notation: null,
  accidentals: 'sharps',
  cagedNoteShown: false,
  theme: null,
  shortcuts: true
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
    expected: {
      ...expected,
      metronome: {
        ratios: expected.metronome?.ratios ?? DEFAULT_SETTINGS,
        plain: expected.metronome?.plain ?? DEFAULT_PLAIN_SETTINGS,
        speed: expected.metronome?.speed ?? DEFAULT_SPEED_SETTINGS,
        mode: expected.metronome?.mode ?? 'ratios',
        timer: expected.metronome?.timer ?? 2
      }
    },
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
    tempo: 'medium',
    language: null,
    notation: null,
    accidentals: 'sharps',
    cagedNoteShown: false,
    theme: null,
    shortcuts: true
  }),
  fixture('bad-volume', { ...defaults, tuningId: 'AF-2' }),
  fixture('garbage', defaults),
  fixture('array', defaults),
  // The reader ignores `version`; the record's fields are read as for v1 (handedness included).
  // (the record also carries `"tempo":"slow"`, read as for v1)
  fixture('future', { ...defaults, tuningId: 'AF-5', handedness: 'left', tempo: 'slow' }),
  fixture('wrong-types', { ...defaults, lastTool: 'caged' }),
  fixture('last-tool-caged', { ...defaults, lastTool: 'caged' }),
  fixture('last-tool-metronome', { ...defaults, lastTool: 'metronome' }),
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
  fixture('caged-note', { ...defaults, cagedNoteShown: true }),
  // 027 keyboard shortcuts switch: written only when false, last key
  fixture('shortcuts-off', { ...defaults, theme: 'dark', shortcuts: false }),
  // 035 remembered metronome settings: `metronome` is the last key, written only when non-default
  fixture('metronome-ratios', {
    ...defaults,
    metronome: { ratios: { ...DEFAULT_SETTINGS, bpm: 120, beats: 2, loop2: 5 } }
  }),
  fixture('metronome-full', {
    ...defaults,
    metronome: {
      ratios: {
        bpm: 140,
        beats: 6,
        subdivision: 2,
        countIn: false,
        initialCountIn: 2,
        repeatCountIn: 1,
        ratio: false,
        loop2: 4
      }
    }
  }),
  // bpm 900 resets only bpm; the other seven fields keep their stored values
  fixture('metronome-bad-bpm', {
    ...defaults,
    metronome: {
      ratios: {
        bpm: DEFAULT_SETTINGS.bpm,
        beats: 6,
        subdivision: 2,
        countIn: false,
        initialCountIn: 2,
        repeatCountIn: 1,
        ratio: false,
        loop2: 4
      }
    }
  }),
  fixture('metronome-wrong-types', defaults),
  fixture('metronome-array', defaults),
  fixture('metronome-null-ratios', defaults),
  // the `speed` entry holds only an unknown key: speed defaults (R-12)
  fixture('metronome-other-mode', {
    ...defaults,
    metronome: { ratios: { ...DEFAULT_SETTINGS, bpm: 120, beats: 2, loop2: 5 } }
  }),
  // 036 plain Metronome record and selected mode
  fixture('metronome-plain', {
    ...defaults,
    metronome: {
      ratios: { ...DEFAULT_SETTINGS, bpm: 120 },
      plain: { bpm: 100, beats: 3, countIn: true, initialCountIn: 4, subdivision: 1 },
      mode: 'plain'
    }
  }),
  fixture('metronome-mode-plain', { ...defaults, metronome: { mode: 'plain' } }),
  // 037: mode "speed" is a mode now (R-12); the stored ratios stay intact
  fixture('metronome-bad-mode', {
    ...defaults,
    metronome: { ratios: { ...DEFAULT_SETTINGS, bpm: 120 }, mode: 'speed' }
  }),
  // bpm 999 resets only bpm; the other plain fields and the mode keep their stored values
  fixture('metronome-plain-invalid', {
    ...defaults,
    metronome: {
      plain: {
        bpm: DEFAULT_PLAIN_SETTINGS.bpm,
        beats: 3,
        countIn: false,
        initialCountIn: 2,
        subdivision: 1
      },
      mode: 'plain'
    }
  }),
  // 038: plain subdivision stored, and an invalid one falling back to 1
  fixture('metronome-plain-subdivision', {
    ...defaults,
    metronome: {
      plain: { bpm: 100, beats: 3, countIn: true, initialCountIn: 4, subdivision: 3 },
      mode: 'plain'
    }
  }),
  fixture('metronome-plain-subdivision-invalid', {
    ...defaults,
    metronome: {
      plain: { bpm: 100, beats: 3, countIn: false, initialCountIn: 2, subdivision: 1 },
      mode: 'plain'
    }
  }),
  fixture('metronome-plain-array', { ...defaults, metronome: { mode: 'plain' } }),
  // 037 Speed Training record and selected mode
  fixture('metronome-speed', {
    ...defaults,
    metronome: {
      speed: { ...DEFAULT_SPEED_SETTINGS, startBpm: 80, targetBpm: 120, atTarget: 'stop' },
      mode: 'speed'
    }
  }),
  fixture('metronome-mode-speed', { ...defaults, metronome: { mode: 'speed' } }),
  // startBpm 999, "90", 0, 4.5 and "HOLD" reset only themselves
  fixture('metronome-speed-invalid', {
    ...defaults,
    metronome: {
      speed: {
        ...DEFAULT_SPEED_SETTINGS,
        beats: 3,
        countIn: false,
        initialCountIn: 2
      },
      mode: 'speed'
    }
  }),
  // target 150 below start 200 is lifted to 200 (R15)
  fixture('metronome-speed-target-below', {
    ...defaults,
    metronome: {
      speed: { ...DEFAULT_SPEED_SETTINGS, startBpm: 200, targetBpm: 200 },
      mode: 'speed'
    }
  }),
  fixture('metronome-speed-array', { ...defaults, metronome: { mode: 'speed' } }),
  fixture('metronome-all-modes', {
    ...defaults,
    metronome: {
      ratios: { ...DEFAULT_SETTINGS, bpm: 120, beats: 2, loop2: 5 },
      plain: { bpm: 100, beats: 3, countIn: true, initialCountIn: 4, subdivision: 1 },
      speed: { ...DEFAULT_SPEED_SETTINGS, startBpm: 80, targetBpm: 120, atTarget: 'stop' },
      mode: 'speed'
    }
  }),
  // 039: the practice timer preset (minutes) beside the other metronome parts
  fixture('metronome-timer', { ...defaults, metronome: { timer: 5 } }),
  fixture('metronome-timer-with-plain', {
    ...defaults,
    metronome: {
      plain: { bpm: 100, beats: 3, countIn: true, initialCountIn: 4, subdivision: 3 },
      mode: 'plain',
      timer: 10
    }
  }),
  // "7" is not an integer: timer → 2, the mode is kept
  fixture('metronome-timer-invalid', { ...defaults, metronome: { mode: 'speed' } })
];

export const FIXTURE_BY_NAME: Readonly<Record<string, PrefsFixture>> = Object.fromEntries(
  FIXTURES.map((f) => [f.name, f])
);
