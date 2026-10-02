import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import {
  NOTES_PRIMARY_CHOICE,
  carryFromDetected,
  carryFromNotes,
  carryFromTriads,
  carryRoot,
  carrySelection,
  carryTriad
} from '../../../src/lib/state/links';
import { initialNotesView } from '../../../src/lib/state/notes-view';
import { effectiveRootSpelling } from '../../../src/lib/theory/triad';
import { initialTriadsView, type TriadsViewState } from '../../../src/lib/state/triads-view';

const I = STANDARD_GUITAR;
const notes = (selection: number[]) => ({ ...initialNotesView(I), selection });
const triads = (p: Partial<TriadsViewState> = {}): TriadsViewState => ({
  ...initialTriadsView(I),
  ...p
});

describe('links (pure)', () => {
  it('NOTES_PRIMARY_CHOICE is sharp', () => {
    expect(NOTES_PRIMARY_CHOICE).toBe('sharp');
  });

  it('L1 carryRoot sets root, resets override and occurrence, keeps the rest', () => {
    const t = triads({ quality: 'minor', inversion: 'first', stringSet: 4, occurrence: 1 });
    expect(carryRoot(t, 9)).toEqual({
      ...t,
      rootPc: 9,
      spellingOverride: 'none',
      occurrence: 0
    });
  });

  it('L2 augmented G♯ carry shows A♭', () => {
    const next = carryRoot(triads({ quality: 'augmented' }), 8);
    expect(next.spellingOverride).toBe('none');
    expect(effectiveRootSpelling(8, next.spellingOverride, 'augmented')).toEqual({
      letter: 'A',
      accidental: -1
    });
  });

  it('L3 same root returns the same object; invalid pc too', () => {
    const t = triads({ rootPc: 1, spellingOverride: 'flat' });
    expect(Object.is(carryRoot(t, 1), t)).toBe(true);
    expect(Object.is(carryRoot(t, 12), t)).toBe(true);
    expect(Object.is(carryRoot(t, 1.5), t)).toBe(true);
  });

  it('L4 carryFromNotes is null unless exactly one note', () => {
    expect(carryFromNotes(notes([]))).toBeNull();
    expect(carryFromNotes(notes([0, 4]))).toBeNull();
    expect(carryFromNotes(notes([0, 4, 7]))).toBeNull();
    expect(carryFromNotes(notes([9]))).toEqual({ kind: 'root', rootPc: 9 });
  });

  it('L5 carryFromTriads gives the main triad and ignores compare', () => {
    const t = triads({
      rootPc: 4,
      quality: 'augmented',
      compare: { on: true, quality: 'minor' }
    });
    expect(carryFromTriads(t)).toEqual({ kind: 'notes', selection: [4, 8, 0] });
    expect(carryFromTriads(triads())).toEqual({ kind: 'notes', selection: [0, 4, 7] });
  });

  it('L6 carrySelection changes only selection', () => {
    const n = {
      ...notes([5]),
      labelType: 'octave' as const,
      background: 'all' as const,
      hideNames: true,
      activeStrings: [1, 2],
      region: { start: 2, end: 7 },
      card: { string: 1, fret: 3 }
    };
    expect(carrySelection(n, [0, 4, 7])).toEqual({ ...n, selection: [0, 4, 7] });
    expect(Object.is(carrySelection(n, [5]), n)).toBe(true);
  });

  it('L7 altered root detected → sharp spelling', () => {
    expect(carryFromDetected({ rootPc: 1, quality: 'major' })).toEqual({
      kind: 'triad',
      rootPc: 1,
      quality: 'major',
      spelling: 'sharp'
    });
  });

  it('L8 natural root detected → none', () => {
    expect(carryFromDetected({ rootPc: 0, quality: 'major' })).toEqual({
      kind: 'triad',
      rootPc: 0,
      quality: 'major',
      spelling: 'none'
    });
  });

  it('L9 carryTriad swaps with compare quality', () => {
    const t = triads({ compare: { on: true, quality: 'minor' } });
    const next = carryTriad(t, 0, 'minor', 'none', I);
    expect(next.quality).toBe('minor');
    expect(next.compare).toEqual({ on: true, quality: 'major' });
  });

  it('L10 carryTriad with nothing changed returns same object', () => {
    const t = triads();
    expect(Object.is(carryTriad(t, 0, 'major', 'none', I), t)).toBe(true);
  });

  it('L11 carryTriad keeps inversion, stringSet, view, labelType and compare.on', () => {
    const t = triads({
      inversion: 'second',
      stringSet: 4,
      view: 'full-neck',
      labelType: 'name',
      compare: { on: true, quality: 'diminished' }
    });
    const next = carryTriad(t, 8, 'augmented', 'sharp', I);
    expect(next).toMatchObject({
      rootPc: 8,
      spellingOverride: 'sharp',
      quality: 'augmented',
      inversion: 'second',
      stringSet: 4,
      view: 'full-neck',
      labelType: 'name'
    });
    expect(next.compare.on).toBe(true);
    expect(next.occurrence).toBe(0);
  });
});
