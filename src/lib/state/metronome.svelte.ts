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
import { m } from '$lib/paraglide/messages.js';
import {
  clampBeats,
  clampBpm,
  clampCount,
  DEFAULT_INITIAL_COUNT_IN,
  DEFAULT_REPEAT_COUNT_IN,
  DEFAULT_SETTINGS,
  effectiveCountIn,
  stepSetting,
  toSubdivision,
  type MetronomeSettings
} from './metronome-settings';
import { subdivisionName } from './metronome-subdivision-names';
import { beatDots, type CountInView, type DotState } from './metronome-view';
import { playback } from './playback.svelte';

export type RunPhase = 'settings' | 'starting' | 'running' | 'paused';

interface SegmentOptions {
  readonly startBeat: number;
  readonly countIn?: { readonly from: number; readonly total: number };
}

type Stage = 'count-in' | 'loop';

const state = $state<{
  phase: RunPhase;
  settings: MetronomeSettings;
  beat: number;
  stage: Stage;
  countInClick: number;
  countInTotal: number;
  announcement: string;
  soundNotice: boolean;
  generation: number;
}>({
  phase: 'settings',
  settings: DEFAULT_SETTINGS,
  beat: 0,
  stage: 'loop',
  countInClick: 0,
  countInTotal: 0,
  announcement: '',
  soundNotice: false,
  generation: 0
});

let scheduler: ClickScheduler | null = null;
let overrides: Partial<SchedulerDeps> = {};

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
function beginSegment({ startBeat, countIn }: SegmentOptions): void {
  const unlocked = playback.clickSink();
  const sink = 'sink' in overrides ? (overrides.sink ?? null) : unlocked;
  const generation = ++state.generation;
  const live = createClickScheduler(
    {
      onBeat(beat) {
        if (scheduler !== live || state.generation !== generation) return;
        state.beat = beat;
        state.stage = 'loop';
        if (state.phase === 'starting') state.phase = 'running';
      },
      onCountIn(click) {
        if (scheduler !== live || state.generation !== generation) return;
        state.countInClick = click;
        if (state.phase === 'starting') state.phase = 'running';
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
    bpm: state.settings.bpm,
    beats: state.settings.beats,
    startBeat,
    clicksPerBeat: state.settings.subdivision,
    ...(countIn ? { countIn } : {}),
    run: generation,
    pressedAtMs: performance.now()
  });
}

function start(): void {
  const k = effectiveCountIn(state.settings);
  state.soundNotice = false;
  state.beat = 0;
  state.stage = k > 0 ? 'count-in' : 'loop';
  state.countInClick = 0;
  state.countInTotal = k;
  const params = {
    bpm: state.settings.bpm,
    beats: state.settings.beats,
    subdivision: subdivisionName(state.settings.subdivision)
  };
  state.announcement =
    k > 0
      ? m.metronome_announce_started_count_in({ ...params, count: k })
      : m.metronome_announce_started(params);
  beginSegment(k > 0 ? { startBeat: 1, countIn: { from: 0, total: k } } : { startBeat: 1 });
}

function pauseState(): void {
  state.generation++;
  state.phase = 'paused';
  state.announcement =
    state.stage === 'count-in'
      ? state.countInClick > 0
        ? m.metronome_announce_paused_count_in({
            click: state.countInClick,
            count: state.countInTotal
          })
        : m.metronome_announce_paused_count_in_none({ count: state.countInTotal })
      : m.metronome_announce_paused({ beat: state.beat, beats: state.settings.beats });
}

function pause(): void {
  const frozen = scheduler?.halt('pause');
  if (frozen?.kind === 'beat') {
    state.beat = frozen.beat;
    state.stage = 'loop';
  } else if (frozen?.kind === 'count-in') state.countInClick = frozen.click;
  scheduler = null;
  pauseState();
}

function resume(): void {
  const { beats } = state.settings;
  state.announcement = m.metronome_announce_resumed();
  if (state.stage === 'count-in') {
    // Continue from the next count-in click; the loop's first beat follows the last one.
    beginSegment({
      startBeat: 1,
      countIn: { from: state.countInClick, total: state.countInTotal }
    });
    return;
  }
  beginSegment({ startBeat: state.beat === 0 ? 1 : (state.beat % beats) + 1 });
}

function clearRun(): void {
  state.beat = 0;
  state.stage = 'loop';
  state.countInClick = 0;
  state.countInTotal = 0;
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

function setField(field: 'bpm' | 'beats', v: number): void {
  if (state.phase !== 'settings') return;
  state.settings =
    field === 'bpm'
      ? { ...state.settings, bpm: clampBpm(v) }
      : { ...state.settings, beats: clampBeats(v) };
}

function step(field: 'bpm' | 'beats', dir: 1 | -1): void {
  if (state.phase !== 'settings') return;
  state.settings = stepSetting(state.settings, field, dir);
}

function setCount(field: 'initialCountIn' | 'repeatCountIn', v: number): void {
  if (state.phase !== 'settings') return;
  const fallback = field === 'initialCountIn' ? DEFAULT_INITIAL_COUNT_IN : DEFAULT_REPEAT_COUNT_IN;
  state.settings = { ...state.settings, [field]: clampCount(v, fallback) };
}

function stepCount(field: 'initialCountIn' | 'repeatCountIn', dir: 1 | -1): void {
  if (state.phase !== 'settings') return;
  state.settings = stepSetting(state.settings, field, dir);
}

export const metronome = {
  get phase(): RunPhase {
    return state.phase;
  },
  get settings(): Readonly<MetronomeSettings> {
    return state.settings;
  },
  get beat(): number {
    return state.beat;
  },
  /** Non-null only while a run is showing its count-in. */
  get countIn(): CountInView | null {
    return state.phase !== 'settings' && state.stage === 'count-in'
      ? { click: state.countInClick, total: state.countInTotal }
      : null;
  },
  get dots(): readonly DotState[] {
    return state.phase === 'settings' || state.stage === 'count-in'
      ? []
      : beatDots(state.settings.beats, state.beat);
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

  setBpm: (v: number): void => setField('bpm', v),
  stepBpm: (dir: 1 | -1): void => step('bpm', dir),
  setBeats: (v: number): void => setField('beats', v),
  stepBeats: (dir: 1 | -1): void => step('beats', dir),
  /** Settings phase only; non-booleans are ignored. Turning it off keeps both counts. */
  setCountIn: (v: unknown): void => {
    if (state.phase === 'settings' && typeof v === 'boolean') {
      state.settings = { ...state.settings, countIn: v };
    }
  },
  setInitialCountIn: (v: number): void => setCount('initialCountIn', v),
  stepInitialCountIn: (dir: 1 | -1): void => stepCount('initialCountIn', dir),
  setRepeatCountIn: (v: number): void => setCount('repeatCountIn', v),
  stepRepeatCountIn: (dir: 1 | -1): void => stepCount('repeatCountIn', dir),
  /** Settings phase only; values that are not one of the eight subdivisions are ignored. */
  setSubdivision: (v: unknown): void => {
    if (state.phase !== 'settings') return;
    const sub = toSubdivision(v);
    if (sub !== null) state.settings = { ...state.settings, subdivision: sub };
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

  /** Route left: halt, back to the settings phase with the default values (FR-017). */
  screenChanged(): void {
    scheduler?.halt('leave');
    scheduler = null;
    state.phase = 'settings';
    state.settings = DEFAULT_SETTINGS;
    clearRun();
    state.soundNotice = false;
  }
};

/** Test seam: inject scheduler deps (fake clock/frames/sink) and reset all state. Vitest only. */
export function resetMetronomeForTests(
  deps: Partial<SchedulerDeps> = {},
  settings: Partial<MetronomeSettings> = {}
): void {
  scheduler?.halt('leave');
  scheduler = null;
  overrides = deps;
  state.phase = 'settings';
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  clearRun();
  state.announcement = '';
  state.soundNotice = false;
  state.generation = 0;
}
