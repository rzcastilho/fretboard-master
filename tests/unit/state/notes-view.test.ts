import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR, type Instrument } from '../../../src/lib/instrument/instrument';
import {
  addNote,
  clear,
  closeCard,
  equalsNotesView,
  initialNotesView,
  missingNotes,
  openCard,
  reset,
  revalidate,
  setHideNames,
  setBackground,
  setLabelType,
  setRegionEnd,
  setRegionShortcut,
  setRegionStart,
  toggleNote,
  toggleString,
  type RegionShortcut
} from '../../../src/lib/state/notes-view';

const sevenString: Instrument = {
  ...STANDARD_GUITAR,
  stringCount: 7,
  fretCount: 24,
  openStrings: [...STANDARD_GUITAR.openStrings, { letter: 'B', accidental: 0, octave: 1 }]
};

describe('initialNotesView (FR-001)', () => {
  it('matches the defaults for the default instrument', () => {
    expect(initialNotesView(STANDARD_GUITAR)).toEqual({
      selection: [],
      labelType: 'name',
      background: 'naturals',
      hideNames: false,
      activeStrings: [1, 2, 3, 4, 5, 6],
      region: { start: 0, end: 22 },
      card: null
    });
  });

  it('adapts strings and region to a 7-string, 24-fret instrument', () => {
    const s = initialNotesView(sevenString);
    expect(s.activeStrings).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.region).toEqual({ start: 0, end: 24 });
    expect(s.selection).toEqual([]);
    expect(s.card).toBeNull();
  });
});

describe('equalsNotesView', () => {
  const base = initialNotesView(STANDARD_GUITAR);

  it('is true for the same object and for structurally equal values', () => {
    expect(equalsNotesView(base, base)).toBe(true);
    expect(equalsNotesView(base, initialNotesView(STANDARD_GUITAR))).toBe(true);
  });

  it.each([
    ['selection', { selection: [0] }],
    ['labelType', { labelType: 'octave' as const }],
    ['background', { background: 'all' as const }],
    ['hideNames', { hideNames: true }],
    ['activeStrings', { activeStrings: [1, 2] }],
    ['region start', { region: { start: 1, end: 22 } }],
    ['region end', { region: { start: 0, end: 21 } }],
    ['card', { card: { string: 1, fret: 0 } }]
  ])('is false when %s differs', (_name, patch) => {
    expect(equalsNotesView(base, { ...base, ...patch })).toBe(false);
  });

  it('is order-sensitive for selection (first-selected order is state)', () => {
    expect(equalsNotesView({ ...base, selection: [1, 2] }, { ...base, selection: [2, 1] })).toBe(
      false
    );
  });

  it('treats equal cards by position, not identity', () => {
    const a = { ...base, card: { string: 2, fret: 3 } };
    const b = { ...base, card: { string: 2, fret: 3 } };
    expect(equalsNotesView(a, b)).toBe(true);
  });
});

describe('toggleNote (US1)', () => {
  const base = initialNotesView(STANDARD_GUITAR);

  it('appends when absent and removes when present', () => {
    const one = toggleNote(base, 7);
    expect(one.selection).toEqual([7]);
    expect(toggleNote(one, 7).selection).toEqual([]);
  });

  it('preserves first-selected order', () => {
    const s = toggleNote(toggleNote(toggleNote(base, 4), 1), 9);
    expect(s.selection).toEqual([4, 1, 9]);
    expect(toggleNote(s, 1).selection).toEqual([4, 9]);
    expect(toggleNote(toggleNote(s, 1), 1).selection).toEqual([4, 9, 1]);
  });

  it('accepts all 12 distinct pitch classes', () => {
    let s = base;
    for (let pc = 0; pc < 12; pc++) s = toggleNote(s, pc);
    expect(s.selection).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('does not touch other fields', () => {
    const s = toggleNote(base, 3);
    expect(s).toEqual({ ...base, selection: [3] });
  });

  it.each([-1, 12, 1.5, NaN, Infinity])('ignores invalid pc %s (same object)', (pc) => {
    expect(Object.is(toggleNote(base, pc), base)).toBe(true);
  });
});

describe('addNote / openCard / closeCard (US2)', () => {
  const base = initialNotesView(STANDARD_GUITAR);
  const p = { string: 3, fret: 2 };

  it('addNote appends when absent and never removes', () => {
    const one = addNote(base, 9);
    expect(one.selection).toEqual([9]);
    expect(addNote(one, 9)).toBe(one);
    expect(addNote(one, 4).selection).toEqual([9, 4]);
  });

  it('addNote ignores invalid pitch classes', () => {
    expect(addNote(base, 12)).toBe(base);
    expect(addNote(base, 1.5)).toBe(base);
  });

  it('openCard sets and replaces the card; the same position is a no-op', () => {
    const open = openCard(base, p);
    expect(open.card).toEqual(p);
    expect(openCard(open, { ...p })).toBe(open);
    expect(openCard(open, { string: 4, fret: 7 }).card).toEqual({ string: 4, fret: 7 });
  });

  it('closeCard clears the card and is a no-op when closed', () => {
    expect(closeCard(openCard(base, p)).card).toBeNull();
    expect(closeCard(base)).toBe(base);
  });

  it('selection changes keep the card open', () => {
    const open = openCard(base, p);
    expect(toggleNote(open, 7).card).toEqual(p);
    expect(addNote(open, 7).card).toEqual(p);
  });
});

describe('toggleString (US3, EC-4.2)', () => {
  const init = initialNotesView(STANDARD_GUITAR);

  it('removes a string and adds it back in ascending order', () => {
    const off = toggleString(init, 3);
    expect(off.activeStrings).toEqual([1, 2, 4, 5, 6]);
    expect(toggleString(off, 3).activeStrings).toEqual([1, 2, 3, 4, 5, 6]);
    expect(toggleString(toggleString(toggleString(init, 6), 1), 6).activeStrings).toEqual([
      2, 3, 4, 5, 6
    ]);
  });

  it('is a same-object no-op when removing the only active string', () => {
    const one = { ...init, activeStrings: [4] };
    expect(toggleString(one, 4)).toBe(one);
  });

  it('ignores strings outside 1..stringCount', () => {
    expect(toggleString(init, 0)).toBe(init);
    expect(toggleString(init, 7, STANDARD_GUITAR)).toBe(init);
  });
});

describe('region transitions (US3)', () => {
  const init = initialNotesView(STANDARD_GUITAR);
  const at = (start: number, end: number) => ({ ...init, region: { start, end } });

  it('setRegionStart clamps and pushes the end', () => {
    expect(setRegionStart(at(5, 9), 12, STANDARD_GUITAR).region).toEqual({ start: 12, end: 12 });
    expect(setRegionStart(at(5, 9), -3, STANDARD_GUITAR).region).toEqual({ start: 0, end: 9 });
    expect(setRegionStart(at(5, 9), 99, STANDARD_GUITAR).region).toEqual({ start: 22, end: 22 });
    expect(setRegionStart(at(5, 9), 9, STANDARD_GUITAR).region).toEqual({ start: 9, end: 9 });
  });

  it('setRegionEnd clamps and pushes the start', () => {
    expect(setRegionEnd(at(5, 9), 2, STANDARD_GUITAR).region).toEqual({ start: 2, end: 2 });
    expect(setRegionEnd(at(5, 9), 99, STANDARD_GUITAR).region).toEqual({ start: 5, end: 22 });
    expect(setRegionEnd(at(5, 9), -1, STANDARD_GUITAR).region).toEqual({ start: 0, end: 0 });
  });

  it('rounds non-integers then clamps', () => {
    expect(setRegionStart(at(0, 22), 3.6, STANDARD_GUITAR).region.start).toBe(4);
    expect(setRegionEnd(at(0, 22), 7.4, STANDARD_GUITAR).region.end).toBe(7);
  });

  it('ignores NaN and returns the same object for an unchanged value', () => {
    const s = at(5, 9);
    expect(setRegionStart(s, Number.NaN, STANDARD_GUITAR)).toBe(s);
    expect(setRegionStart(s, 5, STANDARD_GUITAR)).toBe(s);
    expect(setRegionEnd(s, 9, STANDARD_GUITAR)).toBe(s);
  });

  it('allows start === end', () => {
    expect(setRegionEnd(at(5, 9), 5, STANDARD_GUITAR).region).toEqual({ start: 5, end: 5 });
  });

  it('setRegionShortcut sets the documented regions', () => {
    const r = (k: RegionShortcut, inst: Instrument = STANDARD_GUITAR) =>
      setRegionShortcut(at(5, 9), k, inst).region;
    expect(r('0-4')).toEqual({ start: 0, end: 4 });
    expect(r('5-9')).toEqual({ start: 5, end: 9 });
    expect(r('10-14')).toEqual({ start: 10, end: 14 });
    expect(r('whole')).toEqual({ start: 0, end: 22 });
    const twelve = { ...STANDARD_GUITAR, fretCount: 12 };
    expect(r('10-14', twelve)).toEqual({ start: 10, end: 12 });
    expect(r('whole', twelve)).toEqual({ start: 0, end: 12 });
  });

  it('setRegionShortcut is a same-object no-op when the region already matches', () => {
    const s = at(5, 9);
    expect(setRegionShortcut(s, '5-9', STANDARD_GUITAR)).toBe(s);
  });
});

describe('revalidate (US3)', () => {
  const sevenInit = initialNotesView(sevenString);

  it('returns the same object when already valid', () => {
    const s = initialNotesView(STANDARD_GUITAR);
    expect(revalidate(s, STANDARD_GUITAR)).toBe(s);
  });

  it('drops string 7 going 7 → 6 strings and keeps the others', () => {
    const s = { ...sevenInit, activeStrings: [2, 5, 7] };
    expect(revalidate(s, STANDARD_GUITAR).activeStrings).toEqual([2, 5]);
  });

  it('activates every string when none remain', () => {
    const s = { ...sevenInit, activeStrings: [7] };
    expect(revalidate(s, STANDARD_GUITAR).activeStrings).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('clamps the region 24 → 12 frets then applies the push rule', () => {
    const twelve = { ...STANDARD_GUITAR, fretCount: 12 };
    const s = { ...sevenInit, region: { start: 15, end: 20 } };
    expect(revalidate(s, twelve).region).toEqual({ start: 12, end: 12 });
    const t = { ...sevenInit, region: { start: 3, end: 20 } };
    expect(revalidate(t, twelve).region).toEqual({ start: 3, end: 12 });
  });

  it('drops an invalid card and leaves the selection alone', () => {
    const s = { ...sevenInit, selection: [1, 4], card: { string: 7, fret: 20 } };
    const out = revalidate(s, STANDARD_GUITAR);
    expect(out.card).toBeNull();
    expect(out.selection).toEqual([1, 4]);
    const ok = { ...sevenInit, card: { string: 2, fret: 3 } };
    expect(revalidate(ok, STANDARD_GUITAR).card).toEqual({ string: 2, fret: 3 });
  });
});

describe('missingNotes (US3, FR-015)', () => {
  const sel = (...pcs: number[]) => pcs.reduce(toggleNote, initialNotesView(STANDARD_GUITAR));

  it('is empty with nothing selected or when every note is present', () => {
    expect(missingNotes(initialNotesView(STANDARD_GUITAR), STANDARD_GUITAR)).toEqual([]);
    expect(missingNotes(sel(1, 3), STANDARD_GUITAR)).toEqual([]);
  });

  it('lists selected notes with no position in the filters, selection order', () => {
    // string 1 (E), frets 0-4 hold E F F♯ G G♯ = 4 5 6 7 8
    const s = {
      ...sel(1, 0, 4, 3),
      activeStrings: [1],
      region: { start: 0, end: 4 }
    };
    expect(missingNotes(s, STANDARD_GUITAR)).toEqual([1, 0, 3]);
  });
});

describe('setLabelType / setBackground (US4)', () => {
  const init = initialNotesView(STANDARD_GUITAR);

  it('set the field', () => {
    expect(setLabelType(init, 'octave').labelType).toBe('octave');
    expect(setLabelType(init, 'none').labelType).toBe('none');
    expect(setBackground(init, 'all').background).toBe('all');
    expect(setBackground(init, 'none').background).toBe('none');
  });

  it('return the same object when unchanged', () => {
    expect(setLabelType(init, 'name')).toBe(init);
    expect(setBackground(init, 'naturals')).toBe(init);
    const o = setLabelType(init, 'octave');
    expect(setLabelType(o, 'octave')).toBe(o);
  });
});

describe('setHideNames / clear / reset (US5)', () => {
  const init = initialNotesView(STANDARD_GUITAR);

  it('setHideNames toggles the flag and keeps labelType', () => {
    const o = setLabelType(init, 'octave');
    const on = setHideNames(o, true);
    expect(on.hideNames).toBe(true);
    expect(on.labelType).toBe('octave');
    const off = setHideNames(on, false);
    expect(off.hideNames).toBe(false);
    expect(off.labelType).toBe('octave');
  });

  it('setHideNames is a same-object no-op when unchanged', () => {
    expect(setHideNames(init, false)).toBe(init);
    const on = setHideNames(init, true);
    expect(setHideNames(on, true)).toBe(on);
  });

  it('clear empties selection, strings, region, card; keeps label/background/hideNames', () => {
    let s = setHideNames(setBackground(setLabelType(init, 'octave'), 'all'), true);
    s = openCard(addNote(addNote(s, 7), 1), { string: 3, fret: 2 });
    s = setRegionShortcut(toggleString(s, 2), '5-9', STANDARD_GUITAR);
    const c = clear(s, STANDARD_GUITAR);
    expect(c.selection).toEqual([]);
    expect(c.activeStrings).toEqual([1, 2, 3, 4, 5, 6]);
    expect(c.region).toEqual({ start: 0, end: 22 });
    expect(c.card).toBeNull();
    expect(c.labelType).toBe('octave');
    expect(c.background).toBe('all');
    expect(c.hideNames).toBe(true);
  });

  it('clear is a same-object no-op on an already matching state', () => {
    expect(clear(init, STANDARD_GUITAR)).toBe(init);
    const o = setLabelType(init, 'octave');
    expect(clear(o, STANDARD_GUITAR)).toBe(o);
  });

  it('reset equals the initial view', () => {
    const s = setHideNames(addNote(setLabelType(init, 'none'), 3), true);
    expect(equalsNotesView(reset(STANDARD_GUITAR), init)).toBe(true);
    expect(equalsNotesView(reset(STANDARD_GUITAR), s)).toBe(false);
  });
});
