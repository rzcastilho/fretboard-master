/** Pure click synthesis (031, contracts/click-engine-api.md §1). No framework imports. */

export type ClickKind = 'accent' | 'normal';

/** Tick length in seconds. */
export const CLICK_S = 0.03;

const ATTACK_S = 0.001;
const END_LEVEL = 0.005;

const SHAPE: Record<ClickKind, { readonly hz: number; readonly peak: number }> = {
  accent: { hz: 1600, peak: 0.9 },
  normal: { hz: 1000, peak: 0.55 }
};

/** A sine burst: 1 ms linear attack, exponential decay to 0.5 % at the end, scaled to its peak. */
export function renderClick(kind: ClickKind, sampleRate: number): Float32Array {
  const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 48000;
  const length = Math.max(1, Math.round(CLICK_S * rate));
  const out = new Float32Array(length);
  const { hz, peak } = SHAPE[kind];
  let max = 0;
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    const attack = Math.min(1, t / ATTACK_S);
    const decay = t <= ATTACK_S ? 1 : END_LEVEL ** ((t - ATTACK_S) / (CLICK_S - ATTACK_S));
    const v = Math.sin(2 * Math.PI * hz * t) * attack * decay;
    out[i] = v;
    max = Math.max(max, Math.abs(v));
  }
  const scale = max > 0 ? peak / max : 0;
  for (let i = 0; i < length; i++) out[i] *= scale;
  return out;
}
