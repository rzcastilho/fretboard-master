import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHIME_S, playChime, renderChime } from '../../../src/lib/audio/chime';
import type { AudioSink } from '../../../src/lib/audio/engine';
import { FakeAudioPort, FakeBuffer, FakeSource } from './support/fake-audio';

/** Magnitude of the DFT at one frequency. */
function magnitudeAt(x: Float32Array, rate: number, hz: number): number {
  let re = 0;
  let im = 0;
  for (let i = 0; i < x.length; i++) {
    const a = (2 * Math.PI * hz * i) / rate;
    re += x[i] * Math.cos(a);
    im -= x[i] * Math.sin(a);
  }
  return Math.hypot(re, im);
}

function sinkOf(port: FakeAudioPort): { sink: AudioSink; destination: object } {
  const destination = { kind: 'volume' };
  return {
    destination,
    sink: {
      port: port as unknown as AudioSink['port'],
      destination: destination as unknown as AudioNode,
      running: Promise.resolve(true)
    }
  };
}

describe('renderChime', () => {
  it('A1: has round(0.8 × rate) samples; a bad rate falls back to 48 000', () => {
    expect(CHIME_S).toBe(0.8);
    expect(renderChime(48000).length).toBe(Math.round(0.8 * 48000));
    expect(renderChime(44100).length).toBe(Math.round(0.8 * 44100));
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(renderChime(bad).length).toBe(Math.round(0.8 * 48000));
    }
  });

  it('A2: peaks at 0.5, starts at 0 and ends quiet', () => {
    const x = renderChime(48000);
    const peak = x.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
    expect(Math.abs(peak - 0.5)).toBeLessThan(1e-6);
    expect(x[0]).toBe(0);
    const tail = x.subarray(x.length - 480);
    expect(tail.reduce((m, s) => Math.max(m, Math.abs(s)), 0)).toBeLessThan(peak * 0.002);
  });

  it('A3: the energy sits at 880 and 1320 Hz, not at the click frequencies', () => {
    const rate = 48000;
    const x = renderChime(rate);
    const m880 = magnitudeAt(x, rate, 880);
    const m1320 = magnitudeAt(x, rate, 1320);
    expect(m880).toBeGreaterThan(5 * magnitudeAt(x, rate, 1000));
    expect(m880).toBeGreaterThan(5 * magnitudeAt(x, rate, 2400));
    expect(m1320).toBeGreaterThan(5 * magnitudeAt(x, rate, 1000));
    expect(m1320).toBeGreaterThan(5 * magnitudeAt(x, rate, 2400));
  });
});

describe('playChime', () => {
  beforeEach(() => {
    globalThis.__fmAudioLog = [];
  });
  afterEach(() => {
    globalThis.__fmAudioLog = undefined;
  });

  it('A4: one buffer and one source, connected to the sink and started now', () => {
    const port = new FakeAudioPort();
    port.state = 'running';
    port.currentTime = 3.25;
    const { sink, destination } = sinkOf(port);
    expect(playChime(sink, 40)).toBe(true);
    expect(port.buffers).toHaveLength(1);
    expect(port.sources).toHaveLength(1);
    const src = port.sources[0];
    expect(src.connected).toEqual([destination]);
    expect(src.connected).not.toContain(port.destination);
    expect(src.startCalls).toEqual([3.25]);
    expect(src.buffer).toBe(port.buffers[0]);
    expect(port.buffers[0].length).toBe(Math.round(0.8 * port.sampleRate));
  });

  it('A5: a context that is not running plays nothing', () => {
    const port = new FakeAudioPort();
    port.state = 'suspended';
    expect(playChime(sinkOf(port).sink, 0)).toBe(false);
    expect(port.buffers).toHaveLength(0);
    expect(port.sources).toHaveLength(0);
  });

  it('A6: a throwing Web Audio call gives false, never an exception', () => {
    const port = new FakeAudioPort();
    port.state = 'running';
    port.createBufferSource = () => {
      throw new Error('boom');
    };
    expect(playChime(sinkOf(port).sink, 0)).toBe(false);
    const port2 = new FakeAudioPort();
    port2.state = 'running';
    port2.createBuffer = () => {
      throw new Error('boom');
    };
    expect(playChime(sinkOf(port2).sink, 0)).toBe(false);
  });

  it('A7: appends a chime entry in test builds', () => {
    const port = new FakeAudioPort();
    port.state = 'running';
    port.currentTime = 1.5;
    playChime(sinkOf(port).sink, 120);
    expect(globalThis.__fmAudioLog).toEqual([
      { type: 'chime', when: 1.5, contextTime: 1.5, lateMs: 120 }
    ]);
  });

  it('A8: creates no gain nodes and touches nothing but its own buffer and source', () => {
    const port = new FakeAudioPort();
    port.state = 'running';
    playChime(sinkOf(port).sink, 0);
    expect(port.gains).toHaveLength(0);
    expect(port.resumeCalls).toBe(0);
  });

  it('A9: the source disconnects itself on ended', () => {
    const port = new FakeAudioPort();
    port.state = 'running';
    playChime(sinkOf(port).sink, 0);
    const src: FakeSource = port.sources[0];
    expect(src.connected).toHaveLength(1);
    src.onended?.();
    expect(src.connected).toHaveLength(0);
    expect(port.buffers[0]).toBeInstanceOf(FakeBuffer);
  });
});
