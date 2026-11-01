/**
 * Run cycle (034, contracts/click-engine-api.md §1). Pure and framework-free: maps run-global
 * slot and click indices to phases of `initial count-in → (Loop 1, Repeat, Loop 2, Repeat)*`
 * with integer arithmetic only, so no drift can build up however long a run lasts.
 */
import type { ClickKind } from './click';

export interface RunPlan {
  readonly beats: number;
  readonly initial: number;
  readonly loops: readonly [number] | readonly [number, number];
  readonly repeat: number;
}

export type CyclePhase = 'initial' | 'repeat' | 'loop1' | 'loop2';

export type SlotPosition =
  | {
      readonly kind: 'count-in';
      readonly slot: number;
      readonly click: number;
      readonly total: number;
      readonly repeat: boolean;
      readonly next: 1 | 2;
      /** Speed Training only (037): present on slots of a ramp run. */
      readonly ramp?: { readonly step: number; readonly steps: number; readonly bpm: number };
    }
  | {
      readonly kind: 'beat';
      readonly slot: number;
      readonly beat: number;
      readonly loop: 1 | 2;
      readonly clicksPerBeat: number;
      /** Speed Training only (037): present on slots of a ramp run. */
      readonly ramp?: {
        readonly step: number;
        readonly steps: number;
        readonly loop: number;
        readonly loops: number;
        readonly hold: boolean;
        readonly bpm: number;
      };
    };

export interface CycleClick {
  readonly index: number;
  readonly slot: number;
  readonly sub: number;
  readonly phase: CyclePhase;
  readonly kind: ClickKind;
  readonly position: SlotPosition;
}

export interface PlanInput {
  readonly beats: number;
  readonly clicksPerBeat: number;
  readonly initialCountIn?: number;
  readonly alternate?: { readonly clicksPerBeat: number; readonly repeatCountIn: number };
}

const int = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback;

/** Validates a plan input; invalid fields fall back (C1). Never throws. */
export function toRunPlan(input: PlanInput): RunPlan {
  const n1 = int(input.clicksPerBeat, 1, 8, 1);
  const beats = int(input.beats, 1, 16, 1);
  const initial = int(input.initialCountIn, 0, 8, 0);
  const alt = input.alternate;
  if (!alt) return { beats, initial, loops: [n1], repeat: 0 };
  return {
    beats,
    initial,
    loops: [n1, int(alt.clicksPerBeat, 1, 8, 1)],
    repeat: int(alt.repeatCountIn, 0, 8, 0)
  };
}

interface PhaseDef {
  readonly phase: 'loop1' | 'loop2' | 'repeat';
  /** 0 for the first repeat of a cycle, 1 for the second. */
  readonly which: 0 | 1;
  readonly slots: number;
  readonly perSlot: number;
  readonly slot0: number;
  readonly click0: number;
}

interface Layout {
  readonly phases: readonly PhaseDef[];
  readonly S: number;
  readonly C: number;
}

const layouts = new WeakMap<RunPlan, Layout>();

function layoutOf(plan: RunPlan): Layout {
  let l = layouts.get(plan);
  if (l) return l;
  const { beats, loops, repeat } = plan;
  const raw: Omit<PhaseDef, 'slot0' | 'click0'>[] = [
    { phase: 'loop1', which: 0, slots: beats, perSlot: loops[0] }
  ];
  if (loops.length === 2) {
    raw.push({ phase: 'repeat', which: 0, slots: repeat, perSlot: 1 });
    raw.push({ phase: 'loop2', which: 0, slots: beats, perSlot: loops[1] });
    raw.push({ phase: 'repeat', which: 1, slots: repeat, perSlot: 1 });
  }
  const phases: PhaseDef[] = [];
  let S = 0;
  let C = 0;
  for (const p of raw) {
    if (p.slots === 0) continue;
    phases.push({ ...p, slot0: S, click0: C });
    S += p.slots;
    C += p.slots * p.perSlot;
  }
  l = { phases, S, C };
  layouts.set(plan, l);
  return l;
}

/** Slots per cycle. */
export const cycleSlots = (plan: RunPlan): number => layoutOf(plan).S;
/** Clicks per cycle. */
export const cycleClicks = (plan: RunPlan): number => layoutOf(plan).C;

function positionIn(plan: RunPlan, p: PhaseDef, slot: number, offset: number): SlotPosition {
  if (p.phase === 'repeat') {
    return {
      kind: 'count-in',
      slot,
      click: offset + 1,
      total: plan.repeat,
      repeat: true,
      next: p.which === 0 ? 2 : 1
    };
  }
  return {
    kind: 'beat',
    slot,
    beat: offset + 1,
    loop: p.phase === 'loop1' ? 1 : 2,
    clicksPerBeat: p.perSlot
  };
}

function initialPosition(plan: RunPlan, slot: number): SlotPosition {
  return {
    kind: 'count-in',
    slot,
    click: slot + 1,
    total: plan.initial,
    repeat: false,
    next: 1
  };
}

/** Position of run-global slot `slot` (negative or fractional input floors to a valid slot ≥ 0). */
export function slotAt(plan: RunPlan, slot: number): SlotPosition {
  const s = Math.max(0, Math.floor(slot));
  if (s < plan.initial) return initialPosition(plan, s);
  const { phases, S } = layoutOf(plan);
  const w = (s - plan.initial) % S;
  let p = phases[0];
  for (const ph of phases) if (w >= ph.slot0) p = ph;
  return positionIn(plan, p, s, w - p.slot0);
}

/** Index of the first click of slot `slot`. */
export function slotStart(plan: RunPlan, slot: number): number {
  const s = Math.max(0, Math.floor(slot));
  if (s < plan.initial) return s;
  const { phases, S, C } = layoutOf(plan);
  const q = s - plan.initial;
  const cycle = Math.floor(q / S);
  const w = q % S;
  let p = phases[0];
  for (const ph of phases) if (w >= ph.slot0) p = ph;
  return plan.initial + cycle * C + p.click0 + (w - p.slot0) * p.perSlot;
}

/** Click `index` of the run. */
export function clickAt(plan: RunPlan, index: number): CycleClick {
  const c = Math.max(0, Math.floor(index));
  if (c < plan.initial) {
    return {
      index: c,
      slot: c,
      sub: 0,
      phase: 'initial',
      kind: 'accent',
      position: initialPosition(plan, c)
    };
  }
  const { phases, C, S } = layoutOf(plan);
  const q = c - plan.initial;
  const cycle = Math.floor(q / C);
  const w = q % C;
  let p = phases[0];
  for (const ph of phases) if (w >= ph.click0) p = ph;
  const j = w - p.click0;
  const offset = Math.floor(j / p.perSlot);
  const sub = j % p.perSlot;
  const slot = plan.initial + cycle * S + p.slot0 + offset;
  const kind: ClickKind =
    p.phase === 'repeat' ? 'accent' : sub !== 0 ? 'sub' : offset === 0 ? 'accent' : 'normal';
  return {
    index: c,
    slot,
    sub,
    phase: p.phase,
    kind,
    position: positionIn(plan, p, slot, offset)
  };
}
