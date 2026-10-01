/**
 * Independent analysis helpers for synth tests (R-04, R-05, R-06).
 * Deliberately does not import src/lib/audio/loudness.ts.
 */

function hann(n: number, len: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (len - 1));
}

function zoomDftPower(
  x: Float32Array,
  start: number,
  len: number,
  freq: number,
  sr: number
): number {
  const w = (2 * Math.PI * freq) / sr;
  let re = 0;
  let im = 0;
  // Direct DFT bin at an arbitrary frequency (zoom DFT), Hann windowed.
  for (let n = 0; n < len; n++) {
    const v = x[start + n] * hann(n, len);
    const ph = w * n;
    re += v * Math.cos(ph);
    im -= v * Math.sin(ph);
  }
  return re * re + im * im;
}

/**
 * Estimate the fundamental in cents relative to `expectedHz`, window 0.1–1.1 s,
 * searching −30…+30 cents in 0.1-cent steps with parabolic refinement.
 * Returns the offset in cents.
 */
export function estimateCentsOffset(
  samples: Float32Array,
  sampleRate: number,
  expectedHz: number
): number {
  const start = Math.floor(0.1 * sampleRate);
  const len = Math.min(Math.floor(1.0 * sampleRate), samples.length - start);
  const step = 0.1;
  const n = Math.round(60 / step) + 1;
  const powers = new Float64Array(n);
  let best = 0;
  for (let i = 0; i < n; i++) {
    const cents = -30 + i * step;
    powers[i] = zoomDftPower(
      samples,
      start,
      len,
      expectedHz * Math.pow(2, cents / 1200),
      sampleRate
    );
    if (powers[i] > powers[best]) best = i;
  }
  let offset = 0;
  if (best > 0 && best < n - 1) {
    const a = powers[best - 1];
    const b = powers[best];
    const c = powers[best + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) offset = (0.5 * (a - c)) / denom;
  }
  return -30 + (best + offset) * step;
}

/** IEC 61672 A-weighting gain (linear amplitude) at frequency f. */
export function aWeightGain(f: number): number {
  const f2 = f * f;
  const ra =
    (12194 ** 2 * f2 * f2) /
    ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return ra * Math.pow(10, 2.0 / 20); // +2.00 dB normalisation at 1 kHz
}

function dft(x: Float32Array, len: number): { re: Float64Array; im: Float64Array } {
  // Radix-2 FFT after zero-padding to a power of two.
  let size = 1;
  while (size < len) size <<= 1;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < len; i++) re[i] = x[i];
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let l = 2; l <= size; l <<= 1) {
    const ang = (-2 * Math.PI) / l;
    for (let i = 0; i < size; i += l) {
      for (let k = 0; k < l / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + l / 2] * wr - im[i + k + l / 2] * wi;
        const vi = re[i + k + l / 2] * wi + im[i + k + l / 2] * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + l / 2] = ur - vr;
        im[i + k + l / 2] = ui - vi;
      }
    }
  }
  return { re, im };
}

/**
 * A-weighted RMS over the first `windowMs` ms, computed in the frequency domain
 * (Parseval, rectangular window). Returns linear RMS; use `toDb` for dB.
 */
export function aWeightedRmsDb(samples: Float32Array, sampleRate: number, windowMs = 500): number {
  const len = Math.min(samples.length, Math.floor((windowMs / 1000) * sampleRate));
  const { re, im } = dft(samples, len);
  const size = re.length;
  let sum = 0;
  for (let k = 1; k < size / 2; k++) {
    const f = (k * sampleRate) / size;
    const mag2 = re[k] * re[k] + im[k] * im[k];
    const g = aWeightGain(f);
    sum += 2 * mag2 * g * g;
  }
  // Parseval for a zero-padded transform: sum |x|^2 = (1/N) sum |X|^2; mean over `len` samples.
  const meanSquare = sum / size / len;
  return 10 * Math.log10(Math.max(meanSquare, 1e-30));
}

/** Energy above 1.5·f0 / total energy (DC removed), first 500 ms. */
export function harmonicShare(samples: Float32Array, sampleRate: number, f0: number): number {
  const len = Math.min(samples.length, Math.floor(0.5 * sampleRate));
  let mean = 0;
  for (let i = 0; i < len; i++) mean += samples[i];
  mean /= len;
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) x[i] = samples[i] - mean;
  const { re, im } = dft(x, len);
  const size = re.length;
  let total = 0;
  let upper = 0;
  for (let k = 1; k < size / 2; k++) {
    const f = (k * sampleRate) / size;
    const e = re[k] * re[k] + im[k] * im[k];
    total += e;
    if (f > 1.5 * f0) upper += e;
  }
  return total === 0 ? 0 : upper / total;
}
