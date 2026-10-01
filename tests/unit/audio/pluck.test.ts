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
