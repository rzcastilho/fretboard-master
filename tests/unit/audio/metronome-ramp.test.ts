import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  rampClickAt,
  rampOffset,
  rampSlotAt,
  rampSlotFloor,
  toRampPlan,
  type RampInput
} from '../../../src/lib/audio/metronome-ramp';

const range = (a: number, b: number, i: number): number[] => {
  const out: number[] = [];
  for (let v = a; v < b; v += i) out.push(v);
  out.push(b);
  return out;
};

const E2: RampInput = {
  bpms: range(80, 120, 5),
  loops: 4,
  repeatCountIn: 2,
  atTarget: 'stop'
};
const e2 = (o: Partial<RampInput> = {}) => toRampPlan(4, 4, 85, { ...E2, ...o });

describe('toRampPlan validation (E1)', () => {
  const bad: [string, unknown][] = [
    ['empty', []],
    ['too long', Array.from({ length: 272 }, (_, i) => 30 + (i % 271))],
    ['not increasing', [80, 80]],
    ['decreasing', [90, 80]],
    ['non-integer', [80.5, 90]],
    ['out of range low', [20, 90]],
    ['out of range high', [90, 301]]
  ];
  it.each(bad)('%s bpms give [bpm]', (_n, bpms) => {
    expect(toRampPlan(4, 4, 85, { ...E2, bpms: bpms as number[] }).bpms).toEqual([85]);
  });
  it('accepts the 271-step maximum', () => {
    const bpms = range(30, 300, 1);
    expect(bpms).toHaveLength(271);
    expect(toRampPlan(4, 0, 85, { ...E2, bpms }).bpms).toHaveLength(271);
  });
  it('falls back for loops and repeatCountIn and never throws', () => {
    expect(e2({ loops: 0 }).loops).toBe(1);
    expect(e2({ loops: 17 }).loops).toBe(1);
    expect(e2({ repeatCountIn: 9 }).repeat).toBe(0);
    expect(e2({ repeatCountIn: -1 }).repeat).toBe(0);
    expect(() => toRampPlan(NaN, NaN, NaN, {} as RampInput)).not.toThrow();
  });
});

describe('layout (E2)', () => {
  it('80→120/5, L=4, N=4, k=4, r=2 has 164 slots', () => {
    const p = e2();
    expect(p.tailSlot).toBe(164);
    expect(p.endSlot).toBe(164);
    expect(e2({ atTarget: 'hold' }).endSlot).toBeNull();
    expect(p.blocks).toHaveLength(9);
  });

  it('positions', () => {
    const p = e2();
    expect(rampSlotAt(p, 0)).toEqual({
      kind: 'count-in',
      slot: 0,
      click: 1,
      total: 4,
      repeat: false,
      next: 1,
      ramp: { step: 1, steps: 9, bpm: 80 }
    });
    expect(rampSlotAt(p, 4)).toEqual({
      kind: 'beat',
      slot: 4,
      beat: 1,
      loop: 1,
      clicksPerBeat: 1,
      ramp: { step: 1, steps: 9, loop: 1, loops: 4, hold: false, bpm: 80 }
    });
    expect(rampSlotAt(p, 4 + 7).kind).toBe('beat');
    expect(rampSlotAt(p, 4 + 7)).toMatchObject({ beat: 4, ramp: { loop: 2 } });
    // repeat count-in after step 1 (old tempo, announcing step 2)
    expect(rampSlotAt(p, 20)).toEqual({
      kind: 'count-in',
      slot: 20,
      click: 1,
      total: 2,
      repeat: true,
      next: 1,
      ramp: { step: 2, steps: 9, bpm: 80 }
    });
    expect(rampSlotAt(p, 22)).toMatchObject({ kind: 'beat', beat: 1, ramp: { step: 2, bpm: 85 } });
    // last step has no repeat count-in
    expect(rampSlotAt(p, 163)).toMatchObject({ kind: 'beat', beat: 4, ramp: { step: 9, loop: 4 } });
    // tail
    expect(rampSlotAt(p, 164)).toEqual({
      kind: 'beat',
      slot: 164,
      beat: 1,
      loop: 1,
      clicksPerBeat: 1,
      ramp: { step: 9, steps: 9, loop: 0, loops: 4, hold: true, bpm: 120 }
    });
    expect(rampSlotAt(p, 169)).toMatchObject({ beat: 2 });
  });

  it('click kinds: accents on count-ins and beat 1, never sub', () => {
    const p = e2({ atTarget: 'hold' });
    for (let s = 0; s < 200; s++) {
      const c = rampClickAt(p, s);
      const pos = c.position;
      expect(c.sub).toBe(0);
      expect(c.kind).not.toBe('sub');
      expect(c.index).toBe(s);
      expect(c.kind).toBe(pos.kind === 'count-in' || pos.beat === 1 ? 'accent' : 'normal');
    }
    expect(rampClickAt(p, 0).phase).toBe('initial');
    expect(rampClickAt(p, 20).phase).toBe('repeat');
    expect(rampClickAt(p, 5).phase).toBe('loop1');
  });

  it('single-step ramp has no repeat count-in', () => {
    const p = toRampPlan(4, 2, 85, { bpms: [100], loops: 2, repeatCountIn: 2, atTarget: 'stop' });
    expect(p.tailSlot).toBe(2 + 8);
    for (let s = 0; s < 10; s++) expect(rampSlotAt(p, s).kind).toBe(s < 2 ? 'count-in' : 'beat');
  });
});

describe('exact times (E3, E4, E5)', () => {
  const spacing = (p: ReturnType<typeof e2>, upTo: number) => {
    for (let s = 0; s < upTo; s++) {
      const pos = rampSlotAt(p, s);
      const bpm = (pos.ramp as { bpm: number }).bpm;
      expect(rampOffset(p, s + 1) - rampOffset(p, s)).toBeCloseTo(60 / bpm, 9);
    }
  };

  it('spacing equals 60/bpm of the block holding the slot, count-ins at the old tempo', () => {
    const p = e2({ atTarget: 'hold' });
    spacing(p, 200);
    // last count-in click of block 0 -> first loop click of step 2: one old-tempo beat
    expect(rampOffset(p, 22) - rampOffset(p, 21)).toBeCloseTo(60 / 80, 9);
  });

  it('holds for random ramps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 299 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 16 }),
        fc.integer({ min: 1, max: 16 }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 8 }),
        (start, inc, loops, beats, k, r) => {
          const bpms = range(start, Math.min(300, start + inc * 3), inc);
          const p = toRampPlan(beats, k, 85, { bpms, loops, repeatCountIn: r, atTarget: 'hold' });
          spacing(p, p.tailSlot + 5);
        }
      )
    );
  });

  it('has no drift in the tail', () => {
    const p = e2({ atTarget: 'hold' });
    expect(rampOffset(p, p.tailSlot + 1e6)).toBe(p.tailT0 + 1e6 * (60 / 120));
  });

  it('rampSlotFloor inverts rampOffset', () => {
    const p = e2();
    for (let s = 0; s <= 180; s++) {
      expect(rampSlotFloor(p, rampOffset(p, s))).toBe(s);
      expect(rampSlotFloor(p, rampOffset(p, s) - 1e-6)).toBe(s - 1);
    }
    expect(rampSlotFloor(p, -0.5)).toBe(-1);
  });
});
