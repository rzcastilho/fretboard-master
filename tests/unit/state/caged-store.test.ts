import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AF_1_12 } from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR, withPresentation } from '../../../src/lib/instrument/instrument';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';

beforeEach(() => {
  resetPlaybackForTests();
  resetCagedForTests();
});

describe('caged store (US1)', () => {
  it('starts on C major with a display for the instrument', () => {
    expect(caged.state).toEqual({ rootPc: 0, spellingOverride: 'none', quality: 'major' });
    expect(caged.instrument).toBe(STANDARD_GUITAR);
    expect(caged.display.keyName).toBe('C major');
    expect(caged.display.model?.tags).toHaveLength(9);
  });

  it('activate plays the note and leaves state unchanged', () => {
    const note = vi.spyOn(playback, 'note').mockImplementation(() => undefined as never);
    const before = caged.state;
    caged.activate({ string: 5, fret: 3 });
    expect(note).toHaveBeenCalledWith({ string: 5, fret: 3 }, STANDARD_GUITAR);
    expect(caged.state).toBe(before);
    note.mockRestore();
  });
});

describe('caged store: instrument changes (US4)', () => {
  it('keeps key, quality and override; recomputes display; returns false', () => {
    caged.selectRoot(1);
    caged.setQuality('minor');
    const before = caged.state;
    expect(caged.applyInstrument(AF_1_12)).toBe(false);
    expect(caged.state).toBe(before);
    expect(caged.instrument).toBe(AF_1_12);
    expect(caged.display.fitNote).toBe('With 12 frets, 4 shapes fit on the fretboard');
  });

  it('redraws for handedness and orientation changes', () => {
    const base = caged.display.model;
    caged.applyInstrument(withPresentation(STANDARD_GUITAR, 'left', 'lowest-top'));
    expect(caged.display.model).toEqual(base);
    expect(caged.instrument.handedness).toBe('left');
    expect(caged.instrument.orientation).toBe('lowest-top');
  });
});

describe('caged store: session and reset (US6)', () => {
  it('reset gives C major with no override and keeps the instrument', () => {
    caged.useInstrument(AF_1_12);
    caged.selectRoot(10);
    caged.switchSpelling();
    caged.setQuality('minor');
    caged.reset();
    expect(caged.state).toEqual({ rootPc: 0, spellingOverride: 'none', quality: 'major' });
    expect(caged.instrument).toBe(AF_1_12);
  });

  it('a view change stops playback with reason view; a no-op does not', () => {
    const stop = vi.spyOn(playback, 'stop');
    caged.setQuality('major');
    expect(stop).not.toHaveBeenCalled();
    caged.selectRoot(7);
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });
});
