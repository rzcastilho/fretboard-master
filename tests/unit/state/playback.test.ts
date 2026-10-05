import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { presetInstrument } from '../../../src/lib/instrument/tunings';
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

describe('playback.note on string 7 (012 FR-014, R-12)', () => {
  it.each([
    ['AF-21', 35],
    ['AF-23', 33]
  ] as const)('open string 7 in %s requests MIDI pitch %i', async (id, midi) => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.note({ string: 7, fret: 0 }, presetInstrument(id, 7, 22));
    await flush();
    expect(d.rendered).toEqual([midi]);
  });

  it('string 7 fret 12 in AF-23 sounds an octave above the open string', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.note({ string: 7, fret: 12 }, presetInstrument('AF-23', 7, 22));
    await flush();
    expect(d.rendered).toEqual([45]);
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

describe('sound control state (US3)', () => {
  it('muting keeps volume; unmuting restores it', () => {
    resetPlaybackForTests(deps().deps);
    playback.setVolume(60);
    playback.setMuted(true);
    expect(playback.volume).toBe(60);
    expect(playback.muted).toBe(true);
    playback.setMuted(false);
    expect(playback.volume).toBe(60);
    expect(playback.muted).toBe(false);
  });

  it('snaps volume to steps of 5 and clamps to 0–100', () => {
    resetPlaybackForTests(deps().deps);
    playback.setVolume(43);
    expect(playback.volume).toBe(45);
    playback.setVolume(250);
    expect(playback.volume).toBe(100);
    playback.setVolume(-8);
    expect(playback.volume).toBe(0);
  });

  it('volume 0 does not set muted', () => {
    resetPlaybackForTests(deps().deps);
    playback.setVolume(0);
    expect(playback.volume).toBe(0);
    expect(playback.muted).toBe(false);
    expect(playback.controlState).toBe('on');
  });

  it('maps controlState on / muted', () => {
    resetPlaybackForTests(deps().deps);
    expect(playback.controlState).toBe('on');
    playback.setMuted(true);
    expect(playback.controlState).toBe('muted');
  });

  it('setMuted and setVolume unlock the engine', () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.setMuted(true);
    expect(d.createContext).toHaveBeenCalledTimes(1);
    expect(playback.availability).toBe('on');
    const e = deps();
    resetPlaybackForTests(e.deps);
    playback.setVolume(30);
    expect(e.createContext).toHaveBeenCalledTimes(1);
  });
});

describe('playback.stop and interruption (US4)', () => {
  it('stop() clears pulses and sequencePlaying', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    d.deps.clock.advance(0);
    expect(playback.pulses).toHaveLength(1);
    playback.stop();
    expect(playback.pulses).toEqual([]);
    expect(playback.sequencePlaying).toBe(false);
    d.deps.clock.advance(2000);
    expect(playback.pulses).toEqual([]);
  });

  it('a new request replaces the prior pulse', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    d.deps.clock.advance(0);
    playback.note({ string: 5, fret: 3 }, STANDARD_GUITAR);
    d.deps.clock.advance(0);
    expect(playback.pulses.map((p) => p.position)).toEqual([{ string: 5, fret: 3 }]);
  });

  it('stop() with nothing active is harmless', () => {
    expect(() => playback.stop('hidden')).not.toThrow();
    expect(playback.pulses).toEqual([]);
  });

  it('sequencePlaying is true from sequence start until the last endMs, stop, or interruption', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    const steps = [
      { string: 6, fret: 0 },
      { string: 5, fret: 0 }
    ];
    playback.sequence(steps, 60, STANDARD_GUITAR);
    expect(playback.sequencePlaying).toBe(true);
    d.deps.clock.advance(1999);
    expect(playback.sequencePlaying).toBe(true);
    d.deps.clock.advance(1);
    expect(playback.sequencePlaying).toBe(false);

    playback.sequence(steps, 60, STANDARD_GUITAR);
    expect(playback.sequencePlaying).toBe(true);
    playback.stop();
    expect(playback.sequencePlaying).toBe(false);

    playback.sequence(steps, 60, STANDARD_GUITAR);
    playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    expect(playback.sequencePlaying).toBe(false);
  });
});

describe('playback availability and the one-time notice (US5)', () => {
  const failing = (kind: 'context' | 'synth') => {
    const port = new FakeAudioPort();
    const clock = new FakeClock();
    const synth: Synth = {
      renderVoice: (_p, _s, n) => new Float32Array(n),
      mixVoices: (v) => v[0]
    };
    return {
      clock,
      deps: {
        createContext: () => {
          if (kind === 'context') throw new Error('no audio');
          return port;
        },
        loadSynth: () =>
          kind === 'synth' ? Promise.reject(new Error('x')) : Promise.resolve(synth),
        clock
      }
    };
  };

  it('idle → on after a working gesture; stays on', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    expect(playback.availability).toBe('idle');
    playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    await flush();
    expect(playback.availability).toBe('on');
    expect(playback.noticeVisible).toBe(false);
  });

  it('a context failure is terminal: unavailable, one notice, control unavailable, pulses continue', () => {
    const f = failing('context');
    resetPlaybackForTests(f.deps);
    playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    expect(playback.availability).toBe('unavailable');
    expect(playback.controlState).toBe('unavailable');
    expect(playback.noticeVisible).toBe(true);
    f.clock.advance(0);
    expect(playback.pulses).toHaveLength(1);
    f.clock.advance(1500);
    playback.note({ string: 5, fret: 3 }, STANDARD_GUITAR);
    f.clock.advance(0);
    expect(playback.availability).toBe('unavailable');
    expect(playback.pulses).toHaveLength(1);
  });

  it('a synth failure after the first gesture is unavailable too', async () => {
    const f = failing('synth');
    resetPlaybackForTests(f.deps);
    playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    await flush();
    expect(playback.availability).toBe('unavailable');
    expect(playback.noticeVisible).toBe(true);
  });

  it('dismiss hides the notice for good; it never returns', () => {
    const f = failing('context');
    resetPlaybackForTests(f.deps);
    playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    playback.dismissNotice();
    expect(playback.noticeVisible).toBe(false);
    playback.note({ string: 5, fret: 3 }, STANDARD_GUITAR);
    playback.setMuted(true);
    expect(playback.noticeVisible).toBe(false);
    expect(playback.controlState).toBe('unavailable');
  });

  it('setMuted/setVolume do not leave unavailable', () => {
    const f = failing('context');
    resetPlaybackForTests(f.deps);
    playback.note({ string: 6, fret: 0 }, STANDARD_GUITAR);
    playback.setVolume(40);
    expect(playback.availability).toBe('unavailable');
  });
});

describe('playback.chord and playback.sequence (US6)', () => {
  const pos = (string: number, fret: number) => ({ string, fret });

  it('chord returns shared-onset marks and its pulses start together', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    const marks = playback.chord([pos(6, 0), pos(5, 2), pos(4, 2)], STANDARD_GUITAR);
    expect(marks).toEqual([
      { position: pos(6, 0), onsetMs: 0, endMs: 1500 },
      { position: pos(5, 2), onsetMs: 0, endMs: 1500 },
      { position: pos(4, 2), onsetMs: 0, endMs: 1500 }
    ]);
    d.deps.clock.advance(0);
    expect(playback.pulses).toHaveLength(3);
    d.deps.clock.advance(1500);
    expect(playback.pulses).toEqual([]);
  });

  it('sequence returns step marks; pulses follow onsets and ends', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    const marks = playback.sequence([pos(6, 0), pos(5, 0)], 120, STANDARD_GUITAR);
    expect(marks).toEqual([
      { position: pos(6, 0), onsetMs: 0, endMs: 500 },
      { position: pos(5, 0), onsetMs: 500, endMs: 1000 }
    ]);
    d.deps.clock.advance(0);
    expect(playback.pulses.map((x) => x.position)).toEqual([pos(6, 0)]);
    d.deps.clock.advance(500);
    expect(playback.pulses.map((x) => x.position)).toEqual([pos(5, 0)]);
    d.deps.clock.advance(500);
    expect(playback.pulses).toEqual([]);
  });
});

describe('playback.restore (010)', () => {
  it('sets muted and volume without unlocking or creating a context', () => {
    const t = deps();
    resetPlaybackForTests(t.deps);
    playback.restore({ muted: true, volume: 35 });
    expect(playback.muted).toBe(true);
    expect(playback.volume).toBe(35);
    expect(playback.availability).toBe('idle');
    expect(playback.controlState).toBe('muted');
    expect(t.createContext).not.toHaveBeenCalled();
  });
});

describe('playback.timeline (019)', () => {
  const events = [
    { positions: [{ string: 6, fret: 0 }], onsetMs: 0, durationMs: 1500 },
    { positions: [{ string: 5, fret: 0 }], onsetMs: 250, durationMs: 1500 }
  ];

  it('is gesture-only like sequence: marks unlocked, returns marks, sets sequencePlaying', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    expect(playback.availability).toBe('idle');
    const marks = playback.timeline(events, STANDARD_GUITAR);
    expect(playback.availability).toBe('on');
    expect(marks.map((m) => [m.onsetMs, m.endMs])).toEqual([
      [0, 1500],
      [250, 1750]
    ]);
    expect(playback.sequencePlaying).toBe(true);
    await flush();
    expect(d.rendered).toEqual([40, 45]);
    d.deps.clock.advance(1750);
    expect(playback.sequencePlaying).toBe(false);
  });

  it('stop() ends it', async () => {
    const d = deps();
    resetPlaybackForTests(d.deps);
    playback.preload();
    await flush();
    playback.timeline(events, STANDARD_GUITAR);
    playback.stop('view');
    expect(playback.sequencePlaying).toBe(false);
    expect(playback.pulses).toEqual([]);
  });
});
