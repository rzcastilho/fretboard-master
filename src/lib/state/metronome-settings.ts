/** Metronome settings maths (031, data-model §1). Pure. */
import type { SegmentStart } from '../audio/metronome';
import { MAX_BPM, MIN_BPM } from '../audio/schedule';

export type PlanFields = Pick<SegmentStart, 'clicksPerBeat' | 'initialCountIn' | 'alternate'>;

export type Subdivision = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const SUBDIVISIONS: readonly Subdivision[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const DEFAULT_SUBDIVISION: Subdivision = 3;
export const DEFAULT_LOOP2: Subdivision = 6;

export interface MetronomeSettings {
  readonly bpm: number;
  readonly beats: number;
  readonly subdivision: Subdivision;
  /** Count-in switch (033). Turning it off keeps both counts. */
  readonly countIn: boolean;
  /** Clicks before the first loop, 0–8. */
  readonly initialCountIn: number;
  /** Clicks before each loop switch, 0–8; played when the count-in and the ratio are on. */
  readonly repeatCountIn: number;
  /** Subdivision ratio section switch (034); `subdivision` is Loop 1. */
  readonly ratio: boolean;
  /** Loop 2 clicks per beat (034); kept while the section is off. */
  readonly loop2: Subdivision;
}

/** The numeric fields adjusted by steppers. */
export type SettingField = 'bpm' | 'beats' | 'initialCountIn' | 'repeatCountIn';

/** Fields shared by both modes (036). */
export type PlainField = 'bpm' | 'beats' | 'initialCountIn';

export type MetronomeMode = 'plain' | 'ratios';

/** Tab order (036). A later slice adds one entry. */
export const METRONOME_MODES: readonly MetronomeMode[] = ['plain', 'ratios'];
export const DEFAULT_MODE: MetronomeMode = 'ratios';

/** Plain Metronome settings (036): one click per beat. `MetronomeSettings` is a superset. */
export interface PlainSettings {
  readonly bpm: number;
  readonly beats: number;
  readonly countIn: boolean;
  readonly initialCountIn: number;
}

export const MIN_BEATS = 1;
export const MAX_BEATS = 16;

export const MIN_COUNT_IN = 0;
export const MAX_COUNT_IN = 8;
export const DEFAULT_INITIAL_COUNT_IN = 4;
export const DEFAULT_REPEAT_COUNT_IN = 2;

export const DEFAULT_SETTINGS: Readonly<MetronomeSettings> = Object.freeze({
  bpm: 85,
  beats: 4,
  subdivision: DEFAULT_SUBDIVISION,
  countIn: true,
  initialCountIn: DEFAULT_INITIAL_COUNT_IN,
  repeatCountIn: DEFAULT_REPEAT_COUNT_IN,
  ratio: true,
  loop2: DEFAULT_LOOP2
});

export const DEFAULT_PLAIN_SETTINGS: Readonly<PlainSettings> = Object.freeze({
  bpm: 85,
  beats: 4,
  countIn: true,
  initialCountIn: DEFAULT_INITIAL_COUNT_IN
});

const LIMITS: Record<SettingField, readonly [number, number]> = {
  bpm: [MIN_BPM, MAX_BPM],
  beats: [MIN_BEATS, MAX_BEATS],
  initialCountIn: [MIN_COUNT_IN, MAX_COUNT_IN],
  repeatCountIn: [MIN_COUNT_IN, MAX_COUNT_IN]
};

function clampTo(v: number, [min, max]: readonly [number, number]): number {
  if (Number.isNaN(v)) return min;
  return Math.round(Math.min(max, Math.max(min, v)));
}

/** 30–300, rounded; NaN → 30. */
export const clampBpm = (v: number): number => clampTo(v, LIMITS.bpm);

/** 1–16, rounded; NaN → 1. */
export const clampBeats = (v: number): number => clampTo(v, LIMITS.beats);

/** 0–8, rounded; NaN → `fallback`. */
export function clampCount(v: number, fallback: number): number {
  if (Number.isNaN(v)) return fallback;
  return clampTo(v, [MIN_COUNT_IN, MAX_COUNT_IN]);
}

/** Clicks in the count-in of a run: the Initial Count In when the switch is on, else 0. */
export const effectiveCountIn = (s: Pick<PlainSettings, 'countIn' | 'initialCountIn'>): number =>
  s.countIn ? s.initialCountIn : 0;

/** Clicks before each loop switch: the Repeat Count In when the count-in and the ratio are on. */
export const effectiveRepeatCountIn = (s: MetronomeSettings): number =>
  s.countIn && s.ratio ? s.repeatCountIn : 0;

/** Booleans as they are, anything else is the default (on). Never throws. */
export const toRatio = (v: unknown): boolean => (typeof v === 'boolean' ? v : true);

/** The plan fields of a scheduler segment for these settings. */
export function runPlanFor(s: MetronomeSettings): PlanFields {
  return {
    clicksPerBeat: s.subdivision,
    initialCountIn: effectiveCountIn(s),
    ...(s.ratio
      ? { alternate: { clicksPerBeat: s.loop2, repeatCountIn: effectiveRepeatCountIn(s) } }
      : {})
  };
}

/** The plan fields of a plain run: one click per beat, no alternation (036). */
export function plainRunPlan(p: PlainSettings): PlanFields {
  return { clicksPerBeat: 1, initialCountIn: effectiveCountIn(p) };
}

/** `'plain'` or `'ratios'`, otherwise null. Never throws. */
export function toMode(v: unknown): MetronomeMode | null {
  return v === 'plain' || v === 'ratios' ? v : null;
}

/** A number or numeric string that is one of 1-8, otherwise null. Never throws. */
export function toSubdivision(v: unknown): Subdivision | null {
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return (SUBDIVISIONS as readonly number[]).includes(n) ? (n as Subdivision) : null;
}

/** True when a step in `dir` would not change the field. */
export function atLimit(s: MetronomeSettings, field: SettingField, dir: 1 | -1): boolean;
export function atLimit(s: PlainSettings, field: PlainField, dir: 1 | -1): boolean;
export function atLimit(s: PlainSettings, field: SettingField, dir: 1 | -1): boolean {
  const [min, max] = LIMITS[field];
  const v = (s as unknown as Record<SettingField, number>)[field];
  return dir === 1 ? v >= max : v <= min;
}

/** A clamped copy, or the same object at a limit. */
export function stepSetting(
  s: MetronomeSettings,
  field: SettingField,
  dir: 1 | -1
): MetronomeSettings;
export function stepSetting(s: PlainSettings, field: PlainField, dir: 1 | -1): PlainSettings;
export function stepSetting(s: PlainSettings, field: SettingField, dir: 1 | -1): PlainSettings {
  if (atLimit(s as MetronomeSettings, field, dir)) return s;
  const v = (s as unknown as Record<SettingField, number>)[field];
  return { ...s, [field]: v + dir };
}
