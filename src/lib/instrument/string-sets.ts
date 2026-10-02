/** Three-adjacent-string sets (data-model §3). Pure. */
import type { Pitch } from '../theory/pitch';
import { positionPitch, type Instrument, type Position } from './instrument';

/** The lowest (bass) string number of the set; valid iff integer and 3 ≤ id ≤ stringCount. */
export type StringSetId = number;

/** Bass → treble: [stringCount, …, 3]. */
export function stringSets(instrument: Instrument): readonly StringSetId[] {
  const out: StringSetId[] = [];
  for (let id = instrument.stringCount; id >= 3; id--) out.push(id);
  return out;
}

/** String numbers low → high. */
export function setStrings(id: StringSetId): readonly [number, number, number] {
  return [id, id - 1, id - 2];
}

export function setOpenPitches(
  instrument: Instrument,
  id: StringSetId
): readonly [Pitch, Pitch, Pitch] {
  const [a, b, c] = setStrings(id);
  return [
    positionPitch(instrument, { string: a, fret: 0 }),
    positionPitch(instrument, { string: b, fret: 0 }),
    positionPitch(instrument, { string: c, fret: 0 })
  ];
}

/** "6-5-4": digits and hyphens only, not translatable. */
export function setLabel(id: StringSetId): string {
  return setStrings(id).join('-');
}

/** Positions low → high for frets given low → high. */
export function shapePositions(
  id: StringSetId,
  frets: readonly [number, number, number]
): readonly [Position, Position, Position] {
  return [
    { string: id, fret: frets[0] },
    { string: id - 1, fret: frets[1] },
    { string: id - 2, fret: frets[2] }
  ];
}
