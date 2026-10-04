import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { stringSets } from '../../../src/lib/instrument/string-sets';
import { buildTriadsModel } from '../../../src/lib/state/triads-model';
import { AF_1_12, AF_21 } from '../../../src/lib/instrument/fixtures';
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
  setCompare,
  setCompareQuality,
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
      view: 'isolated',
      compare: { on: false, quality: null }
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

describe('compare field (007 S1, S7)', () => {
  const init = initialTriadsView(STANDARD_GUITAR);

  it('S1: starts off with no remembered quality', () => {
    expect(init.compare).toEqual({ on: false, quality: null });
  });

  it('S7: reset clears compare', () => {
    const dirty = { ...init, compare: { on: true, quality: 'minor' as const } };
    expect(resetTriads(STANDARD_GUITAR).compare).toEqual({ on: false, quality: null });
    expect(equalsTriadsView(resetTriads(STANDARD_GUITAR), init)).toBe(true);
    expect(equalsTriadsView(dirty, init)).toBe(false);
  });

  it('equalsTriadsView compares compare.on and compare.quality', () => {
    const a = { ...init, compare: { on: true, quality: 'minor' as const } };
    expect(equalsTriadsView(a, { ...a, compare: { on: true, quality: 'minor' } })).toBe(true);
    expect(equalsTriadsView(a, { ...a, compare: { on: false, quality: 'minor' } })).toBe(false);
    expect(equalsTriadsView(a, { ...a, compare: { on: true, quality: 'diminished' } })).toBe(false);
    expect(equalsTriadsView(a, { ...a, compare: { on: true, quality: null } })).toBe(false);
  });
});

describe('triads view Compare transitions (US1: S2, S3, S4, S9)', () => {
  const s0 = initialTriadsView(STANDARD_GUITAR);

  it('S2: setCompare(true) in all-notes returns the same state', () => {
    const s = { ...s0, view: 'all-notes' as const };
    expect(setCompare(s, true, STANDARD_GUITAR)).toBe(s);
  });

  it('S3: turning on picks the one-note partner when nothing is remembered', () => {
    expect(setCompare(s0, true, STANDARD_GUITAR).compare).toEqual({ on: true, quality: 'minor' });
    const dim = { ...s0, quality: 'diminished' as const };
    expect(setCompare(dim, true, STANDARD_GUITAR).compare).toEqual({ on: true, quality: 'minor' });
    const minor = { ...s0, quality: 'minor' as const };
    expect(setCompare(minor, true, STANDARD_GUITAR).compare).toEqual({
      on: true,
      quality: 'major'
    });
  });

  it('S3: turning on reuses a valid remembered quality, ignores an invalid one', () => {
    const remembered = { ...s0, compare: { on: false, quality: 'augmented' as const } };
    expect(setCompare(remembered, true, STANDARD_GUITAR).compare).toEqual({
      on: true,
      quality: 'augmented'
    });
    const same = { ...s0, compare: { on: false, quality: 'major' as const } };
    expect(setCompare(same, true, STANDARD_GUITAR).compare).toEqual({ on: true, quality: 'minor' });
  });

  it('S3: turning on when already on, or off when already off, is a no-op', () => {
    const on = setCompare(s0, true, STANDARD_GUITAR);
    expect(setCompare(on, true, STANDARD_GUITAR)).toBe(on);
    expect(setCompare(s0, false, STANDARD_GUITAR)).toBe(s0);
  });

  it('S3: turning off keeps the quality (remembered) and the state otherwise', () => {
    const on = setCompare(s0, true, STANDARD_GUITAR);
    const off = setCompare(on, false, STANDARD_GUITAR);
    expect(off).toEqual({ ...s0, compare: { on: false, quality: 'minor' } });
    expect(off.quality).toBe('major');
  });

  it('S4: setCompareQuality changes the comparison quality only while on', () => {
    const on = setCompare(s0, true, STANDARD_GUITAR);
    expect(setCompareQuality(on, 'diminished', STANDARD_GUITAR).compare).toEqual({
      on: true,
      quality: 'diminished'
    });
    expect(setCompareQuality(on, 'minor', STANDARD_GUITAR)).toBe(on);
  });

  it('S4: setCompareQuality to the current quality or while off returns s', () => {
    const on = setCompare(s0, true, STANDARD_GUITAR);
    expect(setCompareQuality(on, on.quality, STANDARD_GUITAR)).toBe(on);
    expect(setCompareQuality(s0, 'minor', STANDARD_GUITAR)).toBe(s0);
  });

  it('S9: invalid qualities return s', () => {
    const on = setCompare(s0, true, STANDARD_GUITAR);
    expect(setCompareQuality(on, 'suspended' as never, STANDARD_GUITAR)).toBe(on);
    expect(setCompare(s0, 'yes' as never, STANDARD_GUITAR)).toBe(s0);
  });

  it('clamps occurrence to the occurrence count', () => {
    // 2nd inversion 4-3-2 on G has two occurrences (0-0-0 and 12-12-12).
    const high = {
      ...s0,
      rootPc: 7 as const,
      inversion: 'second' as const,
      stringSet: 4,
      occurrence: 1
    };
    expect(setCompare(high, true, STANDARD_GUITAR).occurrence).toBeLessThanOrEqual(1);
    const beyond = { ...s0, occurrence: 9 };
    expect(setCompare(beyond, true, STANDARD_GUITAR).occurrence).toBe(
      revalidate(beyond, STANDARD_GUITAR).occurrence
    );
  });
});

describe('Compare survives other transitions (007 US2: S6)', () => {
  const s0 = initialTriadsView(STANDARD_GUITAR);
  const on = setCompare(s0, true, STANDARD_GUITAR);

  it('selectRoot, switchSpelling, setInversion, setStringSet and setView keep compare', () => {
    expect(selectRoot(on, 1).compare).toEqual(on.compare);
    expect(switchSpelling(selectRoot(on, 1)).compare).toEqual(on.compare);
    expect(setInversion(on, 'first').compare).toEqual(on.compare);
    expect(setStringSet(on, 4, STANDARD_GUITAR).compare).toEqual(on.compare);
    expect(setView(on, 'full-neck').compare).toEqual(on.compare);
  });

  it('Isolated → Full neck → All notes → back restores the same comparison', () => {
    const back = setView(setView(setView(on, 'full-neck'), 'all-notes'), 'isolated');
    expect(back.compare).toEqual({ on: true, quality: 'minor' });
  });
});

describe('Compare and octave limits in Isolated (007 US3: S8)', () => {
  const g2nd = (o: Partial<ReturnType<typeof initialTriadsView>> = {}) => ({
    ...initialTriadsView(STANDARD_GUITAR),
    rootPc: 7 as const,
    inversion: 'second' as const,
    stringSet: 4,
    ...o
  });
  const c3 = (o: Partial<ReturnType<typeof initialTriadsView>> = {}) => ({
    ...initialTriadsView(STANDARD_GUITAR),
    compare: { on: true, quality: 'minor' as const },
    ...o
  });

  it('octaveUp/octaveDown step through pair occurrences (C major vs minor 3-2-1: two pairs)', () => {
    const up = octaveUp(c3(), STANDARD_GUITAR);
    expect(up.occurrence).toBe(1);
    expect(octaveDown(up, STANDARD_GUITAR).occurrence).toBe(0);
  });

  it('G major 2nd inv. 4-3-2 vs minor has one pair: octaveUp is a no-op although two first triads exist', () => {
    const s = g2nd({ compare: { on: true, quality: 'minor' } });
    expect(octaveUp(s, STANDARD_GUITAR)).toBe(s);
    // Without Compare the same shape has two occurrences.
    expect(octaveUp(g2nd(), STANDARD_GUITAR).occurrence).toBe(1);
  });

  it('setCompare(true) clamps occurrence to the last pair occurrence; off clamps to first-triad count', () => {
    const high = g2nd({ occurrence: 1 });
    const on = setCompare(high, true, STANDARD_GUITAR);
    expect(on.occurrence).toBe(0);
    expect(setCompare(on, false, STANDARD_GUITAR).occurrence).toBe(0);
  });

  it('setCompareQuality clamps occurrence to the new pair count', () => {
    // Occurrence 1 is clamped to the new quality's last pair occurrence.
    const s = setCompare(g2nd(), true, STANDARD_GUITAR);
    const next = setCompareQuality({ ...s, occurrence: 1 }, 'augmented', STANDARD_GUITAR);
    expect(next.occurrence).toBeLessThanOrEqual(1);
    expect(next.compare.quality).toBe('augmented');
  });

  it('revalidate clamps against pair occurrences with Compare on', () => {
    const s = g2nd({ occurrence: 1, compare: { on: true, quality: 'minor' } });
    expect(revalidate(s, STANDARD_GUITAR).occurrence).toBe(0);
  });

  it('C7: with no pair occurrence the first-triad occurrences are stepped through', () => {
    // 12-fret instrument: C♯ minor 1st inv. 6-5-4 only fits once and its comparison is off the end.
    const s = {
      ...initialTriadsView(AF_1_12),
      rootPc: 1 as const,
      quality: 'minor' as const,
      inversion: 'first' as const,
      stringSet: 6,
      compare: { on: true, quality: 'major' as const }
    };
    expect(octaveUp(s, AF_1_12)).toBe(s);
    expect(octaveDown(s, AF_1_12)).toBe(s);
    expect(revalidate(s, AF_1_12)).toBe(s);
  });

  it('quality, root, inversion and set changes still reset occurrence to 0', () => {
    const s = c3({ occurrence: 1 });
    expect(selectRoot(s, 2).occurrence).toBe(0);
    expect(setInversion(s, 'first').occurrence).toBe(0);
    expect(setStringSet(s, 4, STANDARD_GUITAR).occurrence).toBe(0);
    expect(setQuality(s, 'augmented').occurrence).toBe(0);
  });
});

describe('Compare quality swap (007 US4: S5)', () => {
  const s0 = initialTriadsView(STANDARD_GUITAR);
  const on = setCompare(s0, true, STANDARD_GUITAR); // major vs minor

  it('choosing the comparison quality as the current one swaps the two', () => {
    const next = setQuality(on, 'minor');
    expect(next.quality).toBe('minor');
    expect(next.compare).toEqual({ on: true, quality: 'major' });
    expect(next.occurrence).toBe(0);
  });

  it('any other quality change keeps compare.quality', () => {
    const next = setQuality(on, 'diminished');
    expect(next.quality).toBe('diminished');
    expect(next.compare).toEqual({ on: true, quality: 'minor' });
  });

  it('with Compare off, the remembered quality is not swapped', () => {
    const off = setCompare(on, false, STANDARD_GUITAR);
    const next = setQuality(off, 'minor');
    expect(next.compare).toEqual({ on: false, quality: 'minor' });
  });
});

describe('Triads on seven strings (012 US3)', () => {
  it('offers 7-6-5 first on 7 strings and 6-5-4 first on 6', () => {
    expect(stringSets(AF_21)).toEqual([7, 6, 5, 4, 3]);
    expect(stringSets(STANDARD_GUITAR)).toEqual([6, 5, 4, 3]);
  });

  it('setStringSet accepts set 7 on 7 strings and refuses it on 6', () => {
    const s = initialTriadsView(AF_21);
    expect(s.stringSet).toBe(3);
    expect(setStringSet(s, 7, AF_21).stringSet).toBe(7);
    const s6 = initialTriadsView(STANDARD_GUITAR);
    expect(setStringSet(s6, 7, STANDARD_GUITAR)).toBe(s6);
  });

  it('7-6-5 C major root on AF-21 shows 13-12-10 on strings 7, 6, 5', () => {
    const s = setStringSet(initialTriadsView(AF_21), 7, AF_21);
    const d = buildTriadsModel(s, AF_21);
    expect(d.shape).toMatchObject({
      kind: 'shown',
      frets: [13, 12, 10],
      positions: [
        { string: 7, fret: 13 },
        { string: 6, fret: 12 },
        { string: 5, fret: 10 }
      ]
    });
  });

  it('sets 6-5-4 … 3-2-1 on 7 strings equal a 6-string instrument with the same six higher strings (US3-7)', () => {
    for (const set of [6, 5, 4, 3]) {
      const s6 = setStringSet(initialTriadsView(STANDARD_GUITAR), set, STANDARD_GUITAR);
      const s7 = setStringSet(initialTriadsView(AF_21), set, AF_21);
      const a = buildTriadsModel(s6, STANDARD_GUITAR);
      const b = buildTriadsModel(s7, AF_21);
      expect(b.shape).toEqual(a.shape);
      expect(b.model.markers).toEqual(a.model.markers);
    }
  });

  it('12-fret 7-6-5 C major root is "beyond fret 12", not "does not close"', () => {
    const short = { ...AF_21, fretCount: 12 };
    const s = setStringSet(initialTriadsView(short), 7, short);
    const d = buildTriadsModel(s, short);
    expect(d.shape).toEqual({ kind: 'beyond', fretCount: 12 });
    expect(d.model.markers).toEqual([]);
  });
});

describe('string-count change (012 US4: Q12, Q13)', () => {
  const on765 = setStringSet(initialTriadsView(AF_21), 7, AF_21);

  it('7→6 on 7-6-5 lands on 6-5-4 and reports an adjustment', () => {
    const next = revalidate(on765, STANDARD_GUITAR);
    expect(next.stringSet).toBe(6);
    expect(next).not.toBe(on765);
    expect(equalsTriadsView(next, on765)).toBe(false);
  });

  it('7→6 on any other set is not adjusted (same object)', () => {
    for (const set of [6, 5, 4, 3]) {
      const s = setStringSet(initialTriadsView(AF_21), set, AF_21);
      expect(revalidate(s, STANDARD_GUITAR)).toBe(s);
    }
  });

  it('6→7 never adjusts and keeps the set', () => {
    for (const set of [6, 5, 4, 3]) {
      const s = setStringSet(initialTriadsView(STANDARD_GUITAR), set, STANDARD_GUITAR);
      expect(revalidate(s, AF_21)).toBe(s);
    }
  });
});
