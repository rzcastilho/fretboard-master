import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlaybackEngine, type EngineEvents } from '../../../src/lib/audio/engine';
import { planRequest } from '../../../src/lib/audio/schedule';
import type { Synth } from '../../../src/lib/audio/types';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { FakeAudioPort, FakeClock, FakeGain, FakeSource } from './support/fake-audio';

function events(): EngineEvents {
  return {
    onPulseStart: vi.fn(),
    onPulseEnd: vi.fn(),
    onSequenceChange: vi.fn(),
    onUnavailable: vi.fn()
  };
}

/** Records the pitch of each voice; fills samples with a constant so buffer copies are visible. */
function recordingSynth(): Synth & {
  calls: { pitch: number; sampleRate: number; length: number }[];
} {
  const calls: { pitch: number; sampleRate: number; length: number }[] = [];
  return {
    calls,
    renderVoice(pitch, sampleRate, length) {
      calls.push({ pitch, sampleRate, length });
      return new Float32Array(length).fill(0.5);
    },
    mixVoices: (voices) => voices[0]
  };
}

function setup() {
  const port = new FakeAudioPort();
  port.currentTime = 1.25;
  const clock = new FakeClock();
  const synth = recordingSynth();
  const createContext = vi.fn(() => port);
  const loadSynth = vi.fn(() => Promise.resolve(synth));
  const engine = createPlaybackEngine(events(), { createContext, loadSynth, clock });
  return { port, clock, synth, createContext, loadSynth, engine };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const string6Open = { kind: 'note', position: { string: 6, fret: 0 } } as const;

describe('engine E1: no context before a gesture', () => {
  it('does not create a context on construction or preload()', async () => {
    const { createContext, loadSynth, engine } = setup();
    expect(createContext).not.toHaveBeenCalled();
    engine.preload();
    await flush();
    expect(loadSynth).toHaveBeenCalledTimes(1);
    expect(createContext).not.toHaveBeenCalled();
  });
});

describe('engine E2: first play unlocks and schedules at currentTime, synchronously', () => {
  it('creates the context, calls resume() and start(currentTime) in the same call', async () => {
    const { port, createContext, engine } = setup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(port.resumeCalls).toBe(1);
    expect(port.sources).toHaveLength(1);
    expect(port.sources[0].startCalls).toEqual([port.currentTime]);
  });

  it('schedules within 100 ms of activation on the injected clock (SC-001)', async () => {
    const { port, clock, engine } = setup();
    engine.preload();
    await flush();
    const t0 = clock.now();
    engine.play(string6Open, STANDARD_GUITAR);
    expect(port.sources[0].startCalls).toHaveLength(1);
    expect(clock.now() - t0).toBeLessThanOrEqual(100);
  });

  it('does not await resume(): a manual, still-pending resume does not delay start()', async () => {
    const { port, engine } = setup();
    port.resumeMode = 'manual';
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    expect(port.state).toBe('suspended');
    expect(port.sources[0].startCalls).toEqual([port.currentTime]);
  });

  it('reuses the context on later plays', async () => {
    const { createContext, engine } = setup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    engine.play({ kind: 'note', position: { string: 5, fret: 3 } }, STANDARD_GUITAR);
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('unlock() creates and resumes the context without playing', () => {
    const { port, createContext, engine } = setup();
    engine.unlock();
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(port.resumeCalls).toBe(1);
    expect(port.sources).toHaveLength(0);
  });
});

describe('engine E3: marks and rendering', () => {
  it('returns marks synchronously equal to planRequest(...).marks', async () => {
    const { engine } = setup();
    engine.preload();
    await flush();
    const marks = engine.play(string6Open, STANDARD_GUITAR);
    expect(marks).toEqual(planRequest(string6Open, STANDARD_GUITAR).marks);
    expect(marks).toEqual([{ position: { string: 6, fret: 0 }, onsetMs: 0, endMs: 1500 }]);
  });

  it('returns marks even when the synth has not loaded yet, and plays once it has', async () => {
    const { port, engine } = setup();
    const marks = engine.play(string6Open, STANDARD_GUITAR);
    expect(marks).toHaveLength(1);
    expect(port.resumeCalls).toBe(1);
    await flush();
    expect(port.sources).toHaveLength(1);
    expect(port.sources[0].startCalls).toEqual([port.currentTime]);
  });

  it('renders string 6 open as pitch 40 at ctx.sampleRate for 1.5 s into one buffer', async () => {
    const { port, synth, engine } = setup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    expect(synth.calls).toEqual([{ pitch: 40, sampleRate: 48000, length: 72000 }]);
    expect(port.buffers).toHaveLength(1);
    expect(port.buffers[0].sampleRate).toBe(48000);
    expect(port.buffers[0].length).toBe(72000);
    expect(port.buffers[0].getChannelData(0)[0]).toBe(0.5);
    expect(port.sources[0].buffer).toBe(port.buffers[0]);
  });

  it('uses pitch 48 for string 5 fret 3, and the instrument passed with the call', async () => {
    const { synth, engine } = setup();
    engine.preload();
    await flush();
    engine.play({ kind: 'note', position: { string: 5, fret: 3 } }, STANDARD_GUITAR);
    const dropD = {
      ...STANDARD_GUITAR,
      openStrings: [
        ...STANDARD_GUITAR.openStrings.slice(0, 5),
        { letter: 'D', accidental: 0, octave: 2 } as const
      ]
    };
    engine.play(string6Open, dropD);
    expect(synth.calls.map((c) => c.pitch)).toEqual([48, 38]);
  });

  it('does nothing for an invalid position and returns no marks', async () => {
    const { port, engine } = setup();
    engine.preload();
    await flush();
    expect(
      engine.play({ kind: 'note', position: { string: 9, fret: 0 } }, STANDARD_GUITAR)
    ).toEqual([]);
    expect(port.sources).toHaveLength(0);
  });
});

describe('engine graph: source → voice gain → volume gain → mute gain → destination', () => {
  it('wires the chain with default volume gain (80/100)² = 0.64 and mute gain 1', async () => {
    const { port, engine } = setup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    const source = port.sources[0] as unknown as FakeSource;
    const [volume, mute, voice] = port.gains as unknown as FakeGain[];
    expect(port.gains).toHaveLength(3);
    expect(source.connected).toEqual([voice]);
    expect(voice.connected).toEqual([volume]);
    expect(volume.connected).toEqual([mute]);
    expect(mute.connected).toEqual([port.destination]);
    expect(volume.gain.value).toBeCloseTo(0.64, 10);
    expect(mute.gain.value).toBe(1);
  });
});

describe('engine E5: pulses', () => {
  function pulseSetup() {
    const port = new FakeAudioPort();
    const clock = new FakeClock();
    const ev = events();
    const createContext = vi.fn(() => port);
    const loadSynth = vi.fn(() => Promise.resolve(recordingSynth()));
    const engine = createPlaybackEngine(ev, { createContext, loadSynth, clock });
    return { port, clock, ev, engine, createContext, loadSynth };
  }
  const pulseOf = (id: number) => ({ id, position: { string: 6, fret: 0 }, durationMs: 1500 });

  it('fires onPulseStart at onsetMs and onPulseEnd at endMs on the clock', async () => {
    const { clock, ev, engine } = pulseSetup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    clock.advance(0);
    expect(ev.onPulseStart).toHaveBeenCalledTimes(1);
    expect(ev.onPulseStart).toHaveBeenCalledWith(pulseOf(1));
    expect(ev.onPulseEnd).not.toHaveBeenCalled();
    clock.advance(1499);
    expect(ev.onPulseEnd).not.toHaveBeenCalled();
    clock.advance(1);
    expect(ev.onPulseEnd).toHaveBeenCalledTimes(1);
    expect(ev.onPulseEnd).toHaveBeenCalledWith(1);
    expect(ev.onPulseStart).toHaveBeenCalledTimes(1);
  });

  it('pulses when muted', async () => {
    const { clock, ev, engine } = pulseSetup();
    engine.preload();
    await flush();
    engine.setMuted(true);
    engine.play(string6Open, STANDARD_GUITAR);
    clock.advance(0);
    expect(ev.onPulseStart).toHaveBeenCalledTimes(1);
    clock.advance(1500);
    expect(ev.onPulseEnd).toHaveBeenCalledWith(1);
  });

  it('pulses when the context is unavailable', () => {
    const port = new FakeAudioPort();
    const clock = new FakeClock();
    const ev = events();
    const engine = createPlaybackEngine(ev, {
      createContext: () => {
        throw new Error('no audio');
      },
      loadSynth: () => Promise.resolve(recordingSynth()),
      clock
    });
    void port;
    engine.play(string6Open, STANDARD_GUITAR);
    clock.advance(0);
    expect(ev.onUnavailable).toHaveBeenCalledWith('context');
    expect(ev.onPulseStart).toHaveBeenCalledTimes(1);
    clock.advance(1500);
    expect(ev.onPulseEnd).toHaveBeenCalledTimes(1);
  });

  it('pulses when the note was dropped (synth never loaded)', () => {
    const clock = new FakeClock();
    const ev = events();
    const engine = createPlaybackEngine(ev, {
      createContext: () => new FakeAudioPort(),
      loadSynth: () => new Promise<Synth>(() => undefined),
      clock
    });
    engine.play(string6Open, STANDARD_GUITAR);
    clock.advance(0);
    expect(ev.onPulseStart).toHaveBeenCalledTimes(1);
    clock.advance(1500);
    expect(ev.onPulseEnd).toHaveBeenCalledTimes(1);
  });

  it('fires one pulse per onset, ids strictly increasing', async () => {
    const { clock, ev, engine } = pulseSetup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    clock.advance(1500);
    engine.play(string6Open, STANDARD_GUITAR);
    clock.advance(1500);
    engine.play({ kind: 'note', position: { string: 5, fret: 3 } }, STANDARD_GUITAR);
    clock.advance(1500);
    const ids = vi.mocked(ev.onPulseStart).mock.calls.map(([p]) => p.id);
    expect(ids).toEqual([1, 2, 3]);
    expect(ev.onPulseEnd).toHaveBeenCalledTimes(3);
  });

  it('plays nothing and pulses nothing for an invalid position', async () => {
    const { clock, ev, engine } = pulseSetup();
    engine.play({ kind: 'note', position: { string: 9, fret: 0 } }, STANDARD_GUITAR);
    clock.advance(2000);
    expect(ev.onPulseStart).not.toHaveBeenCalled();
  });
});

describe('engine E12: mute and volume are gain automation only', () => {
  it('setMuted ramps the mute gain with setTargetAtTime and never stops sources', async () => {
    const { port, engine } = setup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    const mute = port.gains[1] as unknown as FakeGain;
    engine.setMuted(true);
    const call = mute.gain.calls.find((c) => c.method === 'setTargetAtTime');
    expect(call?.args[0]).toBe(0);
    expect(call?.args[2]).toBeCloseTo(0.003, 6);
    engine.setMuted(false);
    expect(mute.gain.calls.filter((c) => c.method === 'setTargetAtTime').at(-1)?.args[0]).toBe(1);
    expect((port.sources[0] as unknown as FakeSource).stopCalls).toEqual([]);
  });

  it('setVolume ramps the volume gain to (v/100)² and never stops sources', async () => {
    const { port, engine } = setup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    const volume = port.gains[0] as unknown as FakeGain;
    engine.setVolume(50);
    const call = volume.gain.calls.filter((c) => c.method === 'setTargetAtTime').at(-1);
    expect(call?.args[0]).toBeCloseTo(0.25, 10);
    expect((port.sources[0] as unknown as FakeSource).stopCalls).toEqual([]);
  });

  it('setMuted unlocks the context (sound-control gesture)', () => {
    const { createContext, engine } = setup();
    engine.setMuted(true);
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('a mute set before the first context is applied when the context is created', async () => {
    const { port, engine } = setup();
    engine.setMuted(true);
    const mute = port.gains[1] as unknown as FakeGain;
    expect(mute.gain.value === 0 || mute.gain.calls.some((c) => c.args[0] === 0)).toBe(true);
  });
});

describe('engine gain checks (US3)', () => {
  it('volume 80 → gain 0.64; volume 0 → silent gain', async () => {
    const { port, engine } = setup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    const volume = port.gains[0] as unknown as FakeGain;
    expect(volume.gain.value).toBeCloseTo(0.64, 10);
    engine.setVolume(0);
    expect(volume.gain.calls.filter((c) => c.method === 'setTargetAtTime').at(-1)?.args[0]).toBe(0);
  });

  it('mute applies to an already sounding note by ramping, not stopping (10 ms, τ 3 ms)', async () => {
    const { port, engine } = setup();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    const mute = port.gains[1] as unknown as FakeGain;
    engine.setMuted(true);
    const call = mute.gain.calls.find((c) => c.method === 'setTargetAtTime');
    expect(call?.args[0]).toBe(0);
    expect(call?.args[2]).toBeCloseTo(0.003, 6);
    expect((port.sources[0] as unknown as FakeSource).stopCalls).toEqual([]);
  });
});

describe('engine E4/E6: interruption and stop (US4)', () => {
  const string5Fret3 = { kind: 'note', position: { string: 5, fret: 3 } } as const;
  const sequence = {
    kind: 'sequence',
    steps: [
      { string: 6, fret: 0 },
      { string: 5, fret: 3 }
    ],
    bpm: 60
  } as const;

  function full() {
    const port = new FakeAudioPort();
    const clock = new FakeClock();
    const ev = events();
    const synth = recordingSynth();
    const engine = createPlaybackEngine(ev, {
      createContext: () => port,
      loadSynth: () => Promise.resolve(synth),
      clock
    });
    return { port, clock, ev, engine };
  }

  const gainOf = (port: FakeAudioPort, i: number) => port.gains[2 + i] as unknown as FakeGain;
  const stopLog = () =>
    (globalThis.__fmAudioLog ?? []).filter((e) => e.type === 'stop') as {
      type: 'stop';
      requestId: number;
      reason: string;
    }[];

  beforeEach(() => {
    globalThis.__fmAudioLog = [];
  });

  it('a new play ramps live voices to 0 within 20 ms and stops each source', async () => {
    const { port, engine } = full();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    engine.play(string5Fret3, STANDARD_GUITAR);
    const ramp = gainOf(port, 0).gain.calls.find((c) => c.method === 'linearRampToValueAtTime');
    expect(ramp?.args[0]).toBe(0);
    expect((ramp?.args[1] ?? Infinity) - port.currentTime).toBeLessThanOrEqual(0.02);
    const stops = (port.sources[0] as unknown as FakeSource).stopCalls;
    expect(stops).toHaveLength(1);
    expect(stops[0] - port.currentTime).toBeLessThanOrEqual(0.02);
    expect((port.sources[1] as unknown as FakeSource).stopCalls).toEqual([]);
  });

  it('interruption clears pending pulse timers and ends live pulses', async () => {
    const { clock, ev, engine } = full();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    clock.advance(0);
    expect(ev.onPulseStart).toHaveBeenCalledTimes(1);
    engine.play(string5Fret3, STANDARD_GUITAR);
    expect(ev.onPulseEnd).toHaveBeenCalledWith(1);
    clock.advance(0);
    clock.advance(1500);
    // Only the second request's pulse started; the first one's end timer never fires twice.
    expect(ev.onPulseStart).toHaveBeenCalledTimes(2);
    expect(vi.mocked(ev.onPulseEnd).mock.calls.map(([id]) => id)).toEqual([1, 2]);
  });

  it('three rapid plays log two interrupt stops (SC-004)', async () => {
    const { engine } = full();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    engine.play(string5Fret3, STANDARD_GUITAR);
    engine.play(string6Open, STANDARD_GUITAR);
    expect(stopLog().map((e) => e.reason)).toEqual(['interrupt', 'interrupt']);
  });

  it('a request that already finished is not logged as interrupted', async () => {
    const { clock, engine } = full();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    clock.advance(1500);
    engine.play(string5Fret3, STANDARD_GUITAR);
    expect(stopLog()).toEqual([]);
  });

  it('stop() silences, cancels pending steps and pulses, and ends the sequence', async () => {
    const { port, clock, ev, engine } = full();
    engine.preload();
    await flush();
    engine.play(sequence, STANDARD_GUITAR);
    expect(ev.onSequenceChange).toHaveBeenLastCalledWith(true);
    clock.advance(0);
    engine.stop();
    expect(ev.onSequenceChange).toHaveBeenLastCalledWith(false);
    expect(ev.onPulseEnd).toHaveBeenCalledWith(1);
    for (const s of port.sources) expect((s as unknown as FakeSource).stopCalls).toHaveLength(1);
    expect(clock.pendingCount).toBe(0);
    clock.advance(5000);
    expect(ev.onPulseStart).toHaveBeenCalledTimes(1);
  });

  it('a sequence ends itself at its last endMs', async () => {
    const { clock, ev, engine } = full();
    engine.preload();
    await flush();
    engine.play(sequence, STANDARD_GUITAR);
    clock.advance(1999);
    expect(ev.onSequenceChange).toHaveBeenCalledTimes(1);
    clock.advance(1);
    expect(ev.onSequenceChange).toHaveBeenLastCalledWith(false);
    expect(ev.onSequenceChange).toHaveBeenCalledTimes(2);
  });

  it('stop() emits onSequenceChange(false) only if a sequence was active', async () => {
    const { ev, engine } = full();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    engine.stop();
    expect(ev.onSequenceChange).not.toHaveBeenCalled();
  });

  it.each(['stop', 'hidden', 'navigate', 'instrument', 'view'] as const)(
    'stop(%s) logs its reason',
    async (reason) => {
      const { engine } = full();
      engine.preload();
      await flush();
      engine.play(string6Open, STANDARD_GUITAR);
      engine.stop(reason);
      expect(stopLog().map((e) => e.reason)).toEqual([reason]);
    }
  );

  it('stop() with nothing active is a no-op', () => {
    const { ev, engine } = full();
    engine.stop();
    expect(stopLog()).toEqual([]);
    expect(ev.onPulseEnd).not.toHaveBeenCalled();
    expect(ev.onSequenceChange).not.toHaveBeenCalled();
  });

  it('a request stopped before the synth loads schedules nothing', async () => {
    const { port, engine } = full();
    engine.play(string6Open, STANDARD_GUITAR);
    engine.stop();
    await flush();
    expect(port.sources).toHaveLength(0);
  });

  it('mute and volume still never stop sources', async () => {
    const { port, engine } = full();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    engine.setMuted(true);
    engine.setVolume(10);
    expect((port.sources[0] as unknown as FakeSource).stopCalls).toEqual([]);
  });
});

describe('engine E7-E9: availability and the synth window (US5)', () => {
  function build(over: Partial<Parameters<typeof createPlaybackEngine>[1]> = {}) {
    const port = new FakeAudioPort();
    const clock = new FakeClock();
    const ev = events();
    const createContext = vi.fn(() => port);
    const loadSynth = vi.fn(() => Promise.resolve(recordingSynth()));
    const engine = createPlaybackEngine(ev, { createContext, loadSynth, clock, ...over });
    return { port, clock, ev, engine, createContext, loadSynth };
  }
  const string5Fret3 = { kind: 'note', position: { string: 5, fret: 3 } } as const;

  it('E7: a throwing constructor reports unavailable once, never retries, and still pulses', () => {
    const createContext = vi.fn(() => {
      throw new Error('no audio');
    });
    const { clock, ev, engine } = build({ createContext });
    engine.play(string6Open, STANDARD_GUITAR);
    engine.play(string5Fret3, STANDARD_GUITAR);
    engine.unlock();
    expect(ev.onUnavailable).toHaveBeenCalledTimes(1);
    expect(ev.onUnavailable).toHaveBeenCalledWith('context');
    expect(createContext).toHaveBeenCalledTimes(1);
    clock.advance(0);
    expect(ev.onPulseStart).toHaveBeenCalled();
  });

  it('E7: a missing AudioContext API reports unavailable once', () => {
    const createContext = vi.fn(() => {
      throw new ReferenceError('AudioContext is not defined');
    });
    const { ev, engine } = build({ createContext });
    engine.unlock();
    engine.unlock();
    expect(ev.onUnavailable).toHaveBeenCalledTimes(1);
  });

  it('E7: a rejecting first resume() reports unavailable once and never resumes again', async () => {
    const { port, ev, clock, engine } = build();
    port.resumeMode = 'reject';
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    await flush();
    expect(ev.onUnavailable).toHaveBeenCalledTimes(1);
    expect(ev.onUnavailable).toHaveBeenCalledWith('resume');
    const calls = port.resumeCalls;
    engine.play(string5Fret3, STANDARD_GUITAR);
    engine.unlock();
    await flush();
    expect(port.resumeCalls).toBe(calls);
    expect(ev.onUnavailable).toHaveBeenCalledTimes(1);
    clock.advance(0);
    expect(ev.onPulseStart).toHaveBeenCalled();
  });

  it('E7: a rejecting loader reports unavailable once on the first gesture and still pulses', async () => {
    const loadSynth = vi.fn(() => Promise.reject(new Error('no synth')));
    const { clock, ev, createContext, engine } = build({ loadSynth });
    engine.preload();
    await flush();
    expect(ev.onUnavailable).not.toHaveBeenCalled();
    engine.play(string6Open, STANDARD_GUITAR);
    await flush();
    engine.play(string5Fret3, STANDARD_GUITAR);
    await flush();
    expect(ev.onUnavailable).toHaveBeenCalledTimes(1);
    expect(ev.onUnavailable).toHaveBeenCalledWith('synth');
    expect(createContext.mock.calls.length).toBeLessThanOrEqual(1);
    clock.advance(0);
    expect(ev.onPulseStart).toHaveBeenCalled();
  });

  it('E7: a loader that rejects after the gesture also reports unavailable once', async () => {
    let reject: (e: unknown) => void = () => undefined;
    const loadSynth = () => new Promise<Synth>((_, r) => (reject = r));
    const { ev, engine } = build({ loadSynth });
    engine.play(string6Open, STANDARD_GUITAR);
    reject(new Error('late'));
    await flush();
    expect(ev.onUnavailable).toHaveBeenCalledTimes(1);
    expect(ev.onUnavailable).toHaveBeenCalledWith('synth');
  });

  it('E8: after audio was on, a later resume() rejection drops that sound, is not unavailable, and retries', async () => {
    const { port, ev, clock, engine } = build();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    await flush();
    port.state = 'suspended';
    port.resumeMode = 'reject';
    const before = port.resumeCalls;
    engine.play(string5Fret3, STANDARD_GUITAR);
    await flush();
    expect(port.resumeCalls).toBe(before + 1);
    expect(ev.onUnavailable).not.toHaveBeenCalled();
    expect(port.sources[1].stopCalls).toHaveLength(1);
    clock.advance(0);
    expect(ev.onPulseStart).toHaveBeenCalledTimes(1); // the superseded first request never pulsed
    port.resumeMode = 'resolve';
    engine.play(string6Open, STANDARD_GUITAR);
    await flush();
    expect(port.resumeCalls).toBe(before + 2);
    expect(port.sources[2].stopCalls).toHaveLength(0);
  });

  it('E8: Safari "interrupted" is resumable, not unavailable', async () => {
    const { port, ev, engine } = build();
    engine.preload();
    await flush();
    engine.play(string6Open, STANDARD_GUITAR);
    await flush();
    port.state = 'interrupted';
    const before = port.resumeCalls;
    engine.play(string5Fret3, STANDARD_GUITAR);
    await flush();
    expect(port.resumeCalls).toBe(before + 1);
    expect(ev.onUnavailable).not.toHaveBeenCalled();
    expect(port.sources).toHaveLength(2);
  });

  it('E9: a loader resolving within 100 ms plays at that moment’s currentTime', async () => {
    let resolve: (s: Synth) => void = () => undefined;
    const loadSynth = () => new Promise<Synth>((r) => (resolve = r));
    const { port, clock, engine } = build({ loadSynth });
    engine.play(string6Open, STANDARD_GUITAR);
    expect(port.sources).toHaveLength(0);
    clock.advance(60);
    port.currentTime = 2.5;
    resolve(recordingSynth());
    await flush();
    expect(port.sources).toHaveLength(1);
    expect(port.sources[0].startCalls).toEqual([2.5]);
  });

  it('E9: a loader resolving after 100 ms drops the note; later taps play', async () => {
    let resolve: (s: Synth) => void = () => undefined;
    const loadSynth = () => new Promise<Synth>((r) => (resolve = r));
    const { port, clock, ev, engine } = build({ loadSynth });
    engine.play(string6Open, STANDARD_GUITAR);
    clock.advance(101);
    resolve(recordingSynth());
    await flush();
    expect(port.sources).toHaveLength(0);
    expect(ev.onPulseStart).toHaveBeenCalled();
    engine.play(string5Fret3, STANDARD_GUITAR);
    expect(port.sources).toHaveLength(1);
  });
});

describe('engine E10/E11: chords and sequences (US6)', () => {
  function mixSynth() {
    const mixed: Float32Array[][] = [];
    const synth: Synth = {
      renderVoice: (pitch, _sr, length) => new Float32Array(length).fill(pitch / 100),
      mixVoices(voices) {
        mixed.push([...voices]);
        const out = new Float32Array(voices[0].length).fill(0.77);
        return out;
      }
    };
    return { synth, mixed };
  }
  function build() {
    const port = new FakeAudioPort();
    port.currentTime = 2;
    const clock = new FakeClock();
    const ev = events();
    const { synth, mixed } = mixSynth();
    const engine = createPlaybackEngine(ev, {
      createContext: () => port,
      loadSynth: () => Promise.resolve(synth),
      clock
    });
    return { port, clock, ev, engine, mixed };
  }
  const p = (string: number, fret: number) => ({ string, fret });

  it('E10: a single note also goes through mixVoices (peak limiter)', async () => {
    const { port, engine, mixed } = build();
    engine.preload();
    await flush();
    engine.play({ kind: 'note', position: p(6, 0) }, STANDARD_GUITAR);
    expect(mixed).toHaveLength(1);
    expect(mixed[0]).toHaveLength(1);
    expect(port.sources).toHaveLength(1);
    expect(port.sources[0].buffer?.getChannelData(0)[0]).toBeCloseTo(0.77);
  });

  it('E10: a chord plays exactly one source from mixVoices with one shared onset', async () => {
    const { port, engine, mixed } = build();
    engine.preload();
    await flush();
    const request = { kind: 'chord', positions: [p(6, 0), p(5, 2), p(4, 2)] } as const;
    const marks = engine.play(request, STANDARD_GUITAR);
    expect(port.sources).toHaveLength(1);
    expect(mixed).toHaveLength(1);
    expect(mixed[0]).toHaveLength(3);
    expect(port.sources[0].buffer?.getChannelData(0)[0]).toBeCloseTo(0.77, 5);
    expect(port.sources[0].startCalls).toEqual([2]);
    expect(new Set(marks.map((m) => m.onsetMs))).toEqual(new Set([0]));
    expect(marks).toEqual(planRequest(request, STANDARD_GUITAR).marks);
  });

  it('E11: step i is scheduled at t0 + i·60/bpm on the audio clock, not by timers', async () => {
    const { port, clock, engine } = build();
    engine.preload();
    await flush();
    const request = {
      kind: 'sequence',
      steps: [p(6, 0), [p(5, 2), p(4, 2)], p(3, 0)],
      bpm: 120
    } as const;
    const pendingBefore = clock.pendingCount;
    const marks = engine.play(request, STANDARD_GUITAR);
    expect(port.sources.map((s) => s.startCalls[0])).toEqual([2, 2.5, 3]);
    expect(port.sources).toHaveLength(3);
    expect(marks).toEqual(planRequest(request, STANDARD_GUITAR).marks);
    // Only pulse/end timers exist; sources were all scheduled up front.
    expect(clock.pendingCount).toBeGreaterThan(pendingBefore);
  });

  it('E11: onSequenceChange(true) at start and (false) after the last endMs', async () => {
    const { clock, ev, engine } = build();
    engine.preload();
    await flush();
    engine.play({ kind: 'sequence', steps: [p(6, 0), p(5, 0)], bpm: 60 }, STANDARD_GUITAR);
    expect(ev.onSequenceChange).toHaveBeenCalledWith(true);
    expect(ev.onSequenceChange).not.toHaveBeenCalledWith(false);
    clock.advance(1000);
    expect(ev.onSequenceChange).not.toHaveBeenCalledWith(false);
    clock.advance(1000);
    expect(ev.onSequenceChange).toHaveBeenLastCalledWith(false);
  });

  it('E11: tempo clamps to 30–300 (29 → 30, 301 → 300)', async () => {
    const { port, engine } = build();
    engine.preload();
    await flush();
    engine.play({ kind: 'sequence', steps: [p(6, 0), p(5, 0)], bpm: 29 }, STANDARD_GUITAR);
    expect(port.sources[1].startCalls[0] - port.sources[0].startCalls[0]).toBeCloseTo(2, 6);
    engine.play({ kind: 'sequence', steps: [p(6, 0), p(5, 0)], bpm: 301 }, STANDARD_GUITAR);
    const n = port.sources.length;
    expect(port.sources[n - 1].startCalls[0] - port.sources[n - 2].startCalls[0]).toBeCloseTo(
      0.2,
      6
    );
  });
});
