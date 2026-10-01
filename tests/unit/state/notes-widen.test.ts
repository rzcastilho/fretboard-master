import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  STANDARD_GUITAR,
  allPositions,
  positionPitch
} from '../../../src/lib/instrument/instrument';
import { pitchClass } from '../../../src/lib/theory/pitch';
import { noteLabel, pitchLabel, defaultSpelling } from '../../../src/lib/notation/notation';
import { octaveOf } from '../../../src/lib/theory/pitch';
import {
  initialNotesView,
  missingNotes,
  toggleNote,
  widenRegion,
  type NotesViewState
} from '../../../src/lib/state/notes-view';

const INST = STANDARD_GUITAR;
const INIT = initialNotesView(INST);

describe('widenRegion (R-06)', () => {
  it('C♯ on string 1 only, region 0–4 → 0–9 with s1f9 as the new position', () => {
    const s: NotesViewState = {
      ...toggleNote(INIT, 1),
      activeStrings: [1],
      region: { start: 0, end: 4 }
    };
    const out = widenRegion(s, INST);
    expect(out.region).toEqual({ start: 0, end: 9 });
    const pitch = positionPitch(INST, { string: 1, fret: 9 });
    expect(pitchClass(pitch)).toBe(1);
    // label is computed (C♯5 per R-05), never hard-coded
    expect(pitchLabel(defaultSpelling(1), octaveOf(pitch))).toBe(
      `${noteLabel(defaultSpelling(1))}${octaveOf(pitch)}`
    );
  });

  it('never touches strings or selection, and is the same object when nothing is missing', () => {
    const s: NotesViewState = {
      ...toggleNote(toggleNote(INIT, 1), 6),
      activeStrings: [1, 2],
      region: { start: 3, end: 3 }
    };
    const out = widenRegion(s, INST);
    expect(out.activeStrings).toBe(s.activeStrings);
    expect(out.selection).toBe(s.selection);
    expect(widenRegion(out, INST)).toBe(out);
    expect(widenRegion(INIT, INST)).toBe(INIT);
  });

  it('extends the end on a distance tie', () => {
    // string 1 (E): D♯ (3) at fret 11, region 5–5 → start side 5-? ; construct a tie explicitly
    // pc 7 (G) on string 1 is at frets 3 and 15; region 9–9: distances 6 and 6 → tie → end
    const s: NotesViewState = {
      ...toggleNote(INIT, 7),
      activeStrings: [1],
      region: { start: 9, end: 9 }
    };
    expect(widenRegion(s, INST).region).toEqual({ start: 9, end: 15 });
  });

  it('result contains the original region, every selected note, and is minimal', () => {
    const hasAll = (s: NotesViewState, start: number, end: number) =>
      missingNotes({ ...s, region: { start, end } }, INST).length === 0;
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 11 }), { minLength: 1, maxLength: 12 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 0, max: 22 }),
        fc.integer({ min: 0, max: 22 }),
        (selection, strings, a, b) => {
          const s: NotesViewState = {
            ...INIT,
            selection,
            activeStrings: [...strings].sort((x, y) => x - y),
            region: { start: Math.min(a, b), end: Math.max(a, b) }
          };
          const out = widenRegion(s, INST).region;
          expect(out.start).toBeLessThanOrEqual(s.region.start);
          expect(out.end).toBeGreaterThanOrEqual(s.region.end);
          expect(hasAll(s, out.start, out.end)).toBe(true);
          // minimality: pulling in either moved limit by one fret loses a note
          if (out.start < s.region.start) expect(hasAll(s, out.start + 1, out.end)).toBe(false);
          if (out.end > s.region.end) expect(hasAll(s, out.start, out.end - 1)).toBe(false);
        }
      )
    );
  });

  it('only positions on the board count (sanity)', () => {
    expect(allPositions(INST).length).toBe(6 * 23);
  });
});
