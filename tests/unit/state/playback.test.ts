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

describe('playback pulses (US2)', () => {
  it('gains a pulse at the onset and loses it at the end mark', async () => {
    const d = deps();
    const clock = d.deps.clock;
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    clock.advance(0);
    expect(playback.pulses).toEqual([
      { id: 1, position: { string: 6, fret: 0 }, durationMs: 1500 }
    ]);
    clock.advance(1499);
    expect(playback.pulses).toHaveLength(1);
    clock.advance(1);
    expect(playback.pulses).toEqual([]);
  });

  it('still pulses when muted (US2-2)', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    playback.setMuted(true);
    expect(playback.muted).toBe(true);
    expect(playback.controlState).toBe('muted');
    playback.note({ string: 5, fret: 3 }, STANDARD_GUITAR);
    d.deps.clock.advance(0);
    expect(playback.pulses).toHaveLength(1);
    d.deps.clock.advance(1500);
    expect(playback.pulses).toEqual([]);
  });
});

describe('playback.setMuted / setVolume (US2)', () => {
  it('setMuted toggles muted and unlocks the engine', () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.setMuted(true);
    expect(d.createContext).toHaveBeenCalledTimes(1);
    playback.setMuted(false);
    expect(playback.muted).toBe(false);
    expect(playback.controlState).toBe('on');
  });

  it('setVolume clamps to 0–100, snaps to step 5, and unlocks the engine', () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.setVolume(63);
    expect(playback.volume).toBe(65);
    expect(d.createContext).toHaveBeenCalledTimes(1);
    playback.setVolume(500);
    expect(playback.volume).toBe(100);
    playback.setVolume(-20);
    expect(playback.volume).toBe(0);
    playback.setVolume(Number.NaN);
    expect(playback.volume).toBe(0);
  });
});
