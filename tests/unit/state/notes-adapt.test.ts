import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR, type Instrument } from '../../../src/lib/instrument/instrument';
import {
  adaptNotesView,
  initialNotesView,
  openCard,
  setBackground,
  setHideNames,
  setLabelType,
  toggleNote,
  toggleString,
  type NotesViewState
} from '../../../src/lib/state/notes-view';

const at = (fretCount: number): Instrument => ({ ...STANDARD_GUITAR, fretCount });
const I22 = at(22);
const I12 = at(12);
const I24 = at(24);

const withRegion = (s: NotesViewState, start: number, end: number): NotesViewState => ({
  ...s,
  region: { start, end }
});

describe('adaptNotesView (data-model §5.1)', () => {
  it('whole-neck region follows the new fret count without adjusting', () => {
    const s = initialNotesView(I22);
    const r = adaptNotesView(s, I22, I12);
    expect(r.view.region).toEqual({ start: 0, end: 12 });
    expect(r.adjusted).toBe(false);
  });

  it('whole-neck region follows an increase and never adjusts', () => {
    const r = adaptNotesView(initialNotesView(I22), I22, I24);
    expect(r.view.region).toEqual({ start: 0, end: 24 });
    expect(r.adjusted).toBe(false);
  });

  it('valid region and card: same object, not adjusted', () => {
    const s = openCard(withRegion(initialNotesView(I22), 3, 9), { string: 2, fret: 5 });
    const r = adaptNotesView(s, I22, I12);
    expect(r.view).toBe(s);
    expect(r.adjusted).toBe(false);
  });

  it('region 10–14 becomes 10–12 and adjusts', () => {
    const r = adaptNotesView(withRegion(initialNotesView(I22), 10, 14), I22, I12);
    expect(r.view.region).toEqual({ start: 10, end: 12 });
    expect(r.adjusted).toBe(true);
  });

  it('region fully beyond the last fret collapses to the last fret and adjusts', () => {
    const r = adaptNotesView(withRegion(initialNotesView(I22), 15, 20), I22, I12);
    expect(r.view.region).toEqual({ start: 12, end: 12 });
    expect(r.adjusted).toBe(true);
  });

  it('card past the last fret closes and adjusts', () => {
    const s = openCard(withRegion(initialNotesView(I22), 0, 8), { string: 1, fret: 20 });
    const r = adaptNotesView(s, I22, I12);
    expect(r.view.card).toBeNull();
    expect(r.adjusted).toBe(true);
  });

  it('whole-neck region with a card that closes still adjusts', () => {
    const s = openCard(initialNotesView(I22), { string: 1, fret: 20 });
    const r = adaptNotesView(s, I22, I12);
    expect(r.view.region).toEqual({ start: 0, end: 12 });
    expect(r.view.card).toBeNull();
    expect(r.adjusted).toBe(true);
  });

  it('whole-neck region keeps a card that is still valid', () => {
    const s = openCard(initialNotesView(I22), { string: 1, fret: 5 });
    const r = adaptNotesView(s, I22, I12);
    expect(r.view.card).toEqual({ string: 1, fret: 5 });
    expect(r.adjusted).toBe(false);
  });

  it('fret increase never adjusts', () => {
    const s = openCard(withRegion(initialNotesView(I22), 10, 14), { string: 1, fret: 14 });
    const r = adaptNotesView(s, I22, I24);
    expect(r.adjusted).toBe(false);
    expect(r.view).toBe(s);
  });

  it('leaves selection, label type, background, hide-names and strings unchanged', () => {
    let s = withRegion(initialNotesView(I22), 10, 14);
    s = toggleNote(toggleNote(s, 0), 7);
    s = setLabelType(setBackground(setHideNames(toggleString(s, 2), true), 'all'), 'octave');
    const r = adaptNotesView(s, I22, I12);
    expect(r.view.selection).toEqual([0, 7]);
    expect(r.view.labelType).toBe('octave');
    expect(r.view.background).toBe('all');
    expect(r.view.hideNames).toBe(true);
    expect(r.view.activeStrings).toEqual(s.activeStrings);
  });
});
