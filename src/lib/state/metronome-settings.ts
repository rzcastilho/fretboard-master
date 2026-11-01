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

export type MetronomeMode = 'plain' | 'speed' | 'ratios';

/** Tab order (036, 037). */
export const METRONOME_MODES: readonly MetronomeMode[] = ['plain', 'speed', 'ratios'];
export const DEFAULT_MODE: MetronomeMode = 'ratios';

/** Plain Metronome settings (036): one click per beat. `MetronomeSettings` is a superset. */
export interface PlainSettings {
  readonly bpm: number;
  readonly beats: number;
  readonly countIn: boolean;
  readonly initialCountIn: number;
}

/** What a Speed Training run does after the last step (037). */
export type AtTarget = 'hold' | 'stop';

/** Speed Training settings (037, data-model §1). Invariant: `targetBpm >= startBpm`. */
export interface SpeedSettings {
  readonly startBpm: number;
  readonly targetBpm: number;
  readonly increment: number;
  /** Loops per step, 1–16. */
  readonly loops: number;
  readonly beats: number;
  readonly countIn: boolean;
  readonly initialCountIn: number;
  readonly repeatCountIn: number;
  readonly atTarget: AtTarget;
}

/** Fields shared by every mode. */
export type SharedSettings = Pick<PlainSettings, 'beats' | 'countIn' | 'initialCountIn'>;

/** The numeric fields of Speed Training adjusted by steppers. */
export type SpeedField =
  'startBpm' | 'targetBpm' | 'increment' | 'loops' | 'beats' | 'initialCountIn' | 'repeatCountIn';

export const MIN_INCREMENT = 1;
export const MAX_INCREMENT = 20;
export const MIN_LOOPS = 1;
export const MAX_LOOPS = 16;
/** (300 − 30) / 1 + 1 */
export const MAX_STEPS = 271;

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

export const DEFAULT_SPEED_SETTINGS: Readonly<SpeedSettings> = Object.freeze({
  startBpm: 85,
  targetBpm: 125,
  increment: 5,
  loops: 4,
  beats: 4,
  countIn: true,
  initialCountIn: DEFAULT_INITIAL_COUNT_IN,
  repeatCountIn: DEFAULT_REPEAT_COUNT_IN,
  atTarget: 'hold' as AtTarget
});

const LIMITS: Record<SettingField | SpeedField, readonly [number, number]> = {
  startBpm: [MIN_BPM, MAX_BPM],
  targetBpm: [MIN_BPM, MAX_BPM],
  increment: [MIN_INCREMENT, MAX_INCREMENT],
  loops: [MIN_LOOPS, MAX_LOOPS],
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

/** 1–20, rounded; NaN → 1. */
export const clampIncrement = (v: number): number => clampTo(v, LIMITS.increment);

/** 1–16, rounded; NaN → 1. */
export const clampLoops = (v: number): number => clampTo(v, LIMITS.loops);

/** Sets Start; Target is lifted to Start when it would fall below (FR-003). */
export function withStartBpm(s: SpeedSettings, v: number): SpeedSettings {
  const startBpm = clampBpm(v);
  return { ...s, startBpm, targetBpm: Math.max(s.targetBpm, startBpm) };
}

/** Sets Target, never below Start (FR-003). */
export function withTargetBpm(s: SpeedSettings, v: number): SpeedSettings {
  return { ...s, targetBpm: Math.max(clampBpm(v), s.startBpm) };
}

/** `[S, S+i, … < T, T]`; `[S]` when T = S. Total, never throws. */
export function speedSteps(s: SpeedSettings): number[] {
  const start = clampBpm(s.startBpm);
  const target = Math.max(clampBpm(s.targetBpm), start);
  const inc = clampIncrement(s.increment);
  const out = [start];
  for (let b = start + inc; b < target; b += inc) out.push(b);
  if (target > start) out.push(target);
  return out;
}

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

/** The plan fields of a Speed Training run: one click per beat plus a tempo ramp (037). */
export function speedRunPlan(s: SpeedSettings): {
  clicksPerBeat: 1;
  initialCountIn: number;
  ramp: {
    bpms: number[];
    loops: number;
    repeatCountIn: number;
    atTarget: AtTarget;
  };
} {
  return {
    clicksPerBeat: 1,
    initialCountIn: effectiveCountIn(s),
    ramp: {
      bpms: speedSteps(s),
      loops: s.loops,
      repeatCountIn: s.countIn ? s.repeatCountIn : 0,
      atTarget: s.atTarget
    }
  };
}

/** `'plain'`, `'speed'` or `'ratios'`, otherwise null. Never throws. */
export function toMode(v: unknown): MetronomeMode | null {
  return v === 'plain' || v === 'speed' || v === 'ratios' ? v : null;
}

/** `'hold'` or `'stop'`, otherwise null. Never throws. */
export function toAtTarget(v: unknown): AtTarget | null {
  return v === 'hold' || v === 'stop' ? v : null;
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
export function atLimit(s: SpeedSettings, field: SpeedField, dir: 1 | -1): boolean;
export function atLimit(s: object, field: SettingField | SpeedField, dir: 1 | -1): boolean {
  const v = (s as Record<string, number>)[field];
  if (field === 'targetBpm' && dir === -1) return v <= (s as SpeedSettings).startBpm;
  const [min, max] = LIMITS[field];
  return dir === 1 ? v >= max : v <= min;
}

/** A clamped copy, or the same object at a limit. */
export function stepSetting(
  s: MetronomeSettings,
  field: SettingField,
  dir: 1 | -1
): MetronomeSettings;
export function stepSetting(s: PlainSettings, field: PlainField, dir: 1 | -1): PlainSettings;
export function stepSetting(s: SpeedSettings, field: SpeedField, dir: 1 | -1): SpeedSettings;
export function stepSetting(s: object, field: SettingField | SpeedField, dir: 1 | -1): object {
  if (atLimit(s as SpeedSettings, field as SpeedField, dir)) return s;
  const v = (s as Record<string, number>)[field];
  if (field === 'startBpm') return withStartBpm(s as SpeedSettings, v + dir);
  if (field === 'targetBpm') return withTargetBpm(s as SpeedSettings, v + dir);
  return { ...s, [field]: v + dir };
}
