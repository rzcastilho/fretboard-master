import { describe, expect, it } from 'vitest';
import { beatDots, countInDot, statusParams } from '../../../src/lib/state/metronome-view';

describe('beatDots', () => {
  it('lights the current beat, dims earlier ones, leaves later ones upcoming', () => {
    expect(beatDots(4, 3)).toEqual(['played', 'played', 'lit', 'upcoming']);
  });

  it('is all upcoming before the first click', () => {
    expect(beatDots(4, 0)).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('wrapping to beat 1 resets the others to upcoming', () => {
    expect(beatDots(4, 4)).toEqual(['played', 'played', 'played', 'lit']);
    expect(beatDots(4, 1)).toEqual(['lit', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('a single beat is always lit', () => {
    expect(beatDots(1, 1)).toEqual(['lit']);
  });
});

describe('statusParams', () => {
  it('selects the "none" message for beat 0', () => {
    expect(statusParams(0, 4, 3)).toEqual({ kind: 'none', beats: 4, sub: 3 });
  });
  it('selects the beat message otherwise', () => {
    expect(statusParams(2, 4, 3)).toEqual({ kind: 'beat', beat: 2, beats: 4, sub: 3 });
  });
});

describe('count-in status (033)', () => {
  it('selects the count-in messages', () => {
    expect(statusParams(0, 4, 3, { click: 2, total: 4 })).toEqual({
      kind: 'count-in',
      click: 2,
      total: 4
    });
    expect(statusParams(0, 4, 3, { click: 0, total: 4 })).toEqual({
      kind: 'count-in-none',
      total: 4
    });
  });
  it('a null or absent count-in equals the 032 output', () => {
    expect(statusParams(2, 4, 3, null)).toEqual(statusParams(2, 4, 3));
    expect(statusParams(0, 4, 3, null)).toEqual(statusParams(0, 4, 3));
  });
  it('countInDot is upcoming at 0 and lit afterwards', () => {
    expect(countInDot(0)).toBe('upcoming');
    for (const n of [1, 4, 8]) expect(countInDot(n)).toBe('lit');
  });
});

describe('display model for positions (034, data-model §7)', () => {
  it('maps the count-in positions', () => {
    expect(statusParams(0, 4, 3, { click: 0, total: 4 })).toEqual({
      kind: 'count-in-none',
      total: 4
    });
    expect(statusParams(0, 4, 6, { click: 1, total: 2 })).toEqual({
      kind: 'count-in',
      click: 1,
      total: 2
    });
  });
  it('maps the loop positions with the playing loop sub', () => {
    expect(statusParams(0, 4, 3)).toEqual({ kind: 'none', beats: 4, sub: 3 });
    expect(statusParams(3, 4, 6)).toEqual({ kind: 'beat', beat: 3, beats: 4, sub: 6 });
    expect(beatDots(4, 1)).toEqual(['lit', 'upcoming', 'upcoming', 'upcoming']);
  });
});
