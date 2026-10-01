import { describe, expect, it } from 'vitest';
import { aWeightedRmsDb, estimateCentsOffset, harmonicShare } from './analysis';

function sine(freq: number, sr: number, seconds: number, amp = 1): Float32Array {
  const out = new Float32Array(Math.floor(sr * seconds));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return out;
}

describe('analysis helpers', () => {
  it.each([44100, 48000])('pitch estimator finds a sine within 0.5 cent at %i Hz', (sr) => {
    const f0 = 110;
    const detuned = f0 * Math.pow(2, 12 / 1200); // +12 cents
    const cents = estimateCentsOffset(sine(detuned, sr, 1.2), sr, f0);
    expect(Math.abs(cents - 12)).toBeLessThan(0.5);
  });

  it('A-weighted level of a 1 kHz sine of amplitude 1 is ≈ −3.01 dB', () => {
    // RMS = 1/√2 → −3.01 dB; A-weight at 1 kHz is 0 dB.
    const db = aWeightedRmsDb(sine(1000, 48000, 0.6), 48000);
    expect(db).toBeCloseTo(-3.01, 0);
  });

  it('A-weighting attenuates 100 Hz by ≈ 19.1 dB relative to 1 kHz', () => {
    const lo = aWeightedRmsDb(sine(100, 48000, 0.6), 48000);
    const hi = aWeightedRmsDb(sine(1000, 48000, 0.6), 48000);
    expect(hi - lo).toBeCloseTo(19.1, 0);
  });

  it('harmonic share: pure sine ≈ 0, sine plus 3rd harmonic is high', () => {
    expect(harmonicShare(sine(100, 48000, 0.6), 48000, 100)).toBeLessThan(0.01);
    const a = sine(100, 48000, 0.6, 0.2);
    const b = sine(300, 48000, 0.6, 1);
    const mix = a.map((v, i) => v + b[i]);
    expect(harmonicShare(mix, 48000, 100)).toBeGreaterThan(0.9);
  });
});
