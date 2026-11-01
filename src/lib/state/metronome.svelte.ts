/**
 * Metronome run state (031, contracts/metronome-store-api.md). The only module that creates a
 * `ClickScheduler`. The click itself lives in `$lib/audio/metronome`; this store owns the phase,
 * the settings and the beat the user sees.
 */
import {
  createClickScheduler,
  type ClickScheduler,
  type SchedulerDeps
} from '$lib/audio/metronome';
import type { SlotPosition } from '$lib/audio/metronome-cycle';
import { m } from '$lib/paraglide/messages.js';
import {
  clampBeats,
  clampBpm,
  clampCount,
  clampIncrement,
  clampLoops,
  DEFAULT_INITIAL_COUNT_IN,
  DEFAULT_MODE,
  DEFAULT_PLAIN_SETTINGS,
  DEFAULT_REPEAT_COUNT_IN,
  DEFAULT_SETTINGS,
  DEFAULT_SPEED_SETTINGS,
  effectiveCountIn,
  plainRunPlan,
  runPlanFor,
  speedRunPlan,
  speedSteps,
  type SharedSettings,
  stepSetting,
  toMode,
  withStartBpm,
  withTargetBpm,
  toRatio,
  toSubdivision,
  type MetronomeMode,
  type MetronomeSettings,
  type PlainSettings,
  type SpeedSettings,
  toAtTarget
} from './metronome-settings';
import { subdivisionName } from './metronome-subdivision-names';
import { beatDots, type CountInView, type DotState, type SpeedStatus } from './metronome-view';
import { playback } from './playback.svelte';
import { preferences } from './preferences.svelte';

export type RunPhase = 'settings' | 'starting' | 'running' | 'paused';

const state = $state<{
  phase: RunPhase;
  settings: MetronomeSettings;
  plain: PlainSettings;
  speed: SpeedSettings;
  mode: MetronomeMode;
  /** Last slot that sounded; null before the first click. */
  position: SlotPosition | null;
  /** Initial count-in of the current run (for `COUNT IN –/k` before click 1). */
  initialTotal: number;
  announcement: string;
  soundNotice: boolean;
  generation: number;
  /** Bumped once each time a Stop run ends by itself (037). */
  finished: number;
}>({
  phase: 'settings',
  settings: DEFAULT_SETTINGS,
  plain: DEFAULT_PLAIN_SETTINGS,
  speed: DEFAULT_SPEED_SETTINGS,
  mode: DEFAULT_MODE,
  position: null,
  initialTotal: 0,
  announcement: '',
  soundNotice: false,
  generation: 0,
  finished: 0
});

let scheduler: ClickScheduler | null = null;
let overrides: Partial<SchedulerDeps> = {};

/** The record the active mode edits and plays (036). */
const activeRecord = (): SharedSettings =>
  state.mode === 'plain' ? state.plain : state.mode === 'speed' ? state.speed : state.settings;

/** Step of the last announcement in a Speed Training run (step 1 is announced by Start). */
let announcedStep = 1;
let announcedHold = false;

/** Announce a Speed Training step change once, at its first loop click (037). */
function announceStep(at: SlotPosition): void {
  const r = at.kind === 'beat' ? at.ramp : undefined;
  if (r?.hold) {
    if (!announcedHold) {
      announcedHold = true;
      state.announcement = m.metronome_announce_hold({ bpm: r.bpm });
    }
    return;
  }
  if (!r || r.step === announcedStep || r.step < 2) return;
  announcedStep = r.step;
  state.announcement = m.metronome_announce_step({ step: r.step, steps: r.steps, bpm: r.bpm });
}

function realClock(): SchedulerDeps['clock'] {
  return {
    now: () => performance.now(),
    setTimeout: (cb, ms) => window.setTimeout(cb, ms),
    clearTimeout: (id) => window.clearTimeout(id)
  };
}

function realFrames(): SchedulerDeps['frames'] {
  return {
    request: (cb) => window.requestAnimationFrame(() => cb()),
    cancel: (id) => window.cancelAnimationFrame(id)
  };
}

/** Begin a click segment. The unlock must happen in this call stack: it is the user's gesture. */
function beginSegment(startSlot: number): void {
  const unlocked = playback.clickSink();
  const sink = 'sink' in overrides ? (overrides.sink ?? null) : unlocked;
  const generation = ++state.generation;
  const live = createClickScheduler(
    {
      onBeat(_beat, at) {
        if (scheduler !== live || state.generation !== generation) return;
        state.position = at;
        announceStep(at);
        if (state.phase === 'starting') state.phase = 'running';
      },
      onCountIn(_click, at) {
        if (scheduler !== live || state.generation !== generation) return;
        state.position = at;
        if (state.phase === 'starting') state.phase = 'running';
      },
      onEnd() {
        if (scheduler !== live || state.generation !== generation) return;
        const bpms = speedSteps(state.speed);
        scheduler = null;
        state.generation++;
        state.phase = 'settings';
        clearRun();
        state.soundNotice = false;
        state.announcement = m.metronome_announce_finished({ bpm: bpms[bpms.length - 1] });
        state.finished++;
      },
      onSuspended() {
        if (scheduler !== live || state.generation !== generation) return;
        // The audio context could not be resumed: freeze on the last audible beat (FR-026).
        pauseState();
      },
      onSoundUnavailable() {
        if (scheduler === live && state.generation === generation) state.soundNotice = true;
      }
    },
    { sink, clock: overrides.clock ?? realClock(), frames: overrides.frames ?? realFrames() }
  );
  scheduler = live;
  if (sink === null) state.soundNotice = true;
  state.phase = 'starting';
  live.start({
    bpm:
      state.mode === 'speed'
        ? state.speed.startBpm
        : (state.mode === 'plain' ? state.plain : state.settings).bpm,
    beats: activeRecord().beats,
    ...(state.mode === 'plain'
      ? plainRunPlan(state.plain)
      : state.mode === 'speed'
        ? speedRunPlan(state.speed)
        : runPlanFor(state.settings)),
    startSlot,
    run: generation,
    pressedAtMs: performance.now()
  });
}

function start(): void {
  const k = effectiveCountIn(activeRecord());
  state.soundNotice = false;
  state.position = null;
  state.initialTotal = k;
  announcedStep = 1;
  announcedHold = false;
  if (state.mode === 'speed') {
    const sp = {
      start: state.speed.startBpm,
      target: state.speed.targetBpm,
      beats: state.speed.beats
    };
    state.announcement =
      k > 0
        ? m.metronome_announce_started_speed_count_in({ ...sp, count: k })
        : m.metronome_announce_started_speed(sp);
    beginSegment(0);
    return;
  }
  if (state.mode === 'plain') {
    const plainBase = { bpm: state.plain.bpm, beats: state.plain.beats };
    state.announcement =
      k > 0
        ? m.metronome_announce_started_plain_count_in({ ...plainBase, count: k })
        : m.metronome_announce_started_plain(plainBase);
    beginSegment(0);
    return;
  }
  const base = { bpm: state.settings.bpm, beats: state.settings.beats };
  const ratio = state.settings.ratio;
  const loops = {
    loop1: subdivisionName(state.settings.subdivision),
    loop2: subdivisionName(state.settings.loop2)
  };
  state.announcement = ratio
    ? k > 0
      ? m.metronome_announce_started_ratio_count_in({ ...base, ...loops, count: k })
      : m.metronome_announce_started_ratio({ ...base, ...loops })
    : k > 0
      ? m.metronome_announce_started_count_in({ ...base, subdivision: loops.loop1, count: k })
      : m.metronome_announce_started({ ...base, subdivision: loops.loop1 });
  beginSegment(0);
}

function pauseState(): void {
  state.generation++;
  state.phase = 'paused';
  const at = state.position;
  state.announcement =
    at?.kind === 'beat' && at.ramp?.hold
      ? m.metronome_announce_paused_hold({
          bpm: at.ramp.bpm,
          beat: at.beat,
          beats: state.speed.beats
        })
      : at?.kind === 'beat' && at.ramp
        ? m.metronome_announce_paused_step({
            step: at.ramp.step,
            steps: at.ramp.steps,
            loop: at.ramp.loop,
            loops: at.ramp.loops,
            beat: at.beat,
            beats: state.speed.beats
          })
        : at?.kind === 'beat'
          ? state.mode === 'ratios' && state.settings.ratio
            ? m.metronome_announce_paused_loop({
                beat: at.beat,
                beats: state.settings.beats,
                subdivision: subdivisionName(
                  at.loop === 1 ? state.settings.subdivision : state.settings.loop2
                )
              })
            : m.metronome_announce_paused({ beat: at.beat, beats: activeRecord().beats })
          : at?.kind === 'count-in'
            ? m.metronome_announce_paused_count_in({ click: at.click, count: at.total })
            : state.initialTotal > 0
              ? m.metronome_announce_paused_count_in_none({ count: state.initialTotal })
              : m.metronome_announce_paused({ beat: 0, beats: activeRecord().beats });
}

function pause(): void {
  const frozen = scheduler?.halt('pause');
  if (frozen && frozen.kind !== 'none') state.position = frozen;
  scheduler = null;
  pauseState();
}

function resume(): void {
  state.announcement = m.metronome_announce_resumed();
  beginSegment((state.position?.slot ?? -1) + 1);
}

function clearRun(): void {
  state.position = null;
  state.initialTotal = 0;
}

function reset(): void {
  if (state.phase === 'settings') return;
  scheduler?.halt('reset');
  scheduler = null;
  state.generation++;
  state.phase = 'settings';
  clearRun();
  state.soundNotice = false;
  state.announcement = m.metronome_announce_reset();
}

function sameRecord<T extends object>(a: T, b: T): boolean {
  return (Object.keys(a) as (keyof T)[]).every((k) => a[k] === b[k]);
}

/** Remember the whole `metronome` object: `session.remember` replaces top-level keys (036). */
function remember(): void {
  preferences.remember({
    metronome: {
      ratios: state.settings,
      plain: state.plain,
      speed: state.speed,
      mode: state.mode
    }
  });
}

/** The one place the Ratios record changes: assign, then remember (035). Equal → nothing. */
function commitRatios(next: MetronomeSettings): void {
  if (next === state.settings || sameRecord(next, state.settings)) return;
  state.settings = next;
  remember();
}

/** The one place the plain record changes (036). Equal → nothing. */
function commitPlain(next: PlainSettings): void {
  if (next === state.plain || sameRecord(next, state.plain)) return;
  state.plain = next;
  remember();
}

/** The one place the Speed Training record changes (037). Equal → nothing. */
function commitSpeed(next: SpeedSettings): void {
  if (next === state.speed || sameRecord(next, state.speed)) return;
  state.speed = next;
  remember();
}

/** Apply an edit to the Speed record; no-op outside the settings phase or Speed mode. */
function editSpeed(edit: (s: SpeedSettings) => SpeedSettings): void {
  if (state.phase !== 'settings' || state.mode !== 'speed') return;
  commitSpeed(edit(state.speed));
}

function setField(field: 'bpm' | 'beats', v: number): void {
  if (state.phase !== 'settings') return;
  if (state.mode === 'speed') {
    if (field === 'beats') commitSpeed({ ...state.speed, beats: clampBeats(v) });
    return;
  }
  const patch = field === 'bpm' ? { bpm: clampBpm(v) } : { beats: clampBeats(v) };
  if (state.mode === 'plain') commitPlain({ ...state.plain, ...patch });
  else commitRatios({ ...state.settings, ...patch });
}

function step(field: 'bpm' | 'beats', dir: 1 | -1): void {
  if (state.phase !== 'settings') return;
  if (state.mode === 'speed') {
    if (field === 'beats') commitSpeed(stepSetting(state.speed, 'beats', dir));
    return;
  }
  if (state.mode === 'plain') commitPlain(stepSetting(state.plain, field, dir));
  else commitRatios(stepSetting(state.settings, field, dir));
}

function setCount(field: 'initialCountIn' | 'repeatCountIn', v: number): void {
  if (state.phase !== 'settings') return;
  const fallback = field === 'initialCountIn' ? DEFAULT_INITIAL_COUNT_IN : DEFAULT_REPEAT_COUNT_IN;
  const n = clampCount(v, fallback);
  if (state.mode === 'speed') commitSpeed({ ...state.speed, [field]: n });
  else if (state.mode === 'ratios') commitRatios({ ...state.settings, [field]: n });
  else if (field === 'initialCountIn') commitPlain({ ...state.plain, initialCountIn: n });
}

function stepCount(field: 'initialCountIn' | 'repeatCountIn', dir: 1 | -1): void {
  if (state.phase !== 'settings') return;
  if (state.mode === 'speed') commitSpeed(stepSetting(state.speed, field, dir));
  else if (state.mode === 'ratios') commitRatios(stepSetting(state.settings, field, dir));
  else if (field === 'initialCountIn') commitPlain(stepSetting(state.plain, field, dir));
}

function halt(): void {
  scheduler?.halt('leave');
  scheduler = null;
  state.generation++;
  state.phase = 'settings';
  clearRun();
  state.soundNotice = false;
}

export const metronome = {
  get phase(): RunPhase {
    return state.phase;
  },
  get settings(): Readonly<MetronomeSettings> {
    return state.settings;
  },
  /** Last position that sounded, or null before the first click. */
  get mode(): MetronomeMode {
    return state.mode;
  },
  /** The active mode's record: what the shared rows edit and the run plays. */
  get current(): Readonly<SharedSettings> {
    return activeRecord();
  },
  get plain(): Readonly<PlainSettings> {
    return state.plain;
  },
  /** Speed Training record (037). */
  get speed(): Readonly<SpeedSettings> {
    return state.speed;
  },
  /** The tempo the readout shows (037): Speed Training follows the last slot that sounded. */
  get bpm(): number {
    if (state.mode === 'plain') return state.plain.bpm;
    if (state.mode === 'ratios') return state.settings.bpm;
    return state.position?.ramp?.bpm ?? state.speed.startBpm;
  },
  /** Number of steps of the Speed Training ramp. */
  get steps(): number {
    return speedSteps(state.speed).length;
  },
  /** Where a Speed Training run is; null outside Speed mode and during a count-in. */
  get speedStatus(): SpeedStatus | null {
    if (state.mode !== 'speed') return null;
    if (this.countIn !== null) return null;
    const r = state.position?.kind === 'beat' ? state.position.ramp : undefined;
    const steps = this.steps;
    if (!r) return { kind: 'step', step: 1, steps, loop: 1, loops: state.speed.loops };
    return r.hold
      ? { kind: 'hold', steps: r.steps }
      : { kind: 'step', step: r.step, steps: r.steps, loop: r.loop, loops: r.loops };
  },
  get position(): SlotPosition | null {
    return state.position;
  },
  get beat(): number {
    return state.position?.kind === 'beat' ? state.position.beat : 0;
  },
  /** Clicks per beat of the loop playing (Loop 1 before the first beat). */
  get sub(): number | null {
    if (state.mode !== 'ratios') return null;
    return state.position?.kind === 'beat'
      ? state.position.clicksPerBeat
      : state.settings.subdivision;
  },
  /** Non-null only while a run is showing a count-in (initial or repeat). */
  get countIn(): CountInView | null {
    if (state.phase === 'settings') return null;
    const at = state.position;
    if (at?.kind === 'count-in') return { click: at.click, total: at.total };
    if (at === null && state.initialTotal > 0) return { click: 0, total: state.initialTotal };
    return null;
  },
  get dots(): readonly DotState[] {
    return state.phase === 'settings' || this.countIn !== null
      ? []
      : beatDots(activeRecord().beats, this.beat);
  },
  get announcement(): string {
    return state.announcement;
  },
  get soundNotice(): boolean {
    return state.soundNotice;
  },
  get generation(): number {
    return state.generation;
  },
  /** Counts Stop runs that ended by themselves; the panel moves focus when it grows. */
  get finished(): number {
    return state.finished;
  },

  setBpm: (v: number): void => setField('bpm', v),
  stepBpm: (dir: 1 | -1): void => step('bpm', dir),
  setBeats: (v: number): void => setField('beats', v),
  stepBeats: (dir: 1 | -1): void => step('beats', dir),
  /** Settings phase only; non-booleans are ignored. Turning it off keeps both counts. */
  setCountIn: (v: unknown): void => {
    if (state.phase === 'settings' && typeof v === 'boolean') {
      if (state.mode === 'speed') commitSpeed({ ...state.speed, countIn: v });
      else if (state.mode === 'plain') commitPlain({ ...state.plain, countIn: v });
      else commitRatios({ ...state.settings, countIn: v });
    }
  },
  setInitialCountIn: (v: number): void => setCount('initialCountIn', v),
  stepInitialCountIn: (dir: 1 | -1): void => stepCount('initialCountIn', dir),
  setRepeatCountIn: (v: number): void => setCount('repeatCountIn', v),
  stepRepeatCountIn: (dir: 1 | -1): void => stepCount('repeatCountIn', dir),
  /** Speed Training numeric setters (037): settings phase, Speed mode only. */
  setStartBpm: (v: number): void => editSpeed((s) => withStartBpm(s, v)),
  stepStartBpm: (dir: 1 | -1): void => editSpeed((s) => stepSetting(s, 'startBpm', dir)),
  setTargetBpm: (v: number): void => editSpeed((s) => withTargetBpm(s, v)),
  stepTargetBpm: (dir: 1 | -1): void => editSpeed((s) => stepSetting(s, 'targetBpm', dir)),
  setIncrement: (v: number): void => editSpeed((s) => ({ ...s, increment: clampIncrement(v) })),
  stepIncrement: (dir: 1 | -1): void => editSpeed((s) => stepSetting(s, 'increment', dir)),
  setLoops: (v: number): void => editSpeed((s) => ({ ...s, loops: clampLoops(v) })),
  stepLoops: (dir: 1 | -1): void => editSpeed((s) => stepSetting(s, 'loops', dir)),
  /** Settings phase, Speed mode only; anything but 'hold' or 'stop' is ignored. */
  setAtTarget: (v: unknown): void => {
    if (state.phase !== 'settings' || state.mode !== 'speed') return;
    const t = toAtTarget(v);
    if (t !== null) commitSpeed({ ...state.speed, atTarget: t });
  },
  setRatio: (v: unknown): void => {
    if (state.phase === 'settings' && state.mode === 'ratios' && typeof v === 'boolean') {
      commitRatios({ ...state.settings, ratio: toRatio(v) });
    }
  },
  /** Settings phase only; values that are not one of the eight subdivisions are ignored. */
  setLoop2: (v: unknown): void => {
    if (state.phase !== 'settings' || state.mode !== 'ratios') return;
    const sub = toSubdivision(v);
    if (sub !== null) commitRatios({ ...state.settings, loop2: sub });
  },
  /** Settings phase only; values that are not one of the eight subdivisions are ignored. */
  setSubdivision: (v: unknown): void => {
    if (state.phase !== 'settings' || state.mode !== 'ratios') return;
    const sub = toSubdivision(v);
    if (sub !== null) commitRatios({ ...state.settings, subdivision: sub });
  },

  /** Gesture handler. settings → start, running → pause, paused → resume, starting → ignored. */
  toggle(): void {
    if (state.phase === 'settings') start();
    else if (state.phase === 'running') pause();
    else if (state.phase === 'paused') resume();
  },

  /** Gesture handler. starting | running | paused → settings, values kept; no-op in settings. */
  reset,

  dismissSoundNotice(): void {
    state.soundNotice = false;
  },

  /**
   * Switch the active mode (036). Invalid or already-active values are ignored. Otherwise any run
   * stops at once and the panel returns to settings; each mode keeps its own record.
   */
  selectMode(v: unknown): void {
    const next = toMode(v);
    if (next === null || next === state.mode) return;
    halt();
    state.mode = next;
    remember();
  },

  /** Route left: halt, back to the settings phase; the values are kept (035, FR-002). */
  screenChanged(): void {
    halt();
  },

  /** Apply stored or default values without writing: halts a run, back to the settings phase. */
  restore(r: {
    ratios: MetronomeSettings;
    plain: PlainSettings;
    speed: SpeedSettings;
    mode: MetronomeMode;
  }): void {
    halt();
    state.settings = r.ratios;
    state.plain = r.plain;
    state.speed = r.speed;
    state.mode = r.mode;
  }
};

/** Test seam: inject scheduler deps (fake clock/frames/sink) and reset all state. Vitest only. */
export function resetMetronomeForTests(
  deps: Partial<SchedulerDeps> = {},
  settings: Partial<MetronomeSettings> = {},
  plain: Partial<PlainSettings> = {},
  mode: MetronomeMode = DEFAULT_MODE,
  speed: Partial<SpeedSettings> = {}
): void {
  scheduler?.halt('leave');
  scheduler = null;
  overrides = deps;
  state.phase = 'settings';
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  state.plain = { ...DEFAULT_PLAIN_SETTINGS, ...plain };
  state.speed = { ...DEFAULT_SPEED_SETTINGS, ...speed };
  state.mode = mode;
  clearRun();
  state.announcement = '';
  state.soundNotice = false;
  state.generation = 0;
  state.finished = 0;
}
