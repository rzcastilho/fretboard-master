import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CLICK_LENGTH_S,
  CLICK_S,
  CLICK_SOUNDS,
  DEFAULT_CLICK_SOUND,
  renderClick,
  toClickSound,
  type ClickKind
} from '../../../src/lib/audio/click';

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

  describe('sub (032)', () => {
    it('is 18 ms long, at most 20 ms', () => {
      const s = renderClick('sub', RATE);
      expect(s.length).toBe(Math.round(0.018 * RATE));
      expect(s.length).toBeLessThanOrEqual(Math.round(0.02 * RATE));
    });

    it('peaks at no more than half the normal click', () => {
      expect(peakOf(renderClick('sub', RATE))).toBeLessThanOrEqual(
        0.5 * peakOf(renderClick('normal', RATE))
      );
      expect(peakOf(renderClick('sub', RATE))).toBeCloseTo(0.25, 2);
    });

    it('sits at 2400 Hz, apart from accent and normal', () => {
      const hz = zeroCrossingHz(renderClick('sub', RATE), RATE);
      expect(Math.abs(hz - 2400) / 2400).toBeLessThanOrEqual(0.05);
      expect(Math.abs(hz - 1000)).toBeGreaterThan(200);
      expect(Math.abs(hz - 1600)).toBeGreaterThan(200);
    });

    it('leaves accent and normal as in 031', () => {
      expect(renderClick('accent', RATE).length).toBe(Math.round(0.03 * RATE));
      expect(renderClick('normal', RATE).length).toBe(Math.round(0.03 * RATE));
      expect(peakOf(renderClick('accent', RATE))).toBeCloseTo(0.9, 2);
      expect(peakOf(renderClick('normal', RATE))).toBeCloseTo(0.55, 2);
    });

    it('falls back to 48 kHz for an invalid sample rate', () => {
      expect(renderClick('sub', NaN).length).toBe(Math.round(0.018 * 48000));
    });

    it('exports the per-kind lengths', () => {
      expect(CLICK_LENGTH_S).toEqual({ accent: 0.03, normal: 0.03, sub: 0.018 });
      expect(CLICK_S).toBe(0.03);
    });
  });
});

/** Dominant frequency from upward zero crossings. */
function zeroCrossingHz(s: Float32Array, rate: number): number {
  const crossings: number[] = [];
  for (let i = 1; i < s.length; i++) {
    if (s[i - 1] < 0 && s[i] >= 0) {
      crossings.push(i - 1 + -s[i - 1] / (s[i] - s[i - 1]));
    }
  }
  if (crossings.length < 2) return 0;
  return (rate * (crossings.length - 1)) / (crossings[crossings.length - 1] - crossings[0]);
}

describe('click sounds (042)', () => {
  const KINDS: readonly ClickKind[] = ['accent', 'normal', 'sub'];
  const PEAK: Record<ClickKind, number> = { accent: 0.9, normal: 0.55, sub: 0.25 };
  const sha = (s: Float32Array): string =>
    createHash('sha256').update(Buffer.from(s.buffer)).digest('hex').slice(0, 16);

  it('lists the five sounds in select order, default click', () => {
    expect(CLICK_SOUNDS).toEqual(['click', 'wood', 'beep', 'rim', 'cowbell']);
    expect(DEFAULT_CLICK_SOUND).toBe('click');
  });

  it.each(CLICK_SOUNDS.flatMap((s) => KINDS.map((k) => [s, k] as const)))(
    '%s/%s: length, peak, finite, deterministic, soft edges',
    (sound, kind) => {
      for (const rate of [44100, 48000]) {
        const x = renderClick(kind, rate, sound);
        expect(x.length).toBe(Math.max(1, Math.round(CLICK_LENGTH_S[kind] * rate)));
        expect(x.length).toBeLessThanOrEqual(Math.round(CLICK_S * rate));
        expect(peakOf(x)).toBeCloseTo(PEAK[kind], 2);
        expect(x.every(Number.isFinite)).toBe(true);
        expect(renderClick(kind, rate, sound)).toEqual(x);
        expect(Math.abs(x[0])).toBeLessThanOrEqual(0.01);
        expect(Math.abs(x[x.length - 1])).toBeLessThanOrEqual(0.01 * peakOf(x));
      }
    }
  );

  it.each(CLICK_SOUNDS)('%s: accent > normal > sub peak', (sound) => {
    const [a, n, s] = KINDS.map((k) => peakOf(renderClick(k, RATE, sound)));
    expect(a).toBeGreaterThan(n);
    expect(n).toBeGreaterThan(s);
  });

  it('sounds differ from each other', () => {
    const hashes = CLICK_SOUNDS.map((s) => sha(renderClick('accent', RATE, s)));
    expect(new Set(hashes).size).toBe(CLICK_SOUNDS.length);
  });

  it('click output equals the pre-042 render, sample for sample', () => {
    const golden = {
      accent: '751513fd85c9d99a',
      normal: 'e5c16b1d3af628d9',
      sub: '6cd766aa3e8edc20'
    };
    for (const k of KINDS) {
      expect(sha(renderClick(k, RATE))).toBe(golden[k]);
      expect(sha(renderClick(k, RATE, 'click'))).toBe(golden[k]);
    }
  });

  it('an unknown sound falls back to click', () => {
    expect(renderClick('accent', RATE, 'gong' as never)).toEqual(renderClick('accent', RATE));
  });

  it('toClickSound maps non-members to click', () => {
    for (const s of CLICK_SOUNDS) expect(toClickSound(s)).toBe(s);
    for (const v of ['gong', '', 3, null, undefined, {}]) expect(toClickSound(v)).toBe('click');
  });

  it.each(CLICK_SOUNDS)('%s: invalid sample rate falls back to 48 000', (sound) => {
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(renderClick('accent', bad, sound).length).toBe(Math.round(0.03 * 48000));
    }
  });
});
