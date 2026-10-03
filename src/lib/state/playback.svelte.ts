/**
 * App-wide playback state (contracts/playback-api.md §3, data-model §5).
 * The only module that imports the audio engine.
 */
import {
  createPlaybackEngine,
  type EngineDeps,
  type PlaybackEngine,
  type StopReason
} from '$lib/audio/engine';
import type { PulseEvent, TimeMark } from '$lib/audio/types';
import type { Instrument, Position } from '$lib/instrument/instrument';
import { preferences } from './preferences.svelte';

type Availability = 'idle' | 'on' | 'unavailable';

const state = $state<{
  availability: Availability;
  muted: boolean;
  volume: number;
  sequencePlaying: boolean;
  pulses: readonly PulseEvent[];
  noticeVisible: boolean;
}>({
  availability: 'idle',
  muted: false,
  volume: 80,
  sequencePlaying: false,
  pulses: [],
  noticeVisible: false
});

/** Set once, on the first failed unlock; never reset during the session. */
let noticeShown = false;

function createEngine(deps?: Partial<EngineDeps>): PlaybackEngine {
  return createPlaybackEngine(
    {
      onPulseStart: (p) => {
        state.pulses = [...state.pulses, p];
      },
      onPulseEnd: (id) => {
        state.pulses = state.pulses.filter((p) => p.id !== id);
      },
      onSequenceChange: (playing) => {
        state.sequencePlaying = playing;
      },
      onUnavailable: () => {
        state.availability = 'unavailable';
        if (!noticeShown) {
          noticeShown = true;
          state.noticeVisible = true;
        }
      }
    },
    deps
  );
}

let engine: PlaybackEngine = createEngine();

/** idle → on after a gesture reached the engine; unavailable is terminal. */
function markUnlocked(): void {
  if (state.availability === 'idle') state.availability = 'on';
}

export const playback = {
  get availability(): Availability {
    return state.availability;
  },
  get controlState(): 'on' | 'muted' | 'unavailable' {
    return state.availability === 'unavailable' ? 'unavailable' : state.muted ? 'muted' : 'on';
  },
  get muted(): boolean {
    return state.muted;
  },
  get volume(): number {
    return state.volume;
  },
  get sequencePlaying(): boolean {
    return state.sequencePlaying;
  },
  get pulses(): readonly PulseEvent[] {
    return state.pulses;
  },
  get noticeVisible(): boolean {
    return state.noticeVisible;
  },

  /** Sound one position. Call from a user-gesture handler. */
  note(position: Position, instrument: Instrument): readonly TimeMark[] {
    const marks = engine.play({ kind: 'note', position }, instrument);
    markUnlocked();
    return marks;
  },

  /** Sound several positions as one chord (shared onset). Call from a user-gesture handler. */
  chord(positions: readonly Position[], instrument: Instrument): readonly TimeMark[] {
    const marks = engine.play({ kind: 'chord', positions }, instrument);
    markUnlocked();
    return marks;
  },

  /** Sound steps (a position or a chord each) at `bpm` (clamped 30–300). Call from a gesture handler. */
  sequence(
    steps: readonly (Position | readonly Position[])[],
    bpm: number,
    instrument: Instrument
  ): readonly TimeMark[] {
    const marks = engine.play({ kind: 'sequence', steps, bpm }, instrument);
    markUnlocked();
    return marks;
  },

  /**
   * Silence the active request and clear pulses. A no-op when nothing is playing.
   * Caller obligation (FR-014): a tool whose view state changes must call `stop('view')`;
   * nothing in this feature triggers it, so later tools own that call.
   */
  stop(reason: StopReason = 'stop'): void {
    engine.stop(reason);
    state.pulses = [];
    state.sequencePlaying = false;
  },

  /** Mute or unmute; ramps gain only, never stops a sounding note. Unlocks the engine. */
  setMuted(muted: boolean): void {
    state.muted = muted;
    engine.setMuted(muted);
    preferences.remember({ muted });
    markUnlocked();
  },

  /** Volume 0–100, clamped and snapped to steps of 5. Unlocks the engine. */
  setVolume(volume: number): void {
    const v = Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume / 5) * 5)) : 0;
    state.volume = v;
    engine.setVolume(v);
    preferences.remember({ volume: v });
    markUnlocked();
  },

  /** Apply remembered values: no unlock, no AudioContext, no write (010). */
  restore({ muted, volume }: { muted: boolean; volume: number }): void {
    state.muted = muted;
    state.volume = volume;
    engine.restore(muted, volume);
  },

  /** Hide the unavailable notice. It is never shown again this session. */
  dismissNotice(): void {
    state.noticeVisible = false;
  },

  /** Start loading the synth (no AudioContext is created). */
  preload(): void {
    engine.preload();
  }
};

/** Test seam: replace the engine dependencies and reset state (Vitest only). */
export function resetPlaybackForTests(deps?: Partial<EngineDeps>): void {
  state.availability = 'idle';
  state.muted = false;
  state.volume = 80;
  state.sequencePlaying = false;
  state.pulses = [];
  state.noticeVisible = false;
  noticeShown = false;
  engine = createEngine(deps);
}
