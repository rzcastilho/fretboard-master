import { describe, expect, it } from 'vitest';
import { DEFAULT_METRICS, layoutFretboard } from '../../../src/lib/fretboard/geometry';
import {
  minimapKeyScroll,
  minimapTapScroll,
  minimapWindow,
  visibleFretRange
} from '../../../src/lib/fretboard/minimap';
import { STANDARD_GUITAR, withPresentation } from '../../../src/lib/instrument/instrument';

const guitar24 = { ...STANDARD_GUITAR, fretCount: 24 };
const right = layoutFretboard(guitar24, DEFAULT_METRICS, 320, 'interactive');
const left = layoutFretboard(
  withPresentation(guitar24, 'left', 'highest-top'),
  DEFAULT_METRICS,
  320,
  'interactive'
);
const VW = 320;
const MAX = right.width - VW;

describe('visibleFretRange', () => {
  it('scroll 0, 24 frets / 320 → first 1, last ≈5, count 24', () => {
    const r = visibleFretRange(right, { scrollLeft: 0, width: VW });
    expect(r.first).toBe(1);
    expect(r.last).toBeGreaterThanOrEqual(4);
    expect(r.last).toBeLessThanOrEqual(6);
    expect(r.count).toBe(24);
  });

  it('max scroll shows the last fret', () => {
    const r = visibleFretRange(right, { scrollLeft: MAX, width: VW });
    expect(r.last).toBe(24);
    expect(r.first).toBeGreaterThan(15);
  });

  it('mirrored: scroll 0 shows the last fret, max scroll shows fret 1', () => {
    expect(visibleFretRange(left, { scrollLeft: 0, width: VW }).last).toBe(24);
    expect(visibleFretRange(left, { scrollLeft: MAX, width: VW }).first).toBe(1);
  });

  it('viewport inside the open column → fret 1', () => {
    expect(visibleFretRange(right, { scrollLeft: 0, width: 30 })).toEqual({
      first: 1,
      last: 1,
      count: 24
    });
  });

  it('whole neck → 1..count', () => {
    const whole = layoutFretboard(guitar24, DEFAULT_METRICS, 320, 'interactive', false, 'whole');
    expect(visibleFretRange(whole, { scrollLeft: 0, width: 320 })).toEqual({
      first: 1,
      last: 24,
      count: 24
    });
  });
});

describe('minimapWindow', () => {
  const k = 0.25;
  it('scales scroll and width by k', () => {
    expect(minimapWindow(right, { scrollLeft: 100, width: VW }, k)).toEqual({
      x: 25,
      width: 80
    });
  });

  it('clamps to the minimap', () => {
    const w = minimapWindow(right, { scrollLeft: right.width, width: VW }, k);
    expect(w.x + w.width).toBeLessThanOrEqual(right.width * k + 1e-9);
    expect(w.x).toBeGreaterThanOrEqual(0);
  });
});

describe('minimapTapScroll', () => {
  const mw = right.width * 0.25;
  const k = 0.25;
  it('far end (right-handed) → max scroll', () => {
    expect(minimapTapScroll(right, mw, k, VW)).toBeCloseTo(MAX, 6);
  });
  it('mirrored: x = 0 → scroll 0', () => {
    expect(minimapTapScroll(left, 0, k, VW)).toBe(0);
  });
  it('middle centres the tapped point', () => {
    expect(minimapTapScroll(right, mw / 2, k, VW)).toBeCloseTo(right.width / 2 - VW / 2, 6);
  });
  it('clamps near both ends', () => {
    expect(minimapTapScroll(right, 1, k, VW)).toBe(0);
    expect(minimapTapScroll(right, mw - 1, k, VW)).toBeCloseTo(MAX, 6);
  });
  it('content narrower than viewport → 0', () => {
    expect(minimapTapScroll(right, 10, k, right.width + 50)).toBe(0);
  });
});

describe('minimapKeyScroll', () => {
  it('ArrowRight moves one viewport; clamps at max (no overshoot)', () => {
    expect(minimapKeyScroll(right, 'ArrowRight', { scrollLeft: 100, width: VW })).toBe(100 + VW);
    expect(minimapKeyScroll(right, 'ArrowRight', { scrollLeft: MAX, width: VW })).toBe(MAX);
  });
  it('ArrowLeft clamps at 0', () => {
    expect(minimapKeyScroll(right, 'ArrowLeft', { scrollLeft: 100, width: VW })).toBe(0);
  });
  it('Home → nut end, End → last-fret end', () => {
    expect(minimapKeyScroll(right, 'Home', { scrollLeft: 400, width: VW })).toBe(0);
    expect(minimapKeyScroll(right, 'End', { scrollLeft: 400, width: VW })).toBe(MAX);
  });
  it('mirrored Home → max scroll (nut on the right); End → 0', () => {
    expect(minimapKeyScroll(left, 'Home', { scrollLeft: 0, width: VW })).toBe(MAX);
    expect(minimapKeyScroll(left, 'End', { scrollLeft: 400, width: VW })).toBe(0);
  });
  it('other keys → null', () => {
    expect(minimapKeyScroll(right, 'a', { scrollLeft: 0, width: VW })).toBeNull();
  });
});
