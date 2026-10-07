import { describe, expect, it } from 'vitest';
import { CHORD_ONLY, revealOrder } from '../../../src/lib/state/caged-layers';
import {
  initialCagedView,
  motionKind,
  type CagedViewState
} from '../../../src/lib/state/caged-view';
import type { MotionContext } from '../../../src/lib/state/triads-view';

const calm: MotionContext = { instrumentChanged: false, presentationChanged: false };
const base = initialCagedView();
const kind = (next: Partial<CagedViewState>, ctx: Partial<MotionContext> = {}) =>
  motionKind(base, { ...base, ...next }, { ...calm, ...ctx });

describe('CAGED motionKind', () => {
  it('key → slide', () => expect(kind({ rootPc: 7 })).toBe('slide'));
  it('focus set, changed, cleared → focus', () => {
    const f = { letter: 'C', ordinal: 0 } as const;
    const g = { letter: 'A', ordinal: 0 } as const;
    expect(kind({ focus: f })).toBe('focus');
    expect(motionKind({ ...base, focus: f }, { ...base, focus: g }, calm)).toBe('focus');
    expect(motionKind({ ...base, focus: f }, base, calm)).toBe('focus');
  });
  it('layer on/off → reveal', () => {
    const on = { ...CHORD_ONLY, arpeggio: true };
    expect(kind({ layers: on })).toBe('reveal');
    expect(motionKind({ ...base, layers: on }, base, calm)).toBe('reveal');
  });
  it('a layer switch that also sets the focus → reveal', () => {
    const f = { letter: 'C', ordinal: 0 } as const;
    expect(kind({ focus: f, layers: { ...CHORD_ONLY, pentatonic: true } })).toBe('reveal');
  });
  it('anything else, first view, instrument, presentation → none', () => {
    expect(kind({ connections: true })).toBe('none');
    expect(kind({ rootPc: 7, quality: 'minor' })).toBe('none');
    expect(motionKind(null, base, calm)).toBe('none');
    expect(kind({ rootPc: 7 }, { instrumentChanged: true })).toBe('none');
    expect(kind({ rootPc: 7 }, { presentationChanged: true })).toBe('none');
  });
});

describe('CAGED reveal order (pins `appear`)', () => {
  const at = (string: number, fret: number, pitch: number) => ({ string, fret, pitch }) as never;
  it('is ascending pitch, ties from the lowest-pitched string', () => {
    // Standard tuning: a higher string number is a lower pitch. Two notes share pitch 60.
    const next = [at(1, 5, 69), at(2, 1, 60), at(4, 10, 60), at(6, 3, 43)];
    expect(revealOrder([], next)).toEqual(['6:3', '4:10', '2:1', '1:5']);
  });
  it('skips notes already drawn', () => {
    const prev = [at(6, 3, 43)];
    expect(revealOrder(prev, [...prev, at(4, 10, 60)])).toEqual(['4:10']);
  });
});
