import { describe, expect, it } from 'vitest';
import { CLICK_S, renderClick } from '../../../src/lib/audio/click';

const RATE = 48000;

const peakOf = (s: Float32Array): number => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/** Frequency of the strongest DFT bin on a 5 Hz grid. */
function dominantHz(s: Float32Array, rate: number): number {
  let best = 0;
  let bestMag = -1;
  for (let f = 500; f <= 2500; f += 5) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < s.length; i++) {
      const a = (2 * Math.PI * f * i) / rate;
      re += s[i] * Math.cos(a);
      im -= s[i] * Math.sin(a);
    }
    const mag = re * re + im * im;
    if (mag > bestMag) {
      bestMag = mag;
      best = f;
    }
  }
  return best;
}

describe('renderClick', () => {
  it('accent: 1600 Hz, peak 0.9', () => {
    const s = renderClick('accent', RATE);
    expect(Math.abs(dominantHz(s, RATE) - 1600) / 1600).toBeLessThanOrEqual(0.02);
    expect(peakOf(s)).toBeCloseTo(0.9, 2);
  });

  it('normal: 1000 Hz, peak 0.55', () => {
    const s = renderClick('normal', RATE);
    expect(Math.abs(dominantHz(s, RATE) - 1000) / 1000).toBeLessThanOrEqual(0.02);
    expect(peakOf(s)).toBeCloseTo(0.55, 2);
  });

  it('accent is at least 1.5x the normal peak', () => {
    expect(
      peakOf(renderClick('accent', RATE)) / peakOf(renderClick('normal', RATE))
    ).toBeGreaterThanOrEqual(1.5);
  });

  it.each(['accent', 'normal'] as const)('%s: starts at 0 and decays to <= 1%% of peak', (kind) => {
    const s = renderClick(kind, RATE);
    expect(s[0]).toBe(0);
    expect(Math.abs(s[s.length - 1])).toBeLessThanOrEqual(0.01 * peakOf(s));
  });

  it.each([44100, 48000, 96000])('length is round(CLICK_S x rate) at %i Hz', (rate) => {
    expect(renderClick('normal', rate).length).toBe(Math.round(CLICK_S * rate));
  });

  it('is deterministic', () => {
    expect(renderClick('accent', RATE)).toEqual(renderClick('accent', RATE));
  });

  it('never throws on odd sample rates', () => {
    for (const rate of [0, -1, NaN, Infinity, 1]) {
      expect(() => renderClick('accent', rate)).not.toThrow();
    }
  });
});
