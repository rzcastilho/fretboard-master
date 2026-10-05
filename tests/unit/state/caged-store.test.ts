import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AF_1_12, AF_8 } from '../../../src/lib/instrument/fixtures';
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
    expect(caged.applyInstrument(AF_1_12, 'Standard')).toBe(false);
    expect(caged.state).toBe(before);
    expect(caged.instrument).toBe(AF_1_12);
    expect(caged.display.fitNote).toBe('With 12 frets, 4 shapes fit on the fretboard');
  });

  it('redraws for handedness and orientation changes', () => {
    const base = caged.display.model;
    caged.applyInstrument(withPresentation(STANDARD_GUITAR, 'left', 'lowest-top'), 'Standard');
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

describe('caged store: tuning name (slice 015)', () => {
  it('applyInstrument stores preferred and tuningName, keeps the view, returns false', () => {
    caged.selectRoot(3);
    const before = caged.state;
    expect(caged.applyInstrument(AF_1_12, 'Standard')).toBe(false);
    expect(caged.state).toBe(before);
    expect(caged.instrument).toBe(AF_1_12);
    expect(caged.display.tuningName).toBe('Standard');
    expect(caged.applyInstrument(AF_1_12, 'Drop D')).toBe(false);
    expect(caged.display.tuningName).toBe('Drop D');
  });

  it('useInstrument(next, tuningName) applies the name', () => {
    caged.useInstrument(AF_1_12, 'Half step down');
    expect(caged.instrument).toBe(AF_1_12);
    expect(caged.display.tuningName).toBe('Half step down');
  });

  it('resetCagedForTests(next, tuningName) sets both', () => {
    resetCagedForTests(AF_1_12, 'Custom');
    expect(caged.instrument).toBe(AF_1_12);
    expect(caged.display.tuningName).toBe('Custom');
  });
});

describe('caged store: temporary standard view (slice 015 US1)', () => {
  const openG = () => resetCagedForTests(AF_8, 'Open G');

  it('viewInStandard is a no-op unless the class is non-compatible', () => {
    const stop = vi.spyOn(playback, 'stop');
    caged.viewInStandard();
    expect(caged.temporary).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });

  it('viewInStandard keeps the view, goes compatible and stops playback once', () => {
    openG();
    caged.selectRoot(7);
    caged.setQuality('minor');
    const before = caged.state;
    expect(caged.display.tuningClass).toBe('non-compatible');
    const stop = vi.spyOn(playback, 'stop');
    caged.viewInStandard();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith('instrument');
    expect(caged.state).toBe(before);
    expect(caged.temporary).toBe(true);
    expect(caged.display.tuningClass).toBe('compatible');
    expect(caged.display.temporaryName).toBe('Standard');
    expect(caged.instrument.openStrings).toEqual(STANDARD_GUITAR.openStrings);
    caged.viewInStandard();
    expect(stop).toHaveBeenCalledTimes(1);
    stop.mockRestore();
  });

  it('key, quality, spelling and reset keep temporary', () => {
    openG();
    caged.viewInStandard();
    caged.selectRoot(1);
    expect(caged.temporary).toBe(true);
    caged.switchSpelling();
    expect(caged.temporary).toBe(true);
    caged.setQuality('minor');
    expect(caged.temporary).toBe(true);
    caged.reset();
    expect(caged.temporary).toBe(true);
  });

  it('screenChanged and endTemporary clear it', () => {
    openG();
    caged.viewInStandard();
    caged.screenChanged();
    expect(caged.temporary).toBe(false);
    expect(caged.display.tuningClass).toBe('non-compatible');
    caged.viewInStandard();
    caged.endTemporary();
    expect(caged.temporary).toBe(false);
    expect(caged.display.temporaryName).toBeNull();
  });

  it('activate plays on the standard instrument while temporary', () => {
    openG();
    caged.viewInStandard();
    const note = vi.spyOn(playback, 'note').mockImplementation(() => undefined as never);
    caged.activate({ string: 5, fret: 3 });
    expect(note).toHaveBeenCalledWith({ string: 5, fret: 3 }, caged.instrument);
    expect(caged.instrument).not.toBe(AF_8);
    note.mockRestore();
  });
});
