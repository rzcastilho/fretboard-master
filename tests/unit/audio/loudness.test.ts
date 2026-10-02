import { describe, expect, it } from 'vitest';
import { aWeightedRms } from '../../../src/lib/audio/loudness';

function sine(freq: number, sampleRate: number, seconds = 1): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

/** Filter gain in dB relative to the unweighted RMS of a unit sine (1/√2). */
function responseDb(freq: number, sampleRate: number): number {
  const x = sine(freq, sampleRate);
  const rms = aWeightedRms(x, sampleRate, x.length);
  return 20 * Math.log10(rms / Math.SQRT1_2);
}

describe('aWeightedRms (IEC 61672 A-weighting)', () => {
  for (const sampleRate of [44100, 48000]) {
    it(`matches IEC 61672 at 100 Hz, 1 kHz and 10 kHz (${sampleRate} Hz)`, () => {
      expect(Math.abs(responseDb(100, sampleRate) - -19.1)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(responseDb(1000, sampleRate) - 0)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(responseDb(10000, sampleRate) - -2.5)).toBeLessThanOrEqual(0.5);
    });

    it(`unit sine at 1 kHz has RMS ≈ 0.707 within 1 % (${sampleRate} Hz)`, () => {
      const x = sine(1000, sampleRate);
      expect(aWeightedRms(x, sampleRate, x.length)).toBeCloseTo(Math.SQRT1_2, 2);
      const rms = aWeightedRms(x, sampleRate, x.length);
      expect(Math.abs(rms / Math.SQRT1_2 - 1)).toBeLessThan(0.01);
    });
  }

  it('returns 0 for silence and for an empty window', () => {
    expect(aWeightedRms(new Float32Array(1000), 48000, 1000)).toBe(0);
    expect(aWeightedRms(new Float32Array(1000), 48000, 0)).toBe(0);
  });
});
