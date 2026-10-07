import { describe, expect, it } from 'vitest';
import {
  PINCH_IN_RATIO,
  PINCH_OUT_RATIO,
  reducePinch,
  type PinchEffect,
  type PinchState
} from '../../../src/lib/fretboard/pinch';

const two = (d: number) => [
  { x: 0, y: 0 },
  { x: d, y: 0 }
];
const touches = (points: readonly { x: number; y: number }[]) =>
  ({ type: 'touches', points }) as const;

function run(steps: ReadonlyArray<readonly { x: number; y: number }[]>): PinchEffect[] {
  let state: PinchState = { kind: 'idle' };
  const out: PinchEffect[] = [];
  for (const points of steps) {
    const r = reducePinch(state, touches(points));
    state = r.state;
    out.push(r.effect);
  }
  return out;
}

const pinches = (effects: PinchEffect[]) => effects.filter((e) => e.kind === 'pinch');

describe('reducePinch', () => {
  it('thresholds', () => {
    expect(PINCH_IN_RATIO).toBe(0.8);
    expect(PINCH_OUT_RATIO).toBe(1.25);
  });

  it('one finger never emits and stays idle', () => {
    let state: PinchState = { kind: 'idle' };
    for (const x of [0, 50, 300]) {
      const r = reducePinch(state, touches([{ x, y: 0 }]));
      expect(r.effect).toEqual({ kind: 'none' });
      expect(r.state).toEqual({ kind: 'idle' });
      state = r.state;
    }
  });

  it('two fingers closing to 79% emit one in; continuing emits nothing', () => {
    const effects = run([two(100), two(79), two(60), two(40)]);
    expect(pinches(effects)).toEqual([{ kind: 'pinch', direction: 'in' }]);
    expect(effects[1]).toEqual({ kind: 'pinch', direction: 'in' });
  });

  it('lift all, then a new pinch apart to 126% emits one out', () => {
    const effects = run([two(100), two(79), [], two(100), two(126)]);
    expect(pinches(effects)).toEqual([
      { kind: 'pinch', direction: 'in' },
      { kind: 'pinch', direction: 'out' }
    ]);
  });

  it('exactly the ratios trigger', () => {
    expect(pinches(run([two(100), two(80)]))).toHaveLength(1);
    expect(pinches(run([two(100), two(125)]))).toEqual([{ kind: 'pinch', direction: 'out' }]);
  });

  it('2 → 3 fingers resets without effect', () => {
    const three = [...two(100), { x: 50, y: 50 }];
    const r = reducePinch({ kind: 'tracking', start: 100 }, touches(three));
    expect(r.effect).toEqual({ kind: 'none' });
    expect(r.state).toEqual({ kind: 'idle' });
  });

  it('90% then back to 100% emits nothing', () => {
    expect(pinches(run([two(100), two(90), two(100)]))).toHaveLength(0);
  });

  it('done stays done with 1 or 3 fingers; resets only at 0', () => {
    const done: PinchState = { kind: 'done' };
    expect(reducePinch(done, touches([{ x: 0, y: 0 }])).state).toEqual(done);
    expect(reducePinch(done, touches([])).state).toEqual({ kind: 'idle' });
  });

  it('coincident fingers do not divide by zero', () => {
    const r = reducePinch({ kind: 'idle' }, touches(two(0)));
    expect(r.effect).toEqual({ kind: 'none' });
    expect(reducePinch(r.state, touches(two(10))).effect).toEqual({ kind: 'none' });
  });
});
