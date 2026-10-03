import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR, type Instrument } from '../../../src/lib/instrument/instrument';
import { presetInstrument } from '../../../src/lib/instrument/tunings';
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

describe('adaptNotesView string-count step (data-model §6)', () => {
  const six: Instrument = presetInstrument('AF-1', 6, 22);
  const seven: Instrument = presetInstrument('AF-21', 7, 22);
  const all = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
  const only = (s: NotesViewState, keep: number[], i: Instrument): NotesViewState => ({
    ...s,
    activeStrings: all(i.stringCount).filter((n) => keep.includes(n))
  });

  it('6 → 7 with every string on turns string 7 on, not adjusted', () => {
    const r = adaptNotesView(initialNotesView(six), six, seven);
    expect(r.view.activeStrings).toEqual(all(7));
    expect(r.adjusted).toBe(false);
  });

  it('6 → 7 with a subset leaves the subset (7 off), not adjusted', () => {
    const s = only(initialNotesView(six), [1, 2, 3], six);
    const r = adaptNotesView(s, six, seven);
    expect(r.view.activeStrings).toEqual([1, 2, 3]);
    expect(r.adjusted).toBe(false);
  });

  it('7 → 6 with other strings on drops string 7 silently', () => {
    const r = adaptNotesView(initialNotesView(seven), seven, six);
    expect(r.view.activeStrings).toEqual(all(6));
    expect(r.adjusted).toBe(false);
    const s = only(initialNotesView(seven), [2, 7], seven);
    const r2 = adaptNotesView(s, seven, six);
    expect(r2.view.activeStrings).toEqual([2]);
    expect(r2.adjusted).toBe(false);
  });

  it('7 → 6 with only string 7 on turns all six on and adjusts', () => {
    const s = only(initialNotesView(seven), [7], seven);
    const r = adaptNotesView(s, seven, six);
    expect(r.view.activeStrings).toEqual(all(6));
    expect(r.adjusted).toBe(true);
  });

  it('same count leaves strings unchanged and does not adjust', () => {
    const s = only(initialNotesView(seven), [3, 7], seven);
    const r = adaptNotesView(s, seven, seven);
    expect(r.view.activeStrings).toEqual([3, 7]);
    expect(r.adjusted).toBe(false);
  });

  it('a card on string 7 closes on 7 → 6 and adjusts', () => {
    const s = openCard(initialNotesView(seven), { string: 7, fret: 3 });
    const r = adaptNotesView(s, seven, six);
    expect(r.view.card).toBeNull();
    expect(r.adjusted).toBe(true);
  });

  it('a card on string 7 closes with a non-whole region too', () => {
    const s = openCard(withRegion(initialNotesView(seven), 0, 10), { string: 7, fret: 3 });
    const r = adaptNotesView(s, seven, six);
    expect(r.view.card).toBeNull();
    expect(r.adjusted).toBe(true);
  });

  it('a silent string-7 drop does not raise the notice', () => {
    const s = withRegion(initialNotesView(seven), 2, 8);
    const r = adaptNotesView(s, seven, six);
    expect(r.view.activeStrings).toEqual(all(6));
    expect(r.adjusted).toBe(false);
  });
});
