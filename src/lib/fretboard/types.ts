import type { Instrument, Position } from '../instrument/instrument';
import type { Spelling } from '../theory/pitch';

export type NoteFunction = 'root' | 'third' | 'fifth' | 'degree' | 'neutral';
export type Emphasis = 'highlighted' | 'normal' | 'dimmed' | 'hidden';
export type LabelMode = 'note' | 'octave' | 'none';
export type OctaveTone = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Marker {
  readonly string: number;
  readonly fret: number;
  readonly function: NoteFunction;
  readonly emphasis: Emphasis;
  /** Explicit spelling (e.g. E♯, B𝄫); absent → notation default (sharps). */
  readonly spelling?: Spelling;
  /** Overrides the default label rule (labeled iff highlighted or normal). */
  readonly label?: boolean;
  /** Same-octave tone token (Notes). Drawing only. */
  readonly tone?: OctaveTone;
  /** Draw the small octave number beside a 'note' label. */
  readonly octaveBadge?: boolean;
}

export interface DisplayModel {
  /** At most one per position; first wins. */
  readonly markers: readonly Marker[];
  readonly labelMode: LabelMode;
  /** Optional localized leading sentence of the text description. */
  readonly summary?: string;
  /** Lit band over frets start..end; a change scrolls it into view. */
  readonly region?: { readonly start: number; readonly end: number };
  /** false → no hover hint (Hide names). Default true. */
  readonly hoverHint?: boolean;
  /** Replaces the computed text description verbatim. */
  readonly description?: string;
}

/** A position currently sounding (data-model §6). Drawing only; never part of `DisplayModel`. */
export interface Pulse {
  readonly id: number;
  readonly position: Position;
  readonly durationMs: number;
}

/** Renderer-internal marker record produced by `applyPulses`. */
export interface DrawnMarker extends Marker {
  readonly pulse?: { readonly id: number; readonly durationMs: number };
}

export interface FretboardProps {
  instrument: Instrument;
  model?: DisplayModel;
  variant?: 'interactive' | 'thumbnail';
  onactivate?: (position: Position) => void;
  /** Positions sounding now; drawn as a pulse, never announced. */
  pulses?: readonly Pulse[];
}

/** Gesture state machine (data-model §6). */
export type GestureState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'pending';
      readonly pointerId: number;
      readonly pointerType: string;
      readonly originX: number;
      readonly originY: number;
    }
  | {
      readonly kind: 'scrolling';
      readonly pointerId: number;
      readonly pointerType: string;
      readonly lastX: number;
    }
  | { readonly kind: 'cancelled' };

export type GestureEvent =
  | {
      readonly type: 'down';
      readonly pointerId: number;
      readonly pointerType: string;
      readonly button: number;
      readonly isPrimary: boolean;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'move'; readonly pointerId: number; readonly x: number; readonly y: number }
  | { readonly type: 'up'; readonly pointerId: number; readonly x: number; readonly y: number }
  | { readonly type: 'cancel'; readonly pointerId: number };

export type GestureEffect =
  | { readonly kind: 'none' }
  /** Pointer released as a tap: caller resolves the nearest position from (x, y). */
  | { readonly kind: 'activate'; readonly x: number; readonly y: number }
  /** Drag started: hide hover hint. */
  | { readonly kind: 'hide-hover' }
  /** Mouse drag-to-scroll: `scrollLeft -= dx`. */
  | { readonly kind: 'scroll'; readonly dx: number };
