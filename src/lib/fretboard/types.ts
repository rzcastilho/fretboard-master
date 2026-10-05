import type { Instrument, Position } from '../instrument/instrument';
import type { Spelling } from '../theory/pitch';
import type { IntervalId } from '../theory/triad';

export type NoteFunction = 'root' | 'third' | 'fifth' | 'degree' | 'neutral';
export type Emphasis = 'highlighted' | 'normal' | 'dimmed' | 'hidden';
export type LabelMode = 'note' | 'octave' | 'interval' | 'none';
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
  /** Interval from the root (Triads). Used only when labelMode is 'interval'. */
  readonly interval?: IntervalId;
  /** Draw the small octave number beside a 'note' label. */
  readonly octaveBadge?: boolean;
  /** Stable identity across model updates; a changed fret with the same id slides (R-07). */
  readonly id?: string;
  /** Comparison triad note: dashed outline, function fill and shape kept (R-09). */
  readonly variant?: 'comparison';
}

export type FretboardArrow =
  | {
      readonly kind: 'move';
      readonly id: string;
      readonly string: number;
      readonly fromFret: number;
      readonly toFret: number;
      readonly label: string;
    }
  | {
      readonly kind: 'off-board';
      readonly id: string;
      readonly string: number;
      readonly fromFret: number;
      readonly edge: 'nut' | 'end';
      readonly label: string;
    };

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
  /** Tappable shape tags above the board (Triads Full neck). Interactive variant only. */
  readonly tags?: readonly FretboardTag[];
  /** false → tags render as non-focusable text (CAGED). Default true (button tags). */
  readonly tagsInteractive?: boolean;
  /** Drawn above markers, mirrored with the layout; never announced (the description covers them). */
  readonly arrows?: readonly FretboardArrow[];
  /** Visible text marks beside a string's label (CAGED "altered"). Aria-hidden; the description carries the meaning. */
  readonly stringMarks?: readonly { readonly string: number; readonly label: string }[];
  /** Keyed auto-scroll: re-runs only when `key` changes (replaces the highlighted-set trigger). */
  readonly autoScroll?: {
    readonly key: string;
    readonly groups: readonly (readonly Position[])[];
  };
}

export interface FretboardTag {
  readonly id: string;
  /** Lowest fret of the shape (0 allowed). */
  readonly start: number;
  /** Highest fret of the shape. */
  readonly end: number;
  /** Visible short text. */
  readonly label: string;
  /** Accessible name. */
  readonly name: string;
  /** aria-pressed. */
  readonly pressed: boolean;
  /** Visible secondary line (e.g. wide stretch). */
  readonly detail?: string;
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
  variant?: 'interactive' | 'thumbnail' | 'preview';
  onactivate?: (position: Position) => void;
  /** Positions sounding now; drawn as a pulse, never announced. */
  pulses?: readonly Pulse[];
  ontag?: (id: string) => void;
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
