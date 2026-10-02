import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotesTool from '../../../src/lib/tools/notes/NotesTool.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';

beforeEach(() => {
  resetPlaybackForTests();
  resetNotesForTests();
});

describe('notes store (US1)', () => {
  it('toggleNote stops playback with reason view exactly once when state changes', () => {
    const stop = vi.spyOn(playback, 'stop');
    notes.toggleNote(7);
    expect(notes.state.selection).toEqual([7]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith('view');
    notes.toggleNote(7);
    expect(notes.state.selection).toEqual([]);
    expect(stop).toHaveBeenCalledTimes(2);
    stop.mockRestore();
  });

  it('does not stop playback for an invalid (no-op) toggle', () => {
    const stop = vi.spyOn(playback, 'stop');
    notes.toggleNote(99);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });

  it('derives the display from the state', () => {
    expect(notes.display.highlightedCount).toBe(0);
    notes.toggleNote(7);
    expect(notes.display.highlightedCount).toBe(12);
  });

  it('keeps the selection across a remount of the tool (FR-019)', () => {
    const first = render(NotesTool);
    expect(screen.getByRole('button', { name: 'G' }).getAttribute('aria-pressed')).toBe('false');
    notes.toggleNote(7);
    first.unmount();
    render(NotesTool);
    expect(screen.getByRole('button', { name: 'G' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('notes store (US2)', () => {
  const s3f2 = { string: 3, fret: 2 };

  it('activate plays the note and opens the card without stopping for view', () => {
    const stop = vi.spyOn(playback, 'stop');
    const note = vi.spyOn(playback, 'note').mockImplementation(() => []);
    notes.activate(s3f2);
    expect(note).toHaveBeenCalledWith(s3f2, notes.instrument);
    expect(notes.state.card).toEqual(s3f2);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
    note.mockRestore();
  });

  it('activating the same position replays and keeps the card', () => {
    const note = vi.spyOn(playback, 'note').mockImplementation(() => []);
    notes.activate(s3f2);
    notes.activate({ ...s3f2 });
    expect(note).toHaveBeenCalledTimes(2);
    expect(notes.state.card).toEqual(s3f2);
    note.mockRestore();
  });

  it('closeCard does not stop playback', () => {
    const note = vi.spyOn(playback, 'note').mockImplementation(() => []);
    notes.activate(s3f2);
    const stop = vi.spyOn(playback, 'stop');
    notes.closeCard();
    expect(notes.state.card).toBeNull();
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
    note.mockRestore();
  });

  it('addNote stops for view only when the selection changes', () => {
    const stop = vi.spyOn(playback, 'stop');
    notes.addNote(9);
    expect(notes.state.selection).toEqual([9]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith('view');
    notes.addNote(9);
    expect(stop).toHaveBeenCalledTimes(1);
    stop.mockRestore();
  });
});

describe('notes store (US3)', () => {
  it('filter actions stop playback for view iff the state changed', () => {
    const stop = vi.spyOn(playback, 'stop');
    notes.toggleString(3);
    expect(notes.state.activeStrings).toEqual([1, 2, 4, 5, 6]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenLastCalledWith('view');
    notes.setRegionStart(5);
    expect(stop).toHaveBeenCalledTimes(2);
    notes.setRegionStart(5);
    expect(stop).toHaveBeenCalledTimes(2);
    notes.setRegionEnd(9);
    expect(notes.state.region).toEqual({ start: 5, end: 9 });
    expect(stop).toHaveBeenCalledTimes(3);
    notes.setRegionShortcut('0-4');
    expect(notes.state.region).toEqual({ start: 0, end: 4 });
    expect(stop).toHaveBeenCalledTimes(4);
    notes.setRegionShortcut('0-4');
    expect(stop).toHaveBeenCalledTimes(4);
    stop.mockRestore();
  });

  it('widenRegion stops for view only when something was missing', () => {
    const stop = vi.spyOn(playback, 'stop');
    notes.widenRegion();
    expect(stop).not.toHaveBeenCalled();
    notes.toggleNote(1);
    stop.mockClear();
    for (const n of [2, 3, 4, 5, 6]) notes.toggleString(n);
    notes.setRegionShortcut('0-4');
    stop.mockClear();
    notes.widenRegion();
    expect(notes.state.region).toEqual({ start: 0, end: 9 });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });

  it('removing the last active string does not stop playback', () => {
    for (const n of [2, 3, 4, 5, 6]) notes.toggleString(n);
    const stop = vi.spyOn(playback, 'stop');
    notes.toggleString(1);
    expect(notes.state.activeStrings).toEqual([1]);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });

  it('useInstrument revalidates and stops with reason instrument iff it changed', () => {
    const stop = vi.spyOn(playback, 'stop');
    notes.useInstrument(notes.instrument);
    expect(stop).not.toHaveBeenCalled();
    const twelve = { ...notes.instrument, fretCount: 12 };
    notes.setRegionStart(15);
    stop.mockClear();
    notes.useInstrument(twelve);
    expect(notes.instrument).toBe(twelve);
    expect(notes.state.region).toEqual({ start: 12, end: 12 });
    expect(stop).toHaveBeenCalledWith('instrument');
    expect(stop).toHaveBeenCalledTimes(1);
    stop.mockRestore();
  });
});

describe('notes store (US4)', () => {
  it('setLabelType stops playback with reason view iff changed', () => {
    const stop = vi.spyOn(playback, 'stop');
    notes.setLabelType('name');
    expect(stop).not.toHaveBeenCalled();
    notes.setLabelType('octave');
    expect(notes.state.labelType).toBe('octave');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });

  it('setBackground stops playback with reason view iff changed', () => {
    const stop = vi.spyOn(playback, 'stop');
    notes.setBackground('naturals');
    expect(stop).not.toHaveBeenCalled();
    notes.setBackground('none');
    expect(notes.state.background).toBe('none');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });
});

describe('notes store (US5)', () => {
  it('setHideNames, clear and reset stop playback (view) iff changed', () => {
    const stop = vi.spyOn(playback, 'stop');
    notes.setHideNames(false);
    notes.clear();
    notes.reset();
    expect(stop).not.toHaveBeenCalled();
    notes.setHideNames(true);
    expect(stop).toHaveBeenCalledTimes(1);
    notes.toggleNote(7);
    stop.mockClear();
    notes.clear();
    expect(notes.state.selection).toEqual([]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith('view');
    notes.setLabelType('octave');
    stop.mockClear();
    notes.reset();
    expect(notes.state.labelType).toBe('name');
    expect(notes.state.hideNames).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });

  it('Clear and Reset close the card', () => {
    notes.activate({ string: 3, fret: 2 });
    notes.clear();
    expect(notes.state.card).toBeNull();
    notes.activate({ string: 3, fret: 2 });
    notes.reset();
    expect(notes.state.card).toBeNull();
  });

  it('listen plays the sequence at 120 bpm only when enabled and never stops', () => {
    const seq = vi.spyOn(playback, 'sequence').mockReturnValue([]);
    const stop = vi.spyOn(playback, 'stop');
    notes.listen();
    expect(seq).not.toHaveBeenCalled();
    notes.toggleNote(9);
    stop.mockClear();
    notes.listen();
    expect(seq).toHaveBeenCalledTimes(1);
    expect(seq).toHaveBeenCalledWith(notes.display.listenSteps, 120, notes.instrument);
    expect(stop).not.toHaveBeenCalled();
    seq.mockRestore();
    stop.mockRestore();
  });
});
