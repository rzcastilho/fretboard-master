/** Metronome settings maths (031, data-model §1). Pure. */
import { MAX_BPM, MIN_BPM } from '../audio/schedule';

export interface MetronomeSettings {
  readonly bpm: number;
  readonly beats: number;
}

export type SettingField = keyof MetronomeSettings;

export const MIN_BEATS = 1;
export const MAX_BEATS = 16;

export const DEFAULT_SETTINGS: Readonly<MetronomeSettings> = Object.freeze({ bpm: 85, beats: 4 });

const LIMITS: Record<SettingField, readonly [number, number]> = {
  bpm: [MIN_BPM, MAX_BPM],
  beats: [MIN_BEATS, MAX_BEATS]
};

function clampTo(v: number, [min, max]: readonly [number, number]): number {
  if (Number.isNaN(v)) return min;
  return Math.round(Math.min(max, Math.max(min, v)));
}

/** 30–300, rounded; NaN → 30. */
export const clampBpm = (v: number): number => clampTo(v, LIMITS.bpm);

/** 1–16, rounded; NaN → 1. */
export const clampBeats = (v: number): number => clampTo(v, LIMITS.beats);

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
