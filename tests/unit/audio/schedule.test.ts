import { describe, expect, it } from 'vitest';
import { clampBpm, planRequest } from '../../../src/lib/audio/schedule';
import { STANDARD_GUITAR, type Instrument } from '../../../src/lib/instrument/instrument';

const p = (string: number, fret: number) => ({ string, fret });

describe('clampBpm', () => {
  it.each([
    [29, 30],
    [30, 30],
    [120, 120],
    [300, 300],
    [301, 300],
    [NaN, 30],
    [Infinity, 300],
    [-Infinity, 30]
  ])('%f -> %f', (input, expected) => {
    expect(clampBpm(input)).toBe(expected);
  });
});

describe('planRequest', () => {
  it('note: one mark 0..1500', () => {
    const plan = planRequest({ kind: 'note', position: p(6, 0) }, STANDARD_GUITAR);
    expect(plan.marks).toEqual([{ position: p(6, 0), onsetMs: 0, endMs: 1500 }]);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].pitches).toEqual([40]);
  });

  it('chord: shared onset 0, end 1500, input order', () => {
    const plan = planRequest(
      { kind: 'chord', positions: [p(5, 3), p(4, 2), p(3, 0)] },
      STANDARD_GUITAR
    );
    expect(plan.marks.map((m) => [m.onsetMs, m.endMs])).toEqual([
      [0, 1500],
      [0, 1500],
      [0, 1500]
    ]);
    expect(plan.marks.map((m) => m.position)).toEqual([p(5, 3), p(4, 2), p(3, 0)]);
    expect(plan.steps).toHaveLength(1);
  });

  it('sequence: step i at i*60000/bpm, ends at next onset, last lasts one beat', () => {
    const plan = planRequest(
      { kind: 'sequence', steps: [p(6, 0), [p(5, 0), p(4, 0)], p(3, 0)], bpm: 120 },
      STANDARD_GUITAR
    );
    expect(plan.marks.map((m) => [m.onsetMs, m.endMs])).toEqual([
      [0, 500],
      [500, 1000],
      [500, 1000],
      [1000, 1500]
    ]);
    expect(plan.steps.map((s) => s.onsetMs)).toEqual([0, 500, 1000]);
  });

  it('sequence clamps bpm', () => {
    const plan = planRequest(
      { kind: 'sequence', steps: [p(6, 0), p(6, 1)], bpm: 1000 },
      STANDARD_GUITAR
    );
    expect(plan.marks[0].endMs).toBe(200);
  });

  it('drops invalid positions', () => {
    const plan = planRequest(
      { kind: 'chord', positions: [p(0, 0), p(6, 99), p(6, 1.5), p(6, 3)] },
      STANDARD_GUITAR
    );
    expect(plan.marks.map((m) => m.position)).toEqual([p(6, 3)]);
  });

  it('nothing valid -> no marks, no steps', () => {
    const plan = planRequest({ kind: 'note', position: p(9, 9) }, STANDARD_GUITAR);
    expect(plan.marks).toEqual([]);
    expect(plan.steps).toEqual([]);
  });

  it('sequence skips steps with nothing valid but keeps timing of others', () => {
    const plan = planRequest(
      { kind: 'sequence', steps: [p(6, 0), p(9, 9), p(5, 0)], bpm: 60 },
      STANDARD_GUITAR
    );
    expect(plan.marks.map((m) => m.position)).toEqual([p(6, 0), p(5, 0)]);
    expect(plan.marks.map((m) => m.onsetMs)).toEqual([0, 2000]);
  });

  it('de-duplicates positions within a chord', () => {
    const plan = planRequest(
      { kind: 'chord', positions: [p(6, 3), p(6, 3), p(5, 0)] },
      STANDARD_GUITAR
    );
    expect(plan.marks).toHaveLength(2);
    expect(plan.steps[0].pitches).toHaveLength(2);
  });

  it('uses the passed instrument for pitches', () => {
    const dropD: Instrument = {
      ...STANDARD_GUITAR,
      openStrings: [
        ...STANDARD_GUITAR.openStrings.slice(0, 5),
        { letter: 'D', accidental: 0, octave: 2 }
      ]
    };
    const plan = planRequest({ kind: 'note', position: p(6, 5) }, dropD);
    expect(plan.steps[0].pitches).toEqual([38 + 5]);
  });
});
