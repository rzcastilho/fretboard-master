import { describe, expect, it } from 'vitest';
import { pluckSynth } from '../../../src/lib/audio/pluck';
import { frequencyOf } from '../../../src/lib/theory/pitch';
import { aWeightedRmsDb, estimateCentsOffset, harmonicShare } from './support/analysis';

const LOWEST = 33; // A1
const HIGHEST = 88; // E6
const pitches = Array.from({ length: HIGHEST - LOWEST + 1 }, (_, i) => LOWEST + i);
const LENGTH_S = 1.5;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

for (const sampleRate of [44100, 48000]) {
  describe(`pluckSynth.renderVoice at ${sampleRate} Hz`, () => {
    const length = Math.round(LENGTH_S * sampleRate);

    it.each(pitches)(
      'pitch %i: fundamental within ±5 cents, finite, non-silent, faded',
      (pitch) => {
        const x = pluckSynth.renderVoice(pitch, sampleRate, length);
        expect(x.length).toBe(length);
        let peak = 0;
        for (let i = 0; i < x.length; i++) {
          expect(Number.isFinite(x[i])).toBe(true);
          peak = Math.max(peak, Math.abs(x[i]));
        }
        expect(peak).toBeGreaterThan(0.01);
        // A single note never needs the limiter: its attack stays ≤ −1 dBFS (no clipping at 100 %).
        expect(peak).toBeLessThanOrEqual(0.89);

        const cents = estimateCentsOffset(x, sampleRate, frequencyOf(pitch));
        expect(Math.abs(cents)).toBeLessThanOrEqual(5);

        // First 2 ms fade in from exactly 0; last 10 ms fade linearly to exactly 0.
        expect(Math.abs(x[0])).toBe(0);
        expect(Math.abs(x[length - 1])).toBe(0);
        const fadeLen = Math.round(0.01 * sampleRate);
        const tail = x.subarray(length - fadeLen - 1);
        // The tail envelope never exceeds the linear ramp scaled by the loudest tail sample's source.
        for (let i = 0; i < tail.length; i++) {
          const ramp = (tail.length - 1 - i) / fadeLen;
          expect(Math.abs(tail[i])).toBeLessThanOrEqual(ramp * 2 + 1e-6);
        }
      },
      30_000
    );

    it('A-weighted RMS of the first 500 ms is within ±3 dB of the median (A1–E6)', () => {
      const levels = pitches.map((p) =>
        aWeightedRmsDb(pluckSynth.renderVoice(p, sampleRate, length), sampleRate)
      );
      const med = median(levels);
      for (const level of levels) expect(Math.abs(level - med)).toBeLessThanOrEqual(3);
    }, 60_000);

    it('keeps low notes bright: harmonic share ≥ 0.5 when f0 < 200 Hz (FR-006)', () => {
      const low = pitches.filter((p) => frequencyOf(p) < 200);
      expect(low.length).toBeGreaterThan(5);
      for (const p of low) {
        const x = pluckSynth.renderVoice(p, sampleRate, length);
        expect(harmonicShare(x, sampleRate, frequencyOf(p))).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('is deterministic: same (pitch, sampleRate, length) → identical samples', () => {
      const a = pluckSynth.renderVoice(52, sampleRate, length);
      const b = pluckSynth.renderVoice(52, sampleRate, length);
      expect(Array.from(a)).toEqual(Array.from(b));
    });

    it('still renders a pitch outside A1–E6 (clamped timbre)', () => {
      for (const p of [20, 100]) {
        const x = pluckSynth.renderVoice(p, sampleRate, length);
        expect(x.length).toBe(length);
        expect(x.every(Number.isFinite)).toBe(true);
        expect(x.some((v) => v !== 0)).toBe(true);
      }
    });
  });
}

describe('pluckSynth.mixVoices (US6)', () => {
  const sampleRate = 44100;
  const length = Math.round(1.5 * sampleRate);
  const peakOf = (x: Float32Array): number => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const voice = (p: number, gain = 1): Float32Array => {
    const x = pluckSynth.renderVoice(p, sampleRate, length);
    if (gain !== 1) for (let i = 0; i < x.length; i++) x[i] *= gain;
    return x;
  };

  it('keeps the peak ≤ 0.89 for every 1–7 voice combination', () => {
    const pool = [33, 40, 45, 52, 59, 64, 88].map((p) => voice(p));
    for (let n = 1; n <= 7; n++) {
      const mixed = pluckSynth.mixVoices(pool.slice(0, n));
      expect(peakOf(mixed)).toBeLessThanOrEqual(0.89 + 1e-6);
    }
  });

  it('limits 7 loud simultaneous voices at full gain', () => {
    const loud = Array.from({ length: 7 }, () => new Float32Array(1000).fill(1));
    const mixed = pluckSynth.mixVoices(loud);
    expect(peakOf(mixed)).toBeLessThanOrEqual(0.89 + 1e-6);
    expect(peakOf(mixed)).toBeGreaterThan(0.5);
  });

  it('applies 1/√n scaling before the limiter', () => {
    const a = new Float32Array([0.1, 0.2, 0.0]);
    const b = new Float32Array([0.1, 0.0, 0.2]);
    const mixed = pluckSynth.mixVoices([a, b]);
    const k = 1 / Math.sqrt(2);
    expect(mixed[0]).toBeCloseTo(0.2 * k, 6);
    expect(mixed[1]).toBeCloseTo(0.2 * k, 6);
    expect(mixed[2]).toBeCloseTo(0.2 * k, 6);
  });

  it('is deterministic and as long as the longest input', () => {
    const voices = [new Float32Array(10).fill(0.3), new Float32Array(25).fill(0.3)];
    const a = pluckSynth.mixVoices(voices);
    const b = pluckSynth.mixVoices(voices);
    expect(a.length).toBe(25);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('returns an empty buffer for no voices', () => {
    expect(pluckSynth.mixVoices([]).length).toBe(0);
  });
});
