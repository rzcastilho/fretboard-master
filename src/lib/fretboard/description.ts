/** Text names for fretboard positions (data-model §8). */
import { m } from '$lib/paraglide/messages.js';
import {
  isValidPosition,
  positionKey,
  positionPitch,
  type Instrument,
  type Position
} from '../instrument/instrument';
import { defaultSpelling, spokenNote } from '../notation/notation';
import { pitchClass } from '../theory/pitch';
import type { DisplayModel, Marker, NoteFunction } from './types';

const FUNCTION_NAME: Readonly<Record<NoteFunction, () => string>> = {
  root: () => m.fretboard_function_root(),
  third: () => m.fretboard_function_third(),
  fifth: () => m.fretboard_function_fifth(),
  degree: () => m.fretboard_function_degree(),
  neutral: () => m.fretboard_function_neutral()
};

export function positionName(instrument: Instrument, position: Position, marker?: Marker): string {
  const spelling =
    marker?.spelling ?? defaultSpelling(pitchClass(positionPitch(instrument, position)));
  const note = spokenNote(spelling);
  const name =
    position.fret === 0
      ? m.fretboard_position_name_open({ note, string: position.string })
      : m.fretboard_position_name({ note, string: position.string, fret: position.fret });
  if (marker && marker.emphasis !== 'hidden') {
    const named = m.fretboard_position_function({
      name,
      function: FUNCTION_NAME[marker.function]()
    });
    return marker.variant === 'comparison'
      ? m.fretboard_position_function({ name: named, function: m.fretboard_comparison_note() })
      : named;
  }
  return name;
}

/** Positions are listed string 6→1, then fret ascending (data-model §8). */
export function describeView(instrument: Instrument, model: DisplayModel): string {
  const seen = new Set<string>();
  const entries = model.markers
    .filter((mk) => {
      if (mk.emphasis !== 'highlighted' && mk.emphasis !== 'normal') return false;
      if (!isValidPosition(instrument, mk)) return false;
      const key = positionKey(mk);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.string - a.string || a.fret - b.fret)
    .map((mk) => {
      const note = spokenNote(
        mk.spelling ?? defaultSpelling(pitchClass(positionPitch(instrument, mk)))
      );
      const fn = FUNCTION_NAME[mk.function]();
      return mk.fret === 0
        ? m.fretboard_description_entry_open({ string: mk.string, note, function: fn })
        : m.fretboard_description_entry({ string: mk.string, fret: mk.fret, note, function: fn });
    });
  const body = entries.length > 0 ? entries.join('; ') : m.fretboard_description_empty();
  return model.summary ? `${model.summary} ${body}` : body;
}
