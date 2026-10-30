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
  DEFAULT_SETTINGS,
  stepSetting,
  type MetronomeSettings
} from './metronome-settings';
import { beatDots, type DotState } from './metronome-view';
import { playback } from './playback.svelte';

export type RunPhase = 'settings' | 'starting' | 'running' | 'paused';

interface SegmentOptions {
  readonly startBeat: number;
}

const state = $state<{
  phase: RunPhase;
  settings: MetronomeSettings;
  beat: number;
  announcement: string;
  soundNotice: boolean;
  generation: number;
}>({
  phase: 'settings',
  settings: DEFAULT_SETTINGS,
  beat: 0,
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
function beginSegment({ startBeat }: SegmentOptions): void {
  const unlocked = playback.clickSink();
  const sink = 'sink' in overrides ? (overrides.sink ?? null) : unlocked;
  const generation = ++state.generation;
  const live = createClickScheduler(
    {
      onBeat(beat) {
        if (scheduler !== live || state.generation !== generation) return;
        state.beat = beat;
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
    run: generation,
    pressedAtMs: performance.now()
  });
}

function start(): void {
  state.soundNotice = false;
  state.beat = 0;
  state.announcement = m.metronome_announce_started({
    bpm: state.settings.bpm,
    beats: state.settings.beats
  });
  beginSegment({ startBeat: 1 });
}

function pauseState(): void {
  state.generation++;
  state.phase = 'paused';
  state.announcement = m.metronome_announce_paused({
    beat: state.beat,
    beats: state.settings.beats
  });
}

function pause(): void {
  const frozen = scheduler?.halt('pause') ?? 0;
  if (frozen > 0) state.beat = frozen;
  scheduler = null;
  pauseState();
}

function resume(): void {
  const { beats } = state.settings;
  state.announcement = m.metronome_announce_resumed();
  beginSegment({ startBeat: state.beat === 0 ? 1 : (state.beat % beats) + 1 });
}

function reset(): void {
  if (state.phase === 'settings') return;
  scheduler?.halt('reset');
  scheduler = null;
  state.generation++;
  state.phase = 'settings';
  state.beat = 0;
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
  get dots(): readonly DotState[] {
    return state.phase === 'settings' ? [] : beatDots(state.settings.beats, state.beat);
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
    state.beat = 0;
    state.soundNotice = false;
  }
};

/** Test seam: inject scheduler deps (fake clock/frames/sink) and reset all state. Vitest only. */
export function resetMetronomeForTests(deps: Partial<SchedulerDeps> = {}): void {
  scheduler?.halt('leave');
  scheduler = null;
  overrides = deps;
  state.phase = 'settings';
  state.settings = DEFAULT_SETTINGS;
  state.beat = 0;
  state.announcement = '';
  state.soundNotice = false;
  state.generation = 0;
}
