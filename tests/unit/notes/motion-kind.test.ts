import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import {
  initialNotesView,
  motionKind,
  type NotesViewState
} from '../../../src/lib/state/notes-view';
import type { MotionContext } from '../../../src/lib/state/triads-view';

const calm: MotionContext = { instrumentChanged: false, presentationChanged: false };
const base = { ...initialNotesView(STANDARD_GUITAR), selection: [0] };
const kind = (next: Partial<NotesViewState>, ctx: Partial<MotionContext> = {}) =>
  motionKind(base, { ...base, ...next }, { ...calm, ...ctx });

describe('Notes motionKind', () => {
  it('selected note replaced by another → slide', () =>
    expect(kind({ selection: [4] })).toBe('slide'));
  it('first view → none', () => expect(motionKind(null, base, calm)).toBe('none'));
  it('adding, removing or clearing notes → slide', () => {
    expect(kind({ selection: [0, 4] })).toBe('slide');
    expect(kind({ selection: [] })).toBe('slide');
    expect(motionKind({ ...base, selection: [] }, base, calm)).toBe('slide');
  });
  it('the same selection → none', () => expect(kind({ selection: [0] })).toBe('none'));
  it('filters, card, labels → none', () => {
    expect(kind({ background: 'all' })).toBe('none');
    expect(kind({ activeStrings: [1, 2] })).toBe('none');
    expect(kind({ selection: [4], background: 'all' })).toBe('none');
    expect(kind({ card: { string: 1, fret: 0 } })).toBe('none');
  });
  it('instrument or presentation change → none', () => {
    expect(kind({ selection: [4] }, { instrumentChanged: true })).toBe('none');
    expect(kind({ selection: [4] }, { presentationChanged: true })).toBe('none');
  });
});
