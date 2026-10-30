/** Metronome display model (031, data-model §5). Pure. */

export type DotState = 'lit' | 'played' | 'upcoming';

/** `beat` is 1-based; 0 = nothing has sounded yet. */
export function beatDots(beats: number, beat: number): readonly DotState[] {
  return Array.from({ length: Math.max(0, beats) }, (_, i): DotState => {
    const n = i + 1;
    if (beat === 0 || n > beat) return 'upcoming';
    return n === beat ? 'lit' : 'played';
  });
}

export interface CountInView {
  /** Last count-in click that sounded; 0 = none yet. */
  readonly click: number;
  readonly total: number;
}

export type StatusParams =
  | { readonly kind: 'beat'; readonly beat: number; readonly beats: number; readonly sub: number }
  | { readonly kind: 'none'; readonly beats: number; readonly sub: number }
  | { readonly kind: 'count-in'; readonly click: number; readonly total: number }
  | { readonly kind: 'count-in-none'; readonly total: number };

/**
 * Selects `metronome_status_beat`, `metronome_status_beat_none` or, during the count-in,
 * `metronome_status_count_in` / `metronome_status_count_in_none`.
 */
export function statusParams(
  beat: number,
  beats: number,
  sub: number,
  countIn: CountInView | null = null
): StatusParams {
  if (countIn) {
    return countIn.click === 0
      ? { kind: 'count-in-none', total: countIn.total }
      : { kind: 'count-in', click: countIn.click, total: countIn.total };
  }
  return beat === 0 ? { kind: 'none', beats, sub } : { kind: 'beat', beat, beats, sub };
}

/** The single count-in dot: idle before the first click, lit afterwards. */
export function countInDot(click: number): DotState {
  return click === 0 ? 'upcoming' : 'lit';
}
