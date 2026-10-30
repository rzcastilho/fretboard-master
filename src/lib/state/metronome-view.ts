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

export type StatusParams =
  | { readonly kind: 'beat'; readonly beat: number; readonly beats: number; readonly sub: number }
  | { readonly kind: 'none'; readonly beats: number; readonly sub: number };

/** Selects `metronome_status_beat` or, before the first click, `metronome_status_beat_none`. */
export function statusParams(beat: number, beats: number, sub: number): StatusParams {
  return beat === 0 ? { kind: 'none', beats, sub } : { kind: 'beat', beat, beats, sub };
}
