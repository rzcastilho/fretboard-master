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
  DEFAULT_INITIAL_COUNT_IN,
  DEFAULT_REPEAT_COUNT_IN,
  DEFAULT_SETTINGS,
  effectiveCountIn,
  runPlanFor,
  stepSetting,
  toRatio,
  toSubdivision,
  type MetronomeSettings
} from './metronome-settings';
import { subdivisionName } from './metronome-subdivision-names';
import { beatDots, type CountInView, type DotState } from './metronome-view';
import { playback } from './playback.svelte';

export type RunPhase = 'settings' | 'starting' | 'running' | 'paused';

const state = $state<{
  phase: RunPhase;
  settings: MetronomeSettings;
  /** Last slot that sounded; null before the first click. */
  position: SlotPosition | null;
  /** Initial count-in of the current run (for `COUNT IN –/k` before click 1). */
  initialTotal: number;
  announcement: string;
  soundNotice: boolean;
  generation: number;
}>({
  phase: 'settings',
  settings: DEFAULT_SETTINGS,
  position: null,
  initialTotal: 0,
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
function beginSegment(startSlot: number): void {
  const unlocked = playback.clickSink();
  const sink = 'sink' in overrides ? (overrides.sink ?? null) : unlocked;
  const generation = ++state.generation;
  const live = createClickScheduler(
    {
      onBeat(_beat, at) {
        if (scheduler !== live || state.generation !== generation) return;
        state.position = at;
        if (state.phase === 'starting') state.phase = 'running';
      },
      onCountIn(_click, at) {
        if (scheduler !== live || state.generation !== generation) return;
        state.position = at;
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
    ...runPlanFor(state.settings),
    startSlot,
    run: generation,
    pressedAtMs: performance.now()
  });
}

function start(): void {
  const k = effectiveCountIn(state.settings);
  state.soundNotice = false;
  state.position = null;
  state.initialTotal = k;
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
    at?.kind === 'beat'
      ? state.settings.ratio
        ? m.metronome_announce_paused_loop({
            beat: at.beat,
            beats: state.settings.beats,
            subdivision: subdivisionName(
              at.loop === 1 ? state.settings.subdivision : state.settings.loop2
            )
          })
        : m.metronome_announce_paused({ beat: at.beat, beats: state.settings.beats })
      : at?.kind === 'count-in'
        ? m.metronome_announce_paused_count_in({ click: at.click, count: at.total })
        : state.initialTotal > 0
          ? m.metronome_announce_paused_count_in_none({ count: state.initialTotal })
          : m.metronome_announce_paused({ beat: 0, beats: state.settings.beats });
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
  /** Last position that sounded, or null before the first click. */
  get position(): SlotPosition | null {
    return state.position;
  },
  get beat(): number {
    return state.position?.kind === 'beat' ? state.position.beat : 0;
  },
  /** Clicks per beat of the loop playing (Loop 1 before the first beat). */
  get sub(): number {
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
      : beatDots(state.settings.beats, this.beat);
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
  /** Settings phase only; non-booleans are ignored. Turning it off keeps Loop 2. */
  setRatio: (v: unknown): void => {
    if (state.phase === 'settings' && typeof v === 'boolean') {
      state.settings = { ...state.settings, ratio: toRatio(v) };
    }
  },
  /** Settings phase only; values that are not one of the eight subdivisions are ignored. */
  setLoop2: (v: unknown): void => {
    if (state.phase !== 'settings') return;
    const sub = toSubdivision(v);
    if (sub !== null) state.settings = { ...state.settings, loop2: sub };
  },
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
