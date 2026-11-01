import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_SPEED_SETTINGS,
  METRONOME_MODES,
  atLimit,
  clampIncrement,
  clampLoops,
  speedRunPlan,
  speedSteps,
  stepSetting,
  toAtTarget,
  toMode,
  withStartBpm,
  withTargetBpm,
  type SpeedSettings
} from '../../../src/lib/state/metronome-settings';

const speed = (o: Partial<SpeedSettings>): SpeedSettings => ({ ...DEFAULT_SPEED_SETTINGS, ...o });

describe('speed training settings', () => {
  it('has frozen defaults and the tab order', () => {
    expect(DEFAULT_SPEED_SETTINGS).toEqual({
      startBpm: 85,
      targetBpm: 125,
      increment: 5,
      loops: 4,
      beats: 4,
      countIn: true,
      initialCountIn: 4,
      repeatCountIn: 2,
      atTarget: 'hold'
    });
    expect(Object.isFrozen(DEFAULT_SPEED_SETTINGS)).toBe(true);
    expect(METRONOME_MODES).toEqual(['plain', 'speed', 'ratios']);
  });

  it.each([
    [80, 120, 5, 9, undefined],
    [80, 102, 5, 6, [80, 85, 90, 95, 100, 102]],
    [290, 300, 20, 2, [290, 300]],
    [300, 300, 5, 1, [300]],
    [40, 300, 1, 261, undefined]
  ])('speedSteps %i→%i/%i gives %i steps', (s, t, i, n, exact) => {
    const steps = speedSteps(speed({ startBpm: s, targetBpm: t, increment: i }));
    expect(steps).toHaveLength(n);
    if (exact) expect(steps).toEqual(exact);
  });

  it('keeps the step-schedule invariants (SC-003)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 30, max: 300 }),
        fc.integer({ min: 1, max: 20 }),
        (a, b, increment) => {
          const startBpm = Math.min(a, b);
          const targetBpm = Math.max(a, b);
          const s = speedSteps(speed({ startBpm, targetBpm, increment }));
          expect(s[0]).toBe(startBpm);
          expect(s.at(-1)).toBe(targetBpm);
          expect(s.length).toBeLessThanOrEqual(271);
          for (let k = 0; k < s.length; k++) {
            expect(s[k]).toBeLessThanOrEqual(targetBpm);
            if (k > 0) expect(s[k]).toBeGreaterThan(s[k - 1]);
            if (k > 0 && k < s.length - 1) expect(s[k] - s[k - 1]).toBe(increment);
          }
          if (s.length > 1) {
            const last = s[s.length - 1] - s[s.length - 2];
            expect(last).toBeGreaterThanOrEqual(1);
            expect(last).toBeLessThanOrEqual(increment);
          }
          expect(s.length).toBe(
            targetBpm === startBpm ? 1 : Math.ceil((targetBpm - startBpm) / increment) + 1
          );
        }
      )
    );
  });

  it('withStartBpm / withTargetBpm keep Target at or above Start', () => {
    expect(withStartBpm(speed({ startBpm: 85, targetBpm: 125 }), 140)).toMatchObject({
      startBpm: 140,
      targetBpm: 140
    });
    expect(withStartBpm(speed({}), 100)).toMatchObject({ startBpm: 100, targetBpm: 125 });
    expect(withStartBpm(speed({}), 1000).startBpm).toBe(300);
    expect(withTargetBpm(speed({ startBpm: 85 }), 50).targetBpm).toBe(85);
    expect(withTargetBpm(speed({}), 400).targetBpm).toBe(300);
    expect(withTargetBpm(speed({}), NaN).targetBpm).toBe(85);
  });

  it('clamps increment and loops', () => {
    expect(clampIncrement(0)).toBe(1);
    expect(clampIncrement(25)).toBe(20);
    expect(clampIncrement(NaN)).toBe(1);
    expect(clampIncrement(4.6)).toBe(5);
    expect(clampLoops(0)).toBe(1);
    expect(clampLoops(99)).toBe(16);
    expect(clampLoops(NaN)).toBe(1);
  });

  it('atLimit and stepSetting for speed fields', () => {
    const s = speed({ startBpm: 100, targetBpm: 100 });
    expect(atLimit(s, 'targetBpm', -1)).toBe(true);
    expect(stepSetting(s, 'targetBpm', -1)).toBe(s);
    expect(stepSetting(s, 'targetBpm', 1).targetBpm).toBe(101);
    expect(stepSetting(s, 'startBpm', 1)).toMatchObject({ startBpm: 101, targetBpm: 101 });
    expect(atLimit(speed({ increment: 20 }), 'increment', 1)).toBe(true);
    expect(atLimit(speed({ increment: 1 }), 'increment', -1)).toBe(true);
    expect(atLimit(speed({ loops: 16 }), 'loops', 1)).toBe(true);
    expect(atLimit(speed({ loops: 1 }), 'loops', -1)).toBe(true);
    expect(stepSetting(speed({ loops: 4 }), 'loops', 1).loops).toBe(5);
    expect(stepSetting(speed({ increment: 20 }), 'increment', 1).increment).toBe(20);
    expect(atLimit(speed({ startBpm: 30 }), 'startBpm', -1)).toBe(true);
    expect(atLimit(speed({ targetBpm: 300 }), 'targetBpm', 1)).toBe(true);
    expect(stepSetting(speed({ startBpm: 85, targetBpm: 125 }), 'targetBpm', -1).targetBpm).toBe(
      124
    );
  });

  it('toMode accepts speed; toAtTarget', () => {
    expect(toMode('speed')).toBe('speed');
    expect(toMode('other')).toBeNull();
    expect(toAtTarget('hold')).toBe('hold');
    expect(toAtTarget('stop')).toBe('stop');
    expect(toAtTarget('x')).toBeNull();
    expect(toAtTarget(undefined)).toBeNull();
  });

  it('speedRunPlan', () => {
    expect(speedRunPlan(DEFAULT_SPEED_SETTINGS)).toEqual({
      clicksPerBeat: 1,
      initialCountIn: 4,
      ramp: {
        bpms: [85, 90, 95, 100, 105, 110, 115, 120, 125],
        loops: 4,
        repeatCountIn: 2,
        atTarget: 'hold'
      }
    });
    const off = speedRunPlan(speed({ countIn: false, atTarget: 'stop' }));
    expect(off.initialCountIn).toBe(0);
    expect(off.ramp.repeatCountIn).toBe(0);
    expect(off.ramp.atTarget).toBe('stop');
  });
});
