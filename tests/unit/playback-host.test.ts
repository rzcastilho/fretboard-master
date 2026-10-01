import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Synth } from '../../src/lib/audio/types';
import PlaybackHost from '../../src/lib/shell/PlaybackHost.svelte';
import { playback, resetPlaybackForTests } from '../../src/lib/state/playback.svelte';
import { FakeAudioPort, FakeClock } from './audio/support/fake-audio';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PlaybackHost preload', () => {
  function inject() {
    const createContext = vi.fn(() => new FakeAudioPort());
    const loadSynth = vi.fn(() =>
      Promise.resolve({ renderVoice: () => new Float32Array(0), mixVoices: (v) => v[0] } as Synth)
    );
    resetPlaybackForTests({ createContext, loadSynth, clock: new FakeClock() });
    return { createContext, loadSynth };
  }

  it('schedules preload idle after mount (setTimeout fallback) and creates no context', async () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    const { createContext, loadSynth } = inject();
    render(PlaybackHost);
    expect(loadSynth).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5);
    expect(loadSynth).toHaveBeenCalledTimes(1);
    expect(createContext).not.toHaveBeenCalled();
  });

  it('prefers requestIdleCallback when available', async () => {
    const callbacks: (() => void)[] = [];
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => callbacks.push(cb));
    const { createContext, loadSynth } = inject();
    render(PlaybackHost);
    await vi.advanceTimersByTimeAsync(50);
    expect(loadSynth).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);
    callbacks[0]();
    expect(loadSynth).toHaveBeenCalledTimes(1);
    expect(createContext).not.toHaveBeenCalled();
  });
});

describe('PlaybackHost interruption (US4-3, FR-013)', () => {
  beforeEach(() => resetPlaybackForTests());

  const setVisibility = (state: 'hidden' | 'visible') => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('visibilitychange to hidden calls playback.stop("hidden"); visible does nothing', () => {
    const stop = vi.spyOn(playback, 'stop');
    const note = vi.spyOn(playback, 'note');
    render(PlaybackHost);
    setVisibility('hidden');
    expect(stop).toHaveBeenCalledWith('hidden');
    stop.mockClear();
    setVisibility('visible');
    expect(stop).not.toHaveBeenCalled();
    expect(note).not.toHaveBeenCalled();
  });

  it('pagehide calls playback.stop("hidden")', () => {
    const stop = vi.spyOn(playback, 'stop');
    render(PlaybackHost);
    window.dispatchEvent(new Event('pagehide'));
    expect(stop).toHaveBeenCalledWith('hidden');
  });

  it('removes its listeners on destroy', () => {
    const stop = vi.spyOn(playback, 'stop');
    const { unmount } = render(PlaybackHost);
    unmount();
    window.dispatchEvent(new Event('pagehide'));
    setVisibility('hidden');
    expect(stop).not.toHaveBeenCalled();
  });
});
