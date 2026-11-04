/** Pure click synthesis (031, contracts/click-engine-api.md §1). No framework imports. */

import { mulberry32 } from './prng';

export type ClickKind = 'accent' | 'normal' | 'sub';

/** 042: the selectable click timbres, in the order the select lists them. */
export const CLICK_SOUNDS = ['click', 'wood', 'beep', 'rim', 'cowbell'] as const;
export type ClickSound = (typeof CLICK_SOUNDS)[number];
export const DEFAULT_CLICK_SOUND: ClickSound = 'click';

/** Any non-member (including non-strings) maps to the default sound. */
export function toClickSound(v: unknown): ClickSound {
  return (CLICK_SOUNDS as readonly unknown[]).includes(v) ? (v as ClickSound) : DEFAULT_CLICK_SOUND;
}

/** Tick length per kind in seconds; the soft subdivision tick is shorter so 32nds at 300 BPM stay apart. */
export const CLICK_LENGTH_S: Readonly<Record<ClickKind, number>> = {
  accent: 0.03,
  normal: 0.03,
  sub: 0.018
};

/** Longest tick length: how long a scheduled source may still be sounding. */
export const CLICK_S = 0.03;

const ATTACK_S = 0.001;
const END_LEVEL = 0.005;

const SHAPE: Record<ClickKind, { readonly hz: number; readonly peak: number }> = {
  accent: { hz: 1600, peak: 0.9 },
  normal: { hz: 1000, peak: 0.55 },
  sub: { hz: 2400, peak: 0.25 }
};

const TWO_PI = 2 * Math.PI;

/** Per-sound tone pitches (Hz) per kind; `rim` and `cowbell` use them as described in research R-7. */
const WOOD_HZ: Record<ClickKind, number> = { accent: 1200, normal: 800, sub: 1600 };
const WOOD_PARTIAL: Record<ClickKind, number> = { accent: 0.5, normal: 0.5, sub: 0.4 };
const BEEP_HZ: Record<ClickKind, number> = { accent: 1760, normal: 880, sub: 1320 };
const RIM_HZ: Record<ClickKind, number> = { accent: 2000, normal: 1700, sub: 2600 };
const COWBELL_HZ: Record<ClickKind, readonly [number, number]> = {
  accent: [587, 870],
  normal: [540, 800],
  sub: [800, 1185]
};
const KIND_SEED: Record<ClickKind, number> = { accent: 1, normal: 2, sub: 3 };

/** Exponential decay reaching END_LEVEL at `endS`, after a linear attack. */
function expEnv(t: number, attackS: number, endS: number): number {
  if (t >= endS) return 0;
  const attack = Math.min(1, t / attackS);
  const decay = t <= attackS ? 1 : END_LEVEL ** ((t - attackS) / (endS - attackS));
  return attack * decay;
}

/** Odd-harmonic sum approximating a square wave (3 harmonics), softer than a true square. */
const softSquare = (hz: number, t: number): number =>
  Math.sin(TWO_PI * hz * t) + Math.sin(TWO_PI * 3 * hz * t) / 3 + Math.sin(TWO_PI * 5 * hz * t) / 5;

type Voice = (i: number, t: number) => number;

function voiceFor(sound: ClickSound, kind: ClickKind, lengthS: number): Voice {
  switch (sound) {
    case 'wood': {
      const hz = WOOD_HZ[kind];
      const k = WOOD_PARTIAL[kind];
      return (_i, t) =>
        (Math.sin(TWO_PI * hz * t) + k * Math.sin(TWO_PI * hz * 2.76 * t)) *
        expEnv(t, 0.0005, lengthS * 0.6);
    }
    case 'beep': {
      const hz = BEEP_HZ[kind];
      return (_i, t) => {
        const attack = Math.min(1, t / 0.002);
        const release = Math.min(1, Math.max(0, (lengthS - t) / 0.004));
        return (Math.sin(TWO_PI * hz * t) + 0.2 * Math.sin(TWO_PI * 3 * hz * t)) * attack * release;
      };
    }
    case 'rim': {
      const hz = RIM_HZ[kind];
      const rnd = mulberry32(0x5eed0000 + KIND_SEED[kind]);
      let prev = 0;
      return (_i, t) => {
        const white = rnd() * 2 - 1;
        const high = white - prev;
        prev = white;
        return (
          (0.7 * high * 0.5 + 0.3 * Math.sin(TWO_PI * hz * t)) * expEnv(t, 0.0003, lengthS * 0.4)
        );
      };
    }
    case 'cowbell': {
      const [a, b] = COWBELL_HZ[kind];
      return (_i, t) => (softSquare(a, t) + softSquare(b, t)) * expEnv(t, 0.001, lengthS);
    }
    default: {
      const hz = SHAPE[kind].hz;
      // Same operation order as the pre-042 renderer, so the output is identical sample for sample.
      return (_i, t) => {
        const attack = Math.min(1, t / ATTACK_S);
        const decay = t <= ATTACK_S ? 1 : END_LEVEL ** ((t - ATTACK_S) / (lengthS - ATTACK_S));
        return Math.sin(2 * Math.PI * hz * t) * attack * decay;
      };
    }
  }
}

/**
 * One click burst of the given timbre (042): per-kind length, peak-normalised to the kind's
 * peak (accent 0.9 > normal 0.55 > sub 0.25). `click` is the original sine burst; the others use
 * the seeded `mulberry32` only, so every render is deterministic.
 */
export function renderClick(
  kind: ClickKind,
  sampleRate: number,
  sound: ClickSound = DEFAULT_CLICK_SOUND
): Float32Array {
  const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 48000;
  const lengthS = CLICK_LENGTH_S[kind];
  const length = Math.max(1, Math.round(lengthS * rate));
  const out = new Float32Array(length);
  const { peak } = SHAPE[kind];
  const voice = voiceFor(toClickSound(sound), kind, lengthS);
  let max = 0;
  for (let i = 0; i < length; i++) {
    const v = voice(i, i / rate);
    out[i] = v;
    max = Math.max(max, Math.abs(v));
  }
  const scale = max > 0 ? peak / max : 0;
  for (let i = 0; i < length; i++) out[i] *= scale;
  return out;
}
