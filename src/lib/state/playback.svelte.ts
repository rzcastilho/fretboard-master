/**
 * App-wide playback state (contracts/playback-api.md §3, data-model §5).
 * The only module that imports the audio engine.
 */
import { createPlaybackEngine, type EngineDeps, type PlaybackEngine } from '$lib/audio/engine';
import type { PulseEvent, TimeMark } from '$lib/audio/types';
import type { Instrument, Position } from '$lib/instrument/instrument';

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

  /** Mute or unmute; ramps gain only, never stops a sounding note. Unlocks the engine. */
  setMuted(muted: boolean): void {
    state.muted = muted;
    engine.setMuted(muted);
    markUnlocked();
  },

  /** Volume 0–100, clamped and snapped to steps of 5. Unlocks the engine. */
  setVolume(volume: number): void {
    const v = Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume / 5) * 5)) : 0;
    state.volume = v;
    engine.setVolume(v);
    markUnlocked();
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
