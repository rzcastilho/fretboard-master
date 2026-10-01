/** Audio data types (data-model §2–§4, §7, §8). No framework imports. */
import type { Position } from '../instrument/instrument';
import type { Pitch } from '../theory/pitch';

export type PlaybackRequest =
  | { readonly kind: 'note'; readonly position: Position }
  | { readonly kind: 'chord'; readonly positions: readonly Position[] }
  | {
      readonly kind: 'sequence';
      readonly steps: readonly (Position | readonly Position[])[];
      readonly bpm: number;
    };

export interface TimeMark {
  readonly position: Position;
  readonly onsetMs: number;
  readonly endMs: number;
}

/** A note sounding at a position; structurally the fretboard's `Pulse` (audio may not import fretboard). */
export interface PulseEvent {
  readonly id: number;
  readonly position: Position;
  readonly durationMs: number;
}

export interface PlannedStep {
  readonly onsetMs: number;
  readonly durationMs: number;
  readonly pitches: readonly Pitch[];
  readonly positions: readonly Position[];
}

export interface Plan {
  readonly steps: readonly PlannedStep[];
  readonly marks: readonly TimeMark[];
  readonly kind: PlaybackRequest['kind'];
}

export interface Synth {
  /** Normalized, faded. */
  renderVoice(pitch: Pitch, sampleRate: number, lengthSamples: number): Float32Array;
  /** 1/√n + static peak limiter ≤ 0.89. */
  mixVoices(voices: readonly Float32Array[]): Float32Array;
}

export type SynthLoader = () => Promise<Synth>;

export type AudioLogEntry =
  | { type: 'unlock'; state: AudioContextState }
  | {
      type: 'step';
      requestId: number;
      kind: 'note' | 'chord' | 'sequence';
      pitches: number[];
      frequencies: number[];
      when: number;
      contextTime: number;
      gain: number;
      scheduledAtMs: number;
    }
  | {
      type: 'stop';
      requestId: number;
      reason: 'interrupt' | 'stop' | 'hidden' | 'navigate' | 'instrument';
    }
  | { type: 'unavailable'; cause: 'context' | 'resume' | 'synth' };
