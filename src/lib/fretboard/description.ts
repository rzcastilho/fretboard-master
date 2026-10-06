/** Text names for fretboard positions (data-model §8). */
import { m } from '$lib/paraglide/messages.js';
import {
  isValidPosition,
  positionKey,
  positionPitch,
  type Instrument,
  type Position
} from '../instrument/instrument';
import { defaultSpelling, spokenMarker, spokenNote } from '../notation/notation';
import { pitchClass } from '../theory/pitch';
import type { DisplayModel, Marker, NoteFunction } from './types';

const FUNCTION_NAME: Readonly<Record<NoteFunction, () => string>> = {
  root: () => m.fretboard_function_root(),
  third: () => m.fretboard_function_third(),
  fifth: () => m.fretboard_function_fifth(),
  degree: () => m.fretboard_function_degree(),
  neutral: () => m.fretboard_function_neutral()
};

/**
 * Spoken note of an instrument position. An explicit marker spelling always wins; otherwise
 * `'preference'` follows the accidental preference and absent keeps sharps (021 F-1, F-2).
 */
function spokenAt(
  instrument: Instrument,
  position: Position,
  marker: Marker | undefined,
  policy: DisplayModel['spellingPolicy']
): string {
  if (marker?.spelling) return spokenNote(marker.spelling);
  const pc = pitchClass(positionPitch(instrument, position));
  return policy === 'preference' ? spokenMarker(pc) : spokenNote(defaultSpelling(pc));
}

export function positionName(
  instrument: Instrument,
  position: Position,
  marker?: Marker,
  policy?: DisplayModel['spellingPolicy']
): string {
  const note = spokenAt(instrument, position, marker, policy);
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

/** Localized "a", "a and b", "a, b, and c" (no `Intl.ListFormat`; catalog keys only). */
export function spokenList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return m.list_and_two({ a: items[0], b: items[1] });
  return m.list_and_many({ head: items.slice(0, -1).join(', '), last: items[items.length - 1] });
}

/**
 * "string N, fret F, note, function" entries, string descending then fret ascending (FR-004).
 * Only highlighted/normal markers at valid positions; first marker per position wins.
 */
export function describeEntries(
  instrument: Instrument,
  markers: readonly Marker[],
  policy?: DisplayModel['spellingPolicy']
): readonly string[] {
  const seen = new Set<string>();
  return markers
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
      const note = spokenAt(instrument, mk, mk, policy);
      const fn = FUNCTION_NAME[mk.function]();
      return mk.fret === 0
        ? m.fretboard_description_entry_open({ string: mk.string, note, function: fn })
        : m.fretboard_description_entry({ string: mk.string, fret: mk.fret, note, function: fn });
    });
}

/** Never returns an empty string (FR-007). */
export function describeView(instrument: Instrument, model: DisplayModel): string {
  const entries = describeEntries(instrument, model.markers, model.spellingPolicy);
  const body = entries.length > 0 ? entries.join('; ') : m.fretboard_description_empty();
  return model.summary ? `${model.summary} ${body}` : body;
}
