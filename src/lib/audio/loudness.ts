/** IEC 61672 A-weighting as a bilinear-transformed IIR cascade (R-04). Pure. */

interface Biquad {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a1: number;
  readonly a2: number;
}

/** Corner frequencies of the A-weighting curve in Hz (IEC 61672). */
const F1 = 20.598997;
const F2 = 107.65265;
const F3 = 737.86223;
const F4 = 12194.217;

const TWO_PI = 2 * Math.PI;

/** Bilinear transform of (n2 s² + n1 s + n0)/(d2 s² + d1 s + d0) at sample rate `fs`. */
function bilinear(
  n: readonly [number, number, number],
  d: readonly [number, number, number],
  fs: number
): Biquad {
  const k = 2 * fs;
  const [n2, n1, n0] = n;
  const [d2, d1, d0] = d;
  const nb0 = n2 * k * k + n1 * k + n0;
  const nb1 = -2 * n2 * k * k + 2 * n0;
  const nb2 = n2 * k * k - n1 * k + n0;
  const da0 = d2 * k * k + d1 * k + d0;
  const da1 = -2 * d2 * k * k + 2 * d0;
  const da2 = d2 * k * k - d1 * k + d0;
  return { b0: nb0 / da0, b1: nb1 / da0, b2: nb2 / da0, a1: da1 / da0, a2: da2 / da0 };
}

function sections(fs: number, w4Scale = 1): Biquad[] {
  // Pre-warp each corner so the digital poles land on the analog corner frequencies.
  const warp = (f: number): number => TWO_PI * ((fs / Math.PI) * Math.tan((Math.PI * f) / fs));
  const w1 = warp(F1);
  const w2 = warp(F2);
  const w3 = warp(F3);
  const w4 = warp(F4) * w4Scale;
  return [
    // s² / (s + w1)²
    bilinear([1, 0, 0], [1, 2 * w1, w1 * w1], fs),
    // s² / ((s + w2)(s + w3))
    bilinear([1, 0, 0], [1, w2 + w3, w2 * w3], fs),
    // w4² / (s + w4)²  (the w4² numerator constant is part of the gain normalisation below)
    bilinear([0, 0, w4 * w4], [1, 2 * w4, w4 * w4], fs)
  ];
}

/** Magnitude of the cascade at `freq`. */
function magnitude(cascade: readonly Biquad[], freq: number, fs: number): number {
  const w = (TWO_PI * freq) / fs;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  let mag = 1;
  for (const q of cascade) {
    const nr = q.b0 + q.b1 * c1 + q.b2 * c2;
    const ni = -(q.b1 * s1 + q.b2 * s2);
    const dr = 1 + q.a1 * c1 + q.a2 * c2;
    const di = -(q.a1 * s1 + q.a2 * s2);
    mag *= Math.hypot(nr, ni) / Math.hypot(dr, di);
  }
  return mag;
}

/** Analog IEC 61672 A-weighting magnitude (linear, normalised to 1 at 1 kHz). */
function analogMagnitude(f: number): number {
  const ra = (f: number): number => {
    const f2 = f * f;
    return (
      (F4 * F4 * f2 * f2) /
      ((f2 + F1 * F1) * Math.sqrt((f2 + F2 * F2) * (f2 + F3 * F3)) * (f2 + F4 * F4))
    );
  };
  return ra(f) / ra(1000);
}

/** Frequency at which the digital curve is trimmed to the analog one (the bilinear transform sags near Nyquist). */
const TRIM_HZ = 10000;

const cache = new Map<number, { cascade: Biquad[]; gain: number }>();

function design(fs: number): { cascade: Biquad[]; gain: number } {
  let d = cache.get(fs);
  if (!d) {
    let cascade = sections(fs);
    if (fs / 2 > 1.2 * TRIM_HZ) {
      // Trim the top pole so the response at TRIM_HZ matches the analog curve (bisection).
      const target = analogMagnitude(TRIM_HZ);
      const level = (c: readonly Biquad[]): number =>
        magnitude(c, TRIM_HZ, fs) / magnitude(c, 1000, fs);
      let lo = 0.5;
      let hi = 2;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        if (level(sections(fs, mid)) < target) lo = mid;
        else hi = mid;
      }
      cascade = sections(fs, (lo + hi) / 2);
    }
    // The A curve is defined as 0 dB at 1 kHz.
    d = { cascade, gain: 1 / magnitude(cascade, 1000, fs) };
    cache.set(fs, d);
  }
  return d;
}

/**
 * RMS of the A-weighted signal over its first `windowSamples` samples.
 * The filter starts from zero state. Returns 0 for an empty window.
 */
export function aWeightedRms(
  samples: Float32Array,
  sampleRate: number,
  windowSamples: number
): number {
  const n = Math.min(samples.length, Math.max(0, Math.floor(windowSamples)));
  if (n === 0 || !(sampleRate > 0)) return 0;
  const { cascade, gain } = design(sampleRate);
  const state = cascade.map(() => [0, 0]); // direct form II transposed: z1, z2
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let x = samples[i];
    for (let s = 0; s < cascade.length; s++) {
      const q = cascade[s];
      const z = state[s];
      const y = q.b0 * x + z[0];
      z[0] = q.b1 * x - q.a1 * y + z[1];
      z[1] = q.b2 * x - q.a2 * y;
      x = y;
    }
    const v = x * gain;
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}
