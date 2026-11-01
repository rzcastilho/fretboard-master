/**
 * Tempo ramp layout (037, data-model §2, contracts/click-engine-api.md). Pure and
 * framework-free: maps run-global slot indices of a Speed Training run to positions, click
 * kinds and exact times. Block start times come from one prefix sum, so nothing drifts however
 * long a Hold tail lasts.
 */
import type { ClickKind } from './click';
import type { CycleClick, SlotPosition } from './metronome-cycle';

export interface RampInput {
  readonly bpms: readonly number[];
  readonly loops: number;
  readonly repeatCountIn: number;
  readonly atTarget: 'hold' | 'stop';
}

export interface RampBlock {
  readonly slot0: number;
  readonly t0: number;
  readonly period: number;
}

export interface RampPlan {
  readonly beats: number;
  readonly initial: number;
  readonly loops: number;
  readonly repeat: number;
  readonly bpms: readonly number[];
  readonly hold: boolean;
  readonly blocks: readonly RampBlock[];
  readonly tailSlot: number;
  readonly tailT0: number;
  readonly endSlot: number | null;
}

const MAX_STEPS = 271;

const int = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback;

function validBpms(bpms: unknown): bpms is readonly number[] {
  if (!Array.isArray(bpms) || bpms.length < 1 || bpms.length > MAX_STEPS) return false;
  for (let i = 0; i < bpms.length; i++) {
    const v: unknown = bpms[i];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 30 || v > 300) return false;
    if (i > 0 && v <= bpms[i - 1]) return false;
  }
  return true;
}

/** Validates a ramp; invalid fields fall back (E1). Never throws. */
export function toRampPlan(
  beats: number,
  initial: number,
  bpm: number,
  input: RampInput
): RampPlan {
  const N = int(beats, 1, 16, 1);
  const k = int(initial, 0, 8, 0);
  const safeBpm = int(bpm, 30, 300, 85);
  const bpms: readonly number[] = validBpms(input?.bpms) ? [...input.bpms] : [safeBpm];
  const L = int(input?.loops, 1, 16, 1);
  const r = int(input?.repeatCountIn, 0, 8, 0);
  const hold = input?.atTarget !== 'stop';
  const S = bpms.length;
  const LN = L * N;
  const blocks: RampBlock[] = [];
  let slot0 = 0;
  let t0 = 0;
  for (let b = 0; b < S; b++) {
    const period = 60 / bpms[b];
    blocks.push({ slot0, t0, period });
    const slots = (b === 0 ? k : 0) + LN + (b < S - 1 ? r : 0);
    slot0 += slots;
    t0 += slots * period;
  }
  return {
    beats: N,
    initial: k,
    loops: L,
    repeat: r,
    bpms,
    hold,
    blocks,
    tailSlot: slot0,
    tailT0: t0,
    endSlot: hold ? null : slot0
  };
}

const floorSlot = (slot: number): number =>
  Number.isFinite(slot) ? Math.max(0, Math.floor(slot)) : 0;

/** Index of the last block for which `before` holds (blocks are sorted; block 0 always counts). */
function lastBlock(blocks: readonly RampBlock[], before: (blk: RampBlock) => boolean): number {
  let lo = 0;
  let hi = blocks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (before(blocks[mid])) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const blockOf = (plan: RampPlan, slot: number): number =>
  lastBlock(plan.blocks, (blk) => blk.slot0 <= slot);

/** Position of slot `slot` (negative or fractional input floors to a valid slot ≥ 0). */
export function rampSlotAt(plan: RampPlan, slot: number): SlotPosition {
  const s = floorSlot(slot);
  const S = plan.bpms.length;
  const N = plan.beats;
  if (s >= plan.tailSlot) {
    return {
      kind: 'beat',
      slot: s,
      beat: ((s - plan.tailSlot) % N) + 1,
      loop: 1,
      clicksPerBeat: 1,
      ramp: { step: S, steps: S, loop: 0, loops: plan.loops, hold: true, bpm: plan.bpms[S - 1] }
    };
  }
  const b = blockOf(plan, s);
  let w = s - plan.blocks[b].slot0;
  if (b === 0) {
    if (w < plan.initial) {
      return {
        kind: 'count-in',
        slot: s,
        click: w + 1,
        total: plan.initial,
        repeat: false,
        next: 1,
        ramp: { step: 1, steps: S, bpm: plan.bpms[0] }
      };
    }
    w -= plan.initial;
  }
  const LN = plan.loops * N;
  if (w < LN) {
    return {
      kind: 'beat',
      slot: s,
      beat: (w % N) + 1,
      loop: 1,
      clicksPerBeat: 1,
      ramp: {
        step: b + 1,
        steps: S,
        loop: Math.floor(w / N) + 1,
        loops: plan.loops,
        hold: false,
        bpm: plan.bpms[b]
      }
    };
  }
  return {
    kind: 'count-in',
    slot: s,
    click: w - LN + 1,
    total: plan.repeat,
    repeat: true,
    next: 1,
    ramp: { step: b + 2, steps: S, bpm: plan.bpms[b] }
  };
}

/** Click `index` of the run (one click per slot). */
export function rampClickAt(plan: RampPlan, index: number): CycleClick {
  const slot = floorSlot(index);
  const position = rampSlotAt(plan, slot);
  const phase = position.kind === 'count-in' ? (position.repeat ? 'repeat' : 'initial') : 'loop1';
  const kind: ClickKind = position.kind === 'count-in' || position.beat === 1 ? 'accent' : 'normal';
  return { index: slot, slot, sub: 0, phase, kind, position };
}

/** Seconds from slot 0 to slot `slot`. */
export function rampOffset(plan: RampPlan, slot: number): number {
  const s = floorSlot(slot);
  if (s >= plan.tailSlot) {
    const period = plan.blocks[plan.blocks.length - 1].period;
    return plan.tailT0 + (s - plan.tailSlot) * period;
  }
  const blk = plan.blocks[blockOf(plan, s)];
  return blk.t0 + (s - blk.slot0) * blk.period;
}

/** The latest slot whose time is ≤ `seconds`; −1 before slot 0. */
export function rampSlotFloor(plan: RampPlan, seconds: number): number {
  if (!(seconds >= 0)) return -1;
  let c: number;
  if (seconds >= plan.tailT0) {
    const period = plan.blocks[plan.blocks.length - 1].period;
    c = plan.tailSlot + Math.floor((seconds - plan.tailT0) / period);
  } else {
    const blk = plan.blocks[lastBlock(plan.blocks, (x) => x.t0 <= seconds)];
    c = blk.slot0 + Math.floor((seconds - blk.t0) / blk.period);
  }
  // Correct float rounding at the edges so the result is exact against rampOffset.
  while (c > 0 && rampOffset(plan, c) > seconds) c--;
  while (rampOffset(plan, c + 1) <= seconds) c++;
  return c;
}
