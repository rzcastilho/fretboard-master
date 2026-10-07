import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { buildNotesModel } from '../../../src/lib/state/notes-model';
import {
  initialNotesView,
  setHideNames,
  toggleNote,
  type NotesViewState
} from '../../../src/lib/state/notes-view';

const INIT = initialNotesView(STANDARD_GUITAR);
const select = (...pcs: number[]): NotesViewState => pcs.reduce(toggleNote, INIT);
const build = (s: NotesViewState) => buildNotesModel(s, STANDARD_GUITAR);

describe('NotesDisplay.detected', () => {
  it('is null for 0, 1, 2 and 4 notes and for non-triads', () => {
    for (const pcs of [[], [0], [0, 4], [0, 4, 7, 11], [0, 2, 4]]) {
      expect(build(select(...pcs)).detected).toBeNull();
    }
  });

  it('detects C major from C, E, G', () => {
    const d = build(select(0, 4, 7)).detected;
    expect(d).toMatchObject({
      rootPc: 0,
      quality: 'major',
      name: 'C major',
      spokenName: 'C major'
    });
  });

  it('names C♯ major with a sharp glyph and spoken "sharp"', () => {
    const d = build(select(1, 5, 8)).detected;
    expect(d).toMatchObject({
      rootPc: 1,
      quality: 'major',
      name: 'C♯ major',
      spokenName: 'C sharp major'
    });
  });

  it('uses the first-selected note as the augmented root', () => {
    expect(build(select(8, 0, 4)).detected).toMatchObject({
      rootPc: 8,
      quality: 'augmented',
      name: 'G♯ augmented'
    });
    expect(build(select(4, 8, 0)).detected).toMatchObject({ rootPc: 4, name: 'E augmented' });
  });

  it('is independent of hide names', () => {
    expect(build(setHideNames(select(0, 4, 7), true)).detected).not.toBeNull();
  });

  it('adds the triad sentence to the description only when detected', () => {
    expect(build(select(1, 5, 8)).model.description).toContain(
      'The selected notes form C sharp major.'
    );
    expect(build(select(0, 2, 4)).model.description).not.toContain('The selected notes form');
    expect(build(select(0, 4)).model.description).not.toContain('The selected notes form');
  });
});

describe('Notes description (US1, FR-007)', () => {
  it('empty selection with no background says to pick a note', async () => {
    const { describeView } = await import('../../../src/lib/fretboard/description');
    const s = { ...INIT, background: 'none' as const, selection: [] };
    const d = build(s);
    expect(d.model.description).toBe('No notes selected. Pick a note in the note selector.');
    expect(describeView(STANDARD_GUITAR, { ...d.model, description: undefined })).not.toBe('');
  });

  it('selection with a string filter states both and lists positions without function', () => {
    const s = { ...select(0), activeStrings: [1, 2] };
    const text = build(s).model.description as string;
    expect(text).toContain('C selected');
    expect(text).toContain('strings 1 to 2');
    expect(text).toMatch(/string 2, fret 1, C/);
    expect(text).not.toMatch(/root|third|fifth/);
  });
});
