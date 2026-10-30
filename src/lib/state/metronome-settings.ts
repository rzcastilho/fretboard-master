/** Metronome settings maths (031, data-model §1). Pure. */
import { MAX_BPM, MIN_BPM } from '../audio/schedule';

export type Subdivision = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const SUBDIVISIONS: readonly Subdivision[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const DEFAULT_SUBDIVISION: Subdivision = 3;

export interface MetronomeSettings {
  readonly bpm: number;
  readonly beats: number;
  readonly subdivision: Subdivision;
  /** Count-in switch (033). Turning it off keeps both counts. */
  readonly countIn: boolean;
  /** Clicks before the first loop, 0–8. */
  readonly initialCountIn: number;
  /** Clicks before each repeat, 0–8. Stored only; no playback effect yet. */
  readonly repeatCountIn: number;
}

/** The numeric fields adjusted by steppers. */
export type SettingField = 'bpm' | 'beats' | 'initialCountIn' | 'repeatCountIn';

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
  repeatCountIn: DEFAULT_REPEAT_COUNT_IN
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
export const effectiveCountIn = (s: MetronomeSettings): number =>
  s.countIn ? s.initialCountIn : 0;

/** A number or numeric string that is one of 1-8, otherwise null. Never throws. */
export function toSubdivision(v: unknown): Subdivision | null {
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return (SUBDIVISIONS as readonly number[]).includes(n) ? (n as Subdivision) : null;
}

/** True when a step in `dir` would not change the field. */
export function atLimit(s: MetronomeSettings, field: SettingField, dir: 1 | -1): boolean {
  const [min, max] = LIMITS[field];
  return dir === 1 ? s[field] >= max : s[field] <= min;
}

/** A clamped copy, or the same object at a limit. */
export function stepSetting(
  s: MetronomeSettings,
  field: SettingField,
  dir: 1 | -1
): MetronomeSettings {
  if (atLimit(s, field, dir)) return s;
  return { ...s, [field]: s[field] + dir };
}
