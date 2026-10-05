import { describe, expect, it } from 'vitest';
import { clampBpm, MAX_TIMELINE_MS, planRequest } from '../../../src/lib/audio/schedule';
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

describe('planRequest rest step (007 US6, R-10)', () => {
  it('an empty step keeps its slot: two blocks at 0 and 1000 ms, 500 ms each', () => {
    const a = [p(3, 0), p(2, 1), p(1, 0)];
    const d = [p(3, 0), p(2, 0), p(1, 0)];
    const plan = planRequest({ kind: 'sequence', steps: [a, [], d], bpm: 120 }, STANDARD_GUITAR);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps.map((s) => s.onsetMs)).toEqual([0, 1000]);
    expect(plan.marks.map((k) => [k.onsetMs, k.endMs])).toEqual([
      [0, 500],
      [0, 500],
      [0, 500],
      [1000, 1500],
      [1000, 1500],
      [1000, 1500]
    ]);
  });
});

describe('planRequest timeline (019, R-01)', () => {
  it('one step per surviving event, each with its own onset and duration', () => {
    const plan = planRequest(
      {
        kind: 'timeline',
        events: [
          { positions: [p(6, 0)], onsetMs: 0, durationMs: 1500 },
          { positions: [p(5, 0)], onsetMs: 250, durationMs: 1500 },
          { positions: [p(6, 0), p(5, 0), p(4, 0)], onsetMs: 1000, durationMs: 800 }
        ]
      },
      STANDARD_GUITAR
    );
    expect(plan.kind).toBe('timeline');
    expect(plan.steps.map((s) => [s.onsetMs, s.durationMs])).toEqual([
      [0, 1500],
      [250, 1500],
      [1000, 800]
    ]);
    expect(plan.steps[2].pitches).toEqual([40, 45, 50]);
    expect(plan.marks.map((m) => [m.onsetMs, m.endMs])).toEqual([
      [0, 1500],
      [250, 1750],
      [1000, 1800],
      [1000, 1800],
      [1000, 1800]
    ]);
  });

  it('clamps onset to 0..MAX_TIMELINE_MS and duration to 1..MAX_TIMELINE_MS', () => {
    expect(MAX_TIMELINE_MS).toBe(60_000);
    const plan = planRequest(
      {
        kind: 'timeline',
        events: [
          { positions: [p(6, 0)], onsetMs: -50, durationMs: 0 },
          { positions: [p(5, 0)], onsetMs: 999_999, durationMs: 999_999 },
          { positions: [p(4, 0)], onsetMs: Infinity, durationMs: 100 }
        ]
      },
      STANDARD_GUITAR
    );
    expect(plan.steps.map((s) => [s.onsetMs, s.durationMs])).toEqual([
      [0, 1],
      [60_000, 60_000]
    ]);
  });

  it('drops events with a non-finite onset or duration', () => {
    const plan = planRequest(
      {
        kind: 'timeline',
        events: [
          { positions: [p(6, 0)], onsetMs: NaN, durationMs: 100 },
          { positions: [p(5, 0)], onsetMs: 0, durationMs: NaN },
          { positions: [p(4, 0)], onsetMs: 0, durationMs: -Infinity },
          { positions: [p(3, 0)], onsetMs: 10, durationMs: 100 }
        ]
      },
      STANDARD_GUITAR
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].positions).toEqual([p(3, 0)]);
  });

  it('drops invalid and duplicate positions, and events left empty', () => {
    const plan = planRequest(
      {
        kind: 'timeline',
        events: [
          { positions: [p(6, 0), p(6, 0), p(9, 0), p(5, 99)], onsetMs: 0, durationMs: 100 },
          { positions: [p(9, 0)], onsetMs: 100, durationMs: 100 },
          { positions: [], onsetMs: 200, durationMs: 100 }
        ]
      },
      STANDARD_GUITAR
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].positions).toEqual([p(6, 0)]);
    expect(plan.marks).toHaveLength(1);
  });

  it('never throws on an empty timeline', () => {
    const plan = planRequest({ kind: 'timeline', events: [] }, STANDARD_GUITAR);
    expect(plan.steps).toEqual([]);
    expect(plan.marks).toEqual([]);
  });

  it('note, chord and sequence plans are unchanged', () => {
    expect(planRequest({ kind: 'note', position: p(6, 0) }, STANDARD_GUITAR).kind).toBe('note');
    expect(planRequest({ kind: 'chord', positions: [p(6, 0)] }, STANDARD_GUITAR).kind).toBe(
      'chord'
    );
    const seq = planRequest(
      { kind: 'sequence', steps: [p(6, 0), p(5, 0)], bpm: 120 },
      STANDARD_GUITAR
    );
    expect(seq.kind).toBe('sequence');
    expect(seq.steps.map((s) => [s.onsetMs, s.durationMs])).toEqual([
      [0, 500],
      [500, 500]
    ]);
  });
});
