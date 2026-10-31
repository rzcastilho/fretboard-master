import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clickAt,
  cycleClicks,
  cycleSlots,
  slotAt,
  slotStart,
  toRunPlan,
  type RunPlan
} from '../../../src/lib/audio/metronome-cycle';

const plan = (over: Partial<RunPlan> = {}): RunPlan => ({
  beats: 4,
  initial: 4,
  loops: [3, 6],
  repeat: 2,
  ...over
});

/** Time of click `c` at `bpm`, with slot difference computed as an integer first. */
function when(p: RunPlan, bpm: number, c: number): number {
  const T = 60 / bpm;
  const k = clickAt(p, c);
  const n = k.position.kind === 'beat' ? k.position.clicksPerBeat : 1;
  return k.slot * T + (k.sub * T) / n;
}

describe('toRunPlan (C1)', () => {
  it('keeps valid input', () => {
    expect(
      toRunPlan({
        beats: 4,
        clicksPerBeat: 3,
        initialCountIn: 4,
        alternate: { clicksPerBeat: 6, repeatCountIn: 2 }
      })
    ).toEqual(plan());
  });

  it('clamps invalid values', () => {
    expect(
      toRunPlan({
        beats: 4,
        clicksPerBeat: 9,
        initialCountIn: 2.5,
        alternate: { clicksPerBeat: 0, repeatCountIn: 99 }
      })
    ).toEqual({ beats: 4, initial: 0, loops: [1, 1], repeat: 0 });
  });

  it('has no repeat without alternate', () => {
    expect(toRunPlan({ beats: 4, clicksPerBeat: 3, initialCountIn: 1 })).toEqual({
      beats: 4,
      initial: 1,
      loops: [3],
      repeat: 0
    });
  });
});

describe('table: 85 BPM, N 4, k 4, r 2, n1 3, n2 6', () => {
  const p = plan();
  it('has the expected cycle sizes', () => {
    expect(cycleSlots(p)).toBe(12);
    expect(cycleClicks(p)).toBe(12 + 24 + 4);
  });

  it('lays out the slots', () => {
    const phases = Array.from({ length: 17 }, (_, s) => {
      const pos = slotAt(p, s);
      return pos.kind === 'beat' ? `L${pos.loop}b${pos.beat}` : `C${pos.click}/${pos.total}`;
    });
    expect(phases).toEqual([
      'C1/4', 'C2/4', 'C3/4', 'C4/4',
      'L1b1', 'L1b2', 'L1b3', 'L1b4',
      'C1/2', 'C2/2',
      'L2b1', 'L2b2', 'L2b3', 'L2b4',
      'C1/2', 'C2/2',
      'L1b1'
    ]); // prettier-ignore
  });

  it('counts clicks per phase', () => {
    const counts: Record<string, number> = {};
    for (let c = 0; c < 4 + 40; c++) {
      const ph = clickAt(p, c).phase;
      counts[ph] = (counts[ph] ?? 0) + 1;
    }
    expect(counts).toEqual({ initial: 4, loop1: 12, repeat: 4, loop2: 24 });
  });
});

describe('edge plans', () => {
  it('section off equals Loop 1 only', () => {
    const p = plan({ loops: [3], repeat: 0 });
    expect(cycleSlots(p)).toBe(4);
    expect(slotAt(p, 8)).toMatchObject({ kind: 'beat', beat: 1, loop: 1 });
    expect(clickAt(p, 4 + 12).phase).toBe('loop1');
  });

  it('Count In off', () => {
    const p = plan({ initial: 0, repeat: 0 });
    expect(slotAt(p, 0)).toMatchObject({ kind: 'beat', beat: 1, loop: 1 });
    expect(slotAt(p, 4)).toMatchObject({ kind: 'beat', beat: 1, loop: 2 });
  });

  it('r = 0 skips the repeat phase', () => {
    const p = plan({ repeat: 0 });
    expect(cycleSlots(p)).toBe(8);
    expect(slotAt(p, 4 + 4)).toMatchObject({ kind: 'beat', loop: 2, beat: 1 });
  });

  it('n1 = n2 still alternates with repeat count-ins', () => {
    const p = plan({ loops: [4, 4] });
    expect(slotAt(p, 8)).toMatchObject({ kind: 'count-in', repeat: true });
    expect(slotAt(p, 10)).toMatchObject({ kind: 'beat', loop: 2 });
  });

  it('N = 1', () => {
    const p = plan({ beats: 1 });
    const seq = [4, 5, 6, 7, 8].map((s) => {
      const pos = slotAt(p, s);
      return pos.kind === 'beat' ? `L${pos.loop}` : 'C';
    });
    expect(seq).toEqual(['L1', 'C', 'C', 'L2', 'C']);
  });
});

describe('kinds (C4) and flags (C6)', () => {
  const p = plan({ initial: 1 });
  it('assigns accent/normal/sub', () => {
    const kinds = Array.from({ length: 8 }, (_, i) => clickAt(p, 1 + i).kind);
    expect(kinds).toEqual(['accent', 'sub', 'sub', 'normal', 'sub', 'sub', 'normal', 'sub']);
    expect(clickAt(p, 0).kind).toBe('accent');
    for (let c = 1 + 12; c < 1 + 14; c++) expect(clickAt(p, c).kind).toBe('accent');
  });

  it('sets repeat and next', () => {
    expect(slotAt(p, 0)).toMatchObject({ repeat: false, next: 1 });
    expect(slotAt(p, 1 + 4)).toMatchObject({ repeat: true, next: 2 });
    expect(slotAt(p, 1 + 4 + 2 + 4)).toMatchObject({ repeat: true, next: 1 });
  });
});

describe('round trip (C5)', () => {
  it('slotStart/clickAt/slotAt agree', () => {
    const p = plan();
    for (let s = 0; s < 60; s++) {
      const c = clickAt(p, slotStart(p, s));
      expect(c.slot).toBe(s);
      expect(c.sub).toBe(0);
      expect(slotAt(p, s)).toEqual(c.position);
    }
  });
});

describe('properties', () => {
  const planArb = fc.record({
    beats: fc.integer({ min: 1, max: 16 }),
    initial: fc.integer({ min: 0, max: 8 }),
    n1: fc.integer({ min: 1, max: 8 }),
    n2: fc.integer({ min: 1, max: 8 }),
    repeat: fc.integer({ min: 0, max: 8 }),
    bpm: fc.integer({ min: 30, max: 300 }),
    on: fc.boolean()
  });
  const build = (a: {
    beats: number;
    initial: number;
    n1: number;
    n2: number;
    repeat: number;
    on: boolean;
  }): RunPlan =>
    a.on
      ? { beats: a.beats, initial: a.initial, loops: [a.n1, a.n2], repeat: a.repeat }
      : { beats: a.beats, initial: a.initial, loops: [a.n1], repeat: 0 };

  it('slot starts are T apart across every boundary', () => {
    fc.assert(
      fc.property(planArb, (a) => {
        const p = build(a);
        const T = 60 / a.bpm;
        const n = a.initial + cycleSlots(p) * 3 + 2;
        for (let s = 0; s < n; s++) {
          const d = when(p, a.bpm, slotStart(p, s + 1)) - when(p, a.bpm, slotStart(p, s));
          if (Math.abs(d - T) > 1e-9) return false;
        }
        return true;
      })
    );
  });

  it('click times strictly increase', () => {
    fc.assert(
      fc.property(planArb, (a) => {
        const p = build(a);
        const n = a.initial + cycleClicks(p) * 2 + 2;
        for (let c = 0; c < n; c++) {
          if (!(when(p, a.bpm, c + 1) > when(p, a.bpm, c))) return false;
        }
        return true;
      })
    );
  });

  it('slot k + m·S is Loop 1 beat 1 for m ≤ 100', () => {
    fc.assert(
      fc.property(planArb, fc.integer({ min: 0, max: 100 }), (a, m) => {
        const p = build(a);
        const pos = slotAt(p, a.initial + m * cycleSlots(p));
        return pos.kind === 'beat' && pos.beat === 1 && pos.loop === 1;
      })
    );
  });

  it('section off equals the 033 sequence after the prefix', () => {
    fc.assert(
      fc.property(planArb, (a) => {
        const p = build({ ...a, on: false });
        for (let j = 0; j < p.beats * a.n1 * 3; j++) {
          const c = clickAt(p, a.initial + j);
          const slot = Math.floor(j / a.n1);
          const beat = (slot % p.beats) + 1;
          const kind = j % a.n1 !== 0 ? 'sub' : beat === 1 ? 'accent' : 'normal';
          if (c.kind !== kind || c.phase !== 'loop1' || c.slot !== a.initial + slot) return false;
        }
        return true;
      })
    );
  });
});
