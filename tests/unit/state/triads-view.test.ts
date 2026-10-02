import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import {
  equalsTriadsView,
  initialTriadsView,
  octaveDown,
  octaveUp,
  resetTriads,
  revalidate,
  seeAllNotes,
  selectRoot,
  selectShape,
  setInversion,
  setLabelType,
  setQuality,
  setStringSet,
  setView,
  switchSpelling
} from '../../../src/lib/state/triads-view';

describe('triads view state (US1)', () => {
  it('starts on C major, root position, 3-2-1, interval labels, lowest occurrence (FR-001)', () => {
    expect(initialTriadsView(STANDARD_GUITAR)).toEqual({
      rootPc: 0,
      spellingOverride: 'none',
      quality: 'major',
      inversion: 'root',
      stringSet: 3,
      labelType: 'interval',
      occurrence: 0,
      view: 'isolated'
    });
  });

  it('setLabelType changes only the label type', () => {
    const s = initialTriadsView(STANDARD_GUITAR);
    const next = setLabelType(s, 'name');
    expect(next).toEqual({ ...s, labelType: 'name' });
    expect(next).not.toBe(s);
  });

  it('setLabelType to the current value returns the same object', () => {
    const s = initialTriadsView(STANDARD_GUITAR);
    expect(setLabelType(s, 'interval')).toBe(s);
  });

  it('equalsTriadsView compares field-wise', () => {
    const a = initialTriadsView(STANDARD_GUITAR);
    expect(equalsTriadsView(a, { ...a })).toBe(true);
    expect(equalsTriadsView(a, { ...a, labelType: 'name' })).toBe(false);
    expect(equalsTriadsView(a, { ...a, occurrence: 1 })).toBe(false);
    expect(equalsTriadsView(a, { ...a, rootPc: 1 })).toBe(false);
    expect(equalsTriadsView(a, { ...a, view: 'full-neck' })).toBe(false);
  });
});

describe('triads view transitions (US2)', () => {
  const s0 = initialTriadsView(STANDARD_GUITAR);

  it('selectRoot sets the root, clears override, resets occurrence, keeps the rest', () => {
    const s = {
      ...s0,
      spellingOverride: 'flat' as const,
      occurrence: 1,
      quality: 'minor' as const
    };
    const next = selectRoot(s, 3);
    expect(next).toEqual({ ...s, rootPc: 3, spellingOverride: 'none', occurrence: 0 });
  });

  it('selectRoot on the same root is a no-op; invalid pc is a no-op', () => {
    expect(selectRoot(s0, 0)).toBe(s0);
    expect(selectRoot(s0, 12)).toBe(s0);
    expect(selectRoot(s0, -1)).toBe(s0);
    expect(selectRoot(s0, 1.5)).toBe(s0);
  });

  it('setQuality keeps override and label, resets occurrence', () => {
    const s = {
      ...s0,
      spellingOverride: 'sharp' as const,
      labelType: 'name' as const,
      occurrence: 1
    };
    expect(setQuality(s, 'minor')).toEqual({ ...s, quality: 'minor', occurrence: 0 });
    expect(setQuality(s0, 'major')).toBe(s0);
    expect(setQuality(s0, 'bogus' as never)).toBe(s0);
  });

  it('setInversion keeps override and label, resets occurrence', () => {
    const s = {
      ...s0,
      spellingOverride: 'flat' as const,
      labelType: 'name' as const,
      occurrence: 1
    };
    expect(setInversion(s, 'first')).toEqual({ ...s, inversion: 'first', occurrence: 0 });
    expect(setInversion(s0, 'root')).toBe(s0);
    expect(setInversion(s0, 'bogus' as never)).toBe(s0);
  });

  it('setStringSet validates 3 ≤ id ≤ stringCount and resets occurrence', () => {
    const s = { ...s0, occurrence: 1, spellingOverride: 'sharp' as const };
    expect(setStringSet(s, 6, STANDARD_GUITAR)).toEqual({ ...s, stringSet: 6, occurrence: 0 });
    expect(setStringSet(s0, 3, STANDARD_GUITAR)).toBe(s0);
    expect(setStringSet(s0, 2, STANDARD_GUITAR)).toBe(s0);
    expect(setStringSet(s0, 7, STANDARD_GUITAR)).toBe(s0);
    expect(setStringSet(s0, 4.5, STANDARD_GUITAR)).toBe(s0);
  });

  it('revalidate clamps set and occurrence for a new instrument; valid state is unchanged', () => {
    expect(revalidate(s0, STANDARD_GUITAR)).toBe(s0);
    const tooBig = { ...s0, stringSet: 9, occurrence: 5 };
    const fixed = revalidate(tooBig, STANDARD_GUITAR);
    expect(fixed.stringSet).toBe(6);
    expect(fixed.occurrence).toBeLessThanOrEqual(1);
    expect(revalidate({ ...s0, occurrence: -2 }, STANDARD_GUITAR).occurrence).toBe(0);
    expect(revalidate({ ...s0, stringSet: 1 }, STANDARD_GUITAR).stringSet).toBe(3);
  });
});

describe('switchSpelling (US3)', () => {
  const init = initialTriadsView(STANDARD_GUITAR);
  const dsharp = selectRoot(init, 3);

  it('toggles the override on altered roots: default flat → sharp → flat', () => {
    const sharp = switchSpelling(dsharp);
    expect(sharp.spellingOverride).toBe('sharp');
    expect(switchSpelling(sharp).spellingOverride).toBe('flat');
  });

  it('is a same-object no-op on natural roots', () => {
    expect(switchSpelling(init)).toBe(init);
  });

  it('is kept across quality, inversion, set, label and octave changes', () => {
    const sw = switchSpelling(dsharp);
    expect(setQuality(sw, 'augmented').spellingOverride).toBe('sharp');
    expect(setInversion(sw, 'first').spellingOverride).toBe('sharp');
    expect(setStringSet(sw, 4, STANDARD_GUITAR).spellingOverride).toBe('sharp');
    expect(setLabelType(sw, 'name').spellingOverride).toBe('sharp');
    expect(switchSpelling({ ...sw, occurrence: 1 }).occurrence).toBe(1);
  });

  it('is cleared on root change', () => {
    expect(selectRoot(switchSpelling(dsharp), 6).spellingOverride).toBe('none');
  });

  it('quality change without override uses the TM-4.3 default', () => {
    // D♯/E♭ minor defaults to flat; major defaults to flat too; F♯/G♭ major defaults to sharp
    const fs = selectRoot(init, 6);
    expect(fs.spellingOverride).toBe('none');
    expect(setQuality(fs, 'minor').spellingOverride).toBe('none');
  });
});

describe('octave commands (US4)', () => {
  const init = initialTriadsView(STANDARD_GUITAR);
  const up = octaveUp(init, STANDARD_GUITAR);

  it('octaveUp moves to the next occurrence, octaveDown back', () => {
    expect(up.occurrence).toBe(1);
    expect(octaveDown(up, STANDARD_GUITAR)).toEqual(init);
  });

  it('is a same-object no-op at both ends', () => {
    expect(octaveDown(init, STANDARD_GUITAR)).toBe(init);
    expect(octaveUp(up, STANDARD_GUITAR)).toBe(up);
  });

  it('is a same-object no-op when there are no occurrences', () => {
    // 12 frets, C diminished root on 5-4-3 lies beyond the last fret.
    const s = { ...init, quality: 'diminished' as const, stringSet: 5 };
    const short = { ...STANDARD_GUITAR, fretCount: 12 };
    expect(octaveUp(s, short)).toBe(s);
    expect(octaveDown(s, short)).toBe(s);
  });

  it('is a no-op when the shape has a single occurrence (1st inversion on 6-5-4)', () => {
    const s = { ...init, inversion: 'first' as const, stringSet: 6 };
    expect(octaveUp(s, STANDARD_GUITAR)).toBe(s);
    expect(octaveDown(s, STANDARD_GUITAR)).toBe(s);
  });

  it('resets on root, quality, inversion and string set changes', () => {
    expect(selectRoot(up, 2).occurrence).toBe(0);
    expect(setQuality(up, 'minor').occurrence).toBe(0);
    expect(setInversion(up, 'first').occurrence).toBe(0);
    expect(setStringSet(up, 4, STANDARD_GUITAR).occurrence).toBe(0);
  });

  it('is kept on spelling and label changes', () => {
    const d = selectRoot(init, 3);
    const dUp = octaveUp(d, STANDARD_GUITAR);
    expect(dUp.occurrence).toBe(1);
    expect(switchSpelling(dUp).occurrence).toBe(1);
    expect(setLabelType(dUp, 'name').occurrence).toBe(1);
  });
});

describe('view transitions (feature 006, data-model §3)', () => {
  const s0 = initialTriadsView(STANDARD_GUITAR);
  const full = setView(s0, 'full-neck');
  const all = setView(s0, 'all-notes');

  it('setView changes only the view; invalid or same value returns the same object', () => {
    const s = { ...s0, inversion: 'first' as const, occurrence: 1, stringSet: 4 };
    expect(setView(s, 'full-neck')).toEqual({ ...s, view: 'full-neck' });
    expect(setView(s0, 'isolated')).toBe(s0);
    expect(setView(s0, 'bogus' as never)).toBe(s0);
    expect(full.view).toBe('full-neck');
  });

  it('seeAllNotes goes to all-notes and keeps the rest; no-op when already there', () => {
    const s = { ...full, inversion: 'second' as const, occurrence: 1 };
    expect(seeAllNotes(s)).toEqual({ ...s, view: 'all-notes' });
    expect(seeAllNotes(all)).toBe(all);
  });

  it('selectShape sets inversion and occurrence only in full-neck (C3)', () => {
    expect(selectShape(full, 'second', 1, STANDARD_GUITAR)).toEqual({
      ...full,
      inversion: 'second',
      occurrence: 1
    });
    const sameInv = selectShape(full, 'root', 1, STANDARD_GUITAR);
    expect(sameInv).toEqual({ ...full, occurrence: 1 });
  });

  it('selectShape no-ops: wrong view, invalid inversion, bad octave, already equal', () => {
    expect(selectShape(s0, 'second', 1, STANDARD_GUITAR)).toBe(s0);
    expect(selectShape(all, 'second', 1, STANDARD_GUITAR)).toBe(all);
    expect(selectShape(full, 'bogus' as never, 0, STANDARD_GUITAR)).toBe(full);
    expect(selectShape(full, 'root', -1, STANDARD_GUITAR)).toBe(full);
    expect(selectShape(full, 'root', 1.5, STANDARD_GUITAR)).toBe(full);
    expect(selectShape(full, 'root', 9, STANDARD_GUITAR)).toBe(full);
    expect(selectShape(full, 'root', 0, STANDARD_GUITAR)).toBe(full);
  });

  it('setInversion still resets occurrence and is a no-op in all-notes', () => {
    const s = { ...full, occurrence: 1 };
    expect(setInversion(s, 'first')).toEqual({ ...s, inversion: 'first', occurrence: 0 });
    expect(setInversion(all, 'first')).toBe(all);
  });

  it('setStringSet is a no-op in all-notes only', () => {
    expect(setStringSet(all, 4, STANDARD_GUITAR)).toBe(all);
    expect(setStringSet(full, 4, STANDARD_GUITAR).stringSet).toBe(4);
  });

  it('octaveUp/octaveDown are no-ops outside isolated and keep the index (C4)', () => {
    const f = { ...full, occurrence: 1 };
    const a = { ...all, occurrence: 1 };
    expect(octaveUp(f, STANDARD_GUITAR)).toBe(f);
    expect(octaveDown(f, STANDARD_GUITAR)).toBe(f);
    expect(octaveUp(a, STANDARD_GUITAR)).toBe(a);
    expect(octaveDown(a, STANDARD_GUITAR)).toBe(a);
    expect(octaveUp(s0, STANDARD_GUITAR).occurrence).toBe(1);
  });

  it('resetTriads returns an isolated initial state', () => {
    expect(resetTriads(STANDARD_GUITAR)).toEqual(s0);
    expect(resetTriads(STANDARD_GUITAR).view).toBe('isolated');
  });

  it('view survives root, quality, spelling, label and revalidate', () => {
    for (const v of [full, all]) {
      expect(selectRoot(v, 3).view).toBe(v.view);
      expect(setQuality(v, 'minor').view).toBe(v.view);
      expect(switchSpelling(selectRoot(v, 3)).view).toBe(v.view);
      expect(setLabelType(v, 'name').view).toBe(v.view);
      expect(revalidate({ ...v, stringSet: 9 }, STANDARD_GUITAR).view).toBe(v.view);
    }
  });
});
