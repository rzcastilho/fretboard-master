import { describe, expect, it, vi } from 'vitest';
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
