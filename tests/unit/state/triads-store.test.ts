import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AF_4, NC_UNISON } from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { LISTEN_BPM } from '../../../src/lib/state/listen';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';

beforeEach(() => {
  resetPlaybackForTests();
  resetTriadsForTests();
});

describe('triads store (US7)', () => {
  it('listen() sends one sequence at LISTEN_BPM with the four steps', () => {
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.listen();
    expect(seq).toHaveBeenCalledTimes(1);
    expect(seq).toHaveBeenCalledWith(triads.display.listenSteps, LISTEN_BPM, STANDARD_GUITAR);
    expect(triads.display.listenSteps).toHaveLength(4);
    seq.mockRestore();
  });

  it('listen() is a no-op when disabled', () => {
    triads.useInstrument(NC_UNISON);
    expect(triads.display.listen.enabled).toBe(false);
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.listen();
    expect(seq).not.toHaveBeenCalled();
    seq.mockRestore();
  });

  it('a second listen() restarts without calling stop', () => {
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    const stop = vi.spyOn(playback, 'stop');
    triads.listen();
    triads.listen();
    expect(seq).toHaveBeenCalledTimes(2);
    expect(stop).not.toHaveBeenCalled();
    seq.mockRestore();
    stop.mockRestore();
  });

  it('every state-changing action stops playback with reason view', () => {
    const stop = vi.spyOn(playback, 'stop');
    const actions: (() => void)[] = [
      () => triads.selectRoot(7),
      () => triads.setQuality('minor'),
      () => triads.setInversion('first'),
      () => triads.setStringSet(4),
      () => triads.setLabelType('name'),
      () => triads.octaveUp()
    ];
    for (const act of actions) {
      stop.mockClear();
      act();
      expect(stop).toHaveBeenCalledWith('view');
    }
    stop.mockRestore();
  });

  it('useInstrument stops with reason instrument', () => {
    const stop = vi.spyOn(playback, 'stop');
    triads.useInstrument(AF_4);
    expect(stop).toHaveBeenCalledWith('instrument');
    stop.mockRestore();
  });

  it('activate plays a note and changes no state', () => {
    const note = vi.spyOn(playback, 'note').mockImplementation(() => []);
    const stop = vi.spyOn(playback, 'stop');
    const before = triads.state;
    triads.activate({ string: 3, fret: 5 });
    expect(note).toHaveBeenCalledWith({ string: 3, fret: 5 }, STANDARD_GUITAR);
    expect(triads.state).toBe(before);
    expect(stop).not.toHaveBeenCalled();
    note.mockRestore();
    stop.mockRestore();
  });
});

describe('triads store (US8)', () => {
  it('anotherSet() selects the nearest closing set and stops playback', () => {
    triads.useInstrument(NC_UNISON);
    expect(triads.display.anotherSet).toBe(5);
    const stop = vi.spyOn(playback, 'stop');
    triads.anotherSet();
    expect(triads.state.stringSet).toBe(5);
    expect(triads.display.shape.kind).toBe('shown');
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });

  it('anotherSet() is a no-op when no set is offered', () => {
    const stop = vi.spyOn(playback, 'stop');
    const before = triads.state;
    triads.anotherSet();
    expect(triads.state).toBe(before);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });
});
