import { describe, expect, it } from 'vitest';
import { applyPulses } from '../../../src/lib/fretboard/pulse';
import type { Marker, Pulse } from '../../../src/lib/fretboard/types';

const pulse = (id: number, string: number, fret: number, durationMs = 1500): Pulse => ({
  id,
  position: { string, fret },
  durationMs
});

describe('applyPulses', () => {
  it('keeps function and spelling of an existing marker and draws it highlighted with the pulse', () => {
    const markers: Marker[] = [
      {
        string: 2,
        fret: 1,
        function: 'third',
        emphasis: 'dimmed',
        spelling: { letter: 'E', accidental: 1 }
      }
    ];
    const out = applyPulses(markers, [pulse(7, 2, 1)]);
    expect(out).toEqual([
      {
        string: 2,
        fret: 1,
        function: 'third',
        emphasis: 'highlighted',
        spelling: { letter: 'E', accidental: 1 },
        pulse: { id: 7, durationMs: 1500 }
      }
    ]);
  });

  it('appends a transient neutral highlighted marker for a position without one', () => {
    const out = applyPulses([], [pulse(1, 6, 0)]);
    expect(out).toEqual([
      {
        string: 6,
        fret: 0,
        function: 'neutral',
        emphasis: 'highlighted',
        pulse: { id: 1, durationMs: 1500 }
      }
    ]);
  });

  it('first marker per position wins', () => {
    const markers: Marker[] = [
      { string: 1, fret: 1, function: 'root', emphasis: 'normal' },
      { string: 1, fret: 1, function: 'fifth', emphasis: 'normal' }
    ];
    const out = applyPulses(markers, [pulse(1, 1, 1)]);
    const at = out.filter((mk) => mk.string === 1 && mk.fret === 1);
    expect(at[0].function).toBe('root');
    expect(at[0].pulse?.id).toBe(1);
    expect(at.slice(1).every((mk) => mk.pulse === undefined)).toBe(true);
  });

  it('ignores invalid positions', () => {
    expect(applyPulses([], [pulse(1, 9, 0), pulse(2, 1, 99), pulse(3, 0, 0)])).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const markers: readonly Marker[] = Object.freeze([
      Object.freeze({ string: 2, fret: 1, function: 'root', emphasis: 'normal' } as Marker)
    ]);
    const pulses: readonly Pulse[] = Object.freeze([pulse(1, 2, 1), pulse(2, 3, 3)]);
    const snapshot = JSON.stringify([markers, pulses]);
    applyPulses(markers, pulses);
    expect(JSON.stringify([markers, pulses])).toBe(snapshot);
  });

  it('returns the input markers unchanged for empty pulses', () => {
    const markers: Marker[] = [{ string: 2, fret: 1, function: 'root', emphasis: 'normal' }];
    expect(applyPulses(markers, [])).toEqual(markers);
  });
});
