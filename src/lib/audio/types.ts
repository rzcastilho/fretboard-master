/** Audio data types (data-model §2–§4, §7, §8). No framework imports. */
import type { ClickKind } from './click';
import type { Position } from '../instrument/instrument';
import type { Pitch } from '../theory/pitch';

/** One event of a `timeline` request: a note or block with its own onset and ring length. */
export interface TimedStep {
  /** One position = a single note, several = a block. */
  readonly positions: readonly Position[];
  /** From request start; clamped 0…MAX_TIMELINE_MS. */
  readonly onsetMs: number;
  /** Ring length; clamped 1…MAX_TIMELINE_MS. */
  readonly durationMs: number;
}

export type PlaybackRequest =
  | { readonly kind: 'note'; readonly position: Position }
  | { readonly kind: 'chord'; readonly positions: readonly Position[] }
  | {
      readonly kind: 'sequence';
      readonly steps: readonly (Position | readonly Position[])[];
      readonly bpm: number;
    }
  | { readonly kind: 'timeline'; readonly events: readonly TimedStep[] };

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
      kind: 'note' | 'chord' | 'sequence' | 'timeline';
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
      reason: 'interrupt' | 'stop' | 'hidden' | 'navigate' | 'instrument' | 'view';
    }
  | { type: 'unavailable'; cause: 'context' | 'resume' | 'synth' }
  | {
      type: 'click';
      run: number;
      index: number;
      /** Slot (beat position in the run) the click belongs to; soft clicks share their beat's slot. */
      slot: number;
      beat: number;
      kind: ClickKind;
      accent: boolean;
      when: number;
      contextTime: number;
      /** Set on the first click of a segment (the Start or Resume press), else null. */
      pressedAtMs: number | null;
      scheduledAtMs: number;
    }
  | {
      type: 'click-cancel';
      run: number;
      count: number;
      reason: 'pause' | 'reset' | 'leave' | 'suspend';
    };
