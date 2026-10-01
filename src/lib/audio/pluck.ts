/**
 * Extended Karplus-Strong plucked-string synth (R-01, R-02, R-04, R-05). Pure TypeScript, no DOM.
 * Every render is deterministic: seeded excitation (seed = pitch), no Math.random.
 */
import { frequencyOf } from '../theory/pitch';
import { aWeightedRms } from './loudness';
import { mulberry32 } from './prng';
import type { Synth } from './types';

const LOWEST_PITCH = 33; // A1
const HIGHEST_PITCH = 88; // E6
const PICK_POSITION = 0.13;
const FADE_IN_S = 0.002;
const FADE_OUT_S = 0.01;
const NORMALISE_WINDOW_S = 0.5;
const TARGET_DBFS = -18;
const T60_LOW_S = 4;
const T60_HIGH_S = 1.2;
const STRETCH_LOW = 0.9; // decay stretch S at A1 …
const STRETCH_HIGH = 0.5; // … falling to E6
const MAX_LOOP_GAIN = 0.9999;

/** 0 at A1 → 1 at E6, clamped, so out-of-range pitches reuse the edge timbre. */
function timbreAxis(pitch: number): number {
  const t = (pitch - LOWEST_PITCH) / (HIGHEST_PITCH - LOWEST_PITCH);
  return Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
}

/** Magnitude of y = (1 − S)·x[n] + S·x[n − 1] at angular frequency w. */
function lossMagnitude(stretch: number, w: number): number {
  return Math.hypot(1 - stretch + stretch * Math.cos(w), stretch * Math.sin(w));
}

/** Phase delay (samples) of the two-point loss filter at angular frequency w. */
function lossPhaseDelay(stretch: number, w: number): number {
  return Math.atan2(stretch * Math.sin(w), 1 - stretch + stretch * Math.cos(w)) / w;
}

/** Phase delay (samples) of y[n] = η·x[n] + x[n − 1] − η·y[n − 1] at angular frequency w. */
function allPassPhaseDelay(eta: number, w: number): number {
  const phase =
    Math.atan2(-Math.sin(w), eta + Math.cos(w)) -
    Math.atan2(-eta * Math.sin(w), 1 + eta * Math.cos(w));
  // Unwrap into (−2π, 0], delay = −phase / w.
  let p = phase;
  while (p > 0) p -= 2 * Math.PI;
  while (p <= -2 * Math.PI) p += 2 * Math.PI;
  return -p / w;
}

/** Solve for the all-pass coefficient giving phase delay `d` at w (monotonic in η, bisection). */
function solveAllPass(d: number, w: number): number {
  let lo = -0.999;
  let hi = 0.999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    // Larger η → smaller delay.
    if (allPassPhaseDelay(mid, w) > d) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Raw (un-normalised, un-faded) string output of `length` samples. */
function renderRaw(pitch: number, sampleRate: number, length: number): Float32Array {
  const out = new Float32Array(length);
  if (length === 0) return out;

  const axis = timbreAxis(pitch);
  const f0 = frequencyOf(pitch);
  const w = (2 * Math.PI * f0) / sampleRate;
  const period = sampleRate / f0;

  const stretch = STRETCH_LOW + (STRETCH_HIGH - STRETCH_LOW) * axis;
  const lossDelay = lossPhaseDelay(stretch, w);

  // Integer delay line + fractional all-pass delay d ∈ [0.1, 1.1) sum with the loss delay to one period.
  const lineLength = Math.max(2, Math.floor(period - lossDelay - 0.1));
  const fractional = Math.min(1.1 - 1e-9, Math.max(0.1, period - lossDelay - lineLength));
  const eta = solveAllPass(fractional, w);

  // Loop gain targets T60 at the fundamental (log-interpolated from A1 to E6).
  const t60 = T60_LOW_S * Math.pow(T60_HIGH_S / T60_LOW_S, axis);
  const perLoop = Math.pow(10, -3 / (f0 * t60));
  const loopGain = Math.min(MAX_LOOP_GAIN, perLoop / lossMagnitude(stretch, w));

  // Excitation: seeded zero-mean noise, pick-position comb, one-pole low-pass with a bright floor.
  const rand = mulberry32(Math.round(pitch));
  const noise = new Float64Array(lineLength);
  let mean = 0;
  for (let i = 0; i < lineLength; i++) {
    noise[i] = rand() * 2 - 1;
    mean += noise[i];
  }
  mean /= lineLength;
  const pick = Math.max(1, Math.round(PICK_POSITION * lineLength));
  const comb = new Float64Array(lineLength);
  for (let i = 0; i < lineLength; i++)
    comb[i] = noise[i] - mean - (i >= pick ? noise[i - pick] - mean : 0);
  const cutoff = Math.min(0.4 * sampleRate, Math.max(8 * f0, 2000 + 2 * f0));
  const a = Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  const line = new Float64Array(lineLength);
  let prev = 0;
  for (let i = 0; i < lineLength; i++) {
    prev = (1 - a) * comb[i] + a * prev;
    line[i] = prev;
  }

  let index = 0;
  let lossPrev = 0;
  let apX = 0;
  let apY = 0;
  for (let n = 0; n < length; n++) {
    const x = line[index];
    out[n] = x;
    const lossOut = (1 - stretch) * x + stretch * lossPrev;
    lossPrev = x;
    const apOut = eta * lossOut + apX - eta * apY;
    apX = lossOut;
    apY = apOut;
    line[index] = loopGain * apOut;
    index = index + 1 === lineLength ? 0 : index + 1;
  }
  return out;
}

function applyFadeIn(x: Float32Array, sampleRate: number): void {
  const fadeIn = Math.min(x.length, Math.max(1, Math.round(FADE_IN_S * sampleRate)));
  for (let i = 0; i < fadeIn; i++) x[i] *= i / fadeIn;
}

function applyFades(x: Float32Array, sampleRate: number): void {
  const n = x.length;
  applyFadeIn(x, sampleRate);
  const fadeOut = Math.min(n, Math.max(1, Math.round(FADE_OUT_S * sampleRate)));
  for (let i = 0; i < fadeOut; i++) x[n - 1 - i] *= i / fadeOut;
}

const gainCache = new Map<string, number>();

/** Gain that brings the A-weighted RMS of the first 500 ms to −18 dBFS; independent of render length. */
function normalisationGain(pitch: number, sampleRate: number): number {
  const key = `${pitch}@${sampleRate}`;
  let g = gainCache.get(key);
  if (g === undefined) {
    const window = Math.round(NORMALISE_WINDOW_S * sampleRate);
    const ref = renderRaw(pitch, sampleRate, window);
    // Only the fade-in lies inside the 500 ms window; the tail fade is beyond it for any real note.
    applyFadeIn(ref, sampleRate);
    const rms = aWeightedRms(ref, sampleRate, window);
    g = rms > 0 ? Math.pow(10, TARGET_DBFS / 20) / rms : 1;
    gainCache.set(key, g);
  }
  return g;
}

function renderVoice(pitch: number, sampleRate: number, lengthSamples: number): Float32Array {
  const length = Math.max(0, Math.floor(lengthSamples));
  const x = renderRaw(pitch, sampleRate, length);
  const g = normalisationGain(pitch, sampleRate);
  for (let i = 0; i < length; i++) x[i] *= g;
  applyFades(x, sampleRate);
  return x;
}

/** mixVoices arrives with US6 (T052); until then a single voice is passed through. */
function mixVoices(voices: readonly Float32Array[]): Float32Array {
  return voices.length > 0 ? voices[0] : new Float32Array(0);
}

export const pluckSynth: Synth = { renderVoice, mixVoices };
