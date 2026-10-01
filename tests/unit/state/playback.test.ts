import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import type { Synth } from '../../../src/lib/audio/types';
import { FakeAudioPort, FakeClock } from '../audio/support/fake-audio';

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function deps() {
  const port = new FakeAudioPort();
  const rendered: number[] = [];
  const synth: Synth = {
    renderVoice(pitch, _sr, length) {
      rendered.push(pitch);
      return new Float32Array(length);
    },
    mixVoices: (v) => v[0]
  };
  const createContext = vi.fn(() => port);
  return {
    port,
    rendered,
    createContext,
    deps: { createContext, loadSynth: () => Promise.resolve(synth), clock: new FakeClock() }
  };
}

beforeEach(() => resetPlaybackForTests());

describe('playback state defaults', () => {
  it('starts idle, unmuted, volume 80, control state on, nothing pulsing', () => {
    expect(playback.availability).toBe('idle');
    expect(playback.muted).toBe(false);
    expect(playback.volume).toBe(80);
    expect(playback.controlState).toBe('on');
    expect(playback.sequencePlaying).toBe(false);
    expect(playback.pulses).toEqual([]);
    expect(playback.noticeVisible).toBe(false);
  });
});

describe('playback.note', () => {
  it('delegates to the injected engine and returns its marks', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    const marks = playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    expect(marks).toEqual([{ position: { string: 6, fret: 0 }, onsetMs: 0, endMs: 1500 }]);
    expect(d.rendered).toEqual([40]);
    expect(d.port.sources).toHaveLength(1);
  });

  it('marks availability on after the first successful gesture', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.note({ string: 5, fret: 3 }, STANDARD_GUITAR);
    expect(playback.availability).toBe('on');
    await flush();
    expect(d.rendered).toEqual([48]);
  });
});

describe('navigation helpers never touch the engine (FR-002)', () => {
  it('preload() creates no context', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    expect(d.createContext).not.toHaveBeenCalled();
    expect(playback.availability).toBe('idle');
  });
});
