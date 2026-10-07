import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import {
  initialTriadsView,
  motionKind,
  type MotionContext,
  type TriadsViewState
} from '../../../src/lib/state/triads-view';

const base = initialTriadsView(STANDARD_GUITAR);
const calm: MotionContext = { instrumentChanged: false, presentationChanged: false };
const kind = (next: Partial<TriadsViewState>, ctx: Partial<MotionContext> = {}) =>
  motionKind(base, { ...base, ...next }, { ...calm, ...ctx });

describe('Triads motionKind', () => {
  it('root → slide', () => expect(kind({ rootPc: 2 })).toBe('slide'));
  it('quality only → by-role', () => expect(kind({ quality: 'minor' })).toBe('by-role'));
  it('comparison on → by-role', () =>
    expect(kind({ compare: { on: true, quality: 'minor' } })).toBe('by-role'));
  it('comparison off → by-role', () => {
    const on = { ...base, compare: { on: true, quality: 'minor' as const } };
    expect(motionKind(on, { ...on, compare: { on: false, quality: 'minor' } }, calm)).toBe(
      'by-role'
    );
  });
  it('inversion → cross-fade', () => expect(kind({ inversion: 'first' })).toBe('cross-fade'));
  it('string set → cross-fade', () => expect(kind({ stringSet: 4 })).toBe('cross-fade'));
  it('first view → none', () => expect(motionKind(null, base, calm)).toBe('none'));
  it('root and quality together (a link) → none', () =>
    expect(kind({ rootPc: 2, quality: 'minor' })).toBe('none'));
  it('instrument change wins', () =>
    expect(kind({ rootPc: 2 }, { instrumentChanged: true })).toBe('none'));
  it('presentation change wins', () =>
    expect(kind({ rootPc: 2 }, { presentationChanged: true })).toBe('none'));
  it('earliest row wins: root beats inversion, quality beats inversion', () => {
    expect(kind({ rootPc: 2, inversion: 'first' })).toBe('slide');
    expect(kind({ quality: 'minor', inversion: 'first' })).toBe('by-role');
  });
  it('anything else → none', () => {
    expect(kind({ view: 'full-neck' })).toBe('none');
    expect(kind({ occurrence: 1 })).toBe('none');
    expect(kind({ labelType: 'name' })).toBe('none');
    expect(kind({})).toBe('none');
  });
});
