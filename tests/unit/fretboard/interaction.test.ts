import { describe, expect, it } from 'vitest';
import { DEFAULT_METRICS, layoutFretboard } from '../../../src/lib/fretboard/geometry';
import {
  DRAG_THRESHOLD_PX,
  autoScrollTarget,
  moveFocus,
  reduceGesture,
  scrollIntoViewTarget
} from '../../../src/lib/fretboard/interaction';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import type { GestureEvent, GestureState } from '../../../src/lib/fretboard/types';

const idle: GestureState = { kind: 'idle' };
const down = (over: Partial<Extract<GestureEvent, { type: 'down' }>> = {}): GestureEvent => ({
  type: 'down',
  pointerId: 1,
  pointerType: 'touch',
  button: 0,
  isPrimary: true,
  x: 100,
  y: 50,
  ...over
});
const pending: GestureState = {
  kind: 'pending',
  pointerId: 1,
  pointerType: 'touch',
  originX: 100,
  originY: 50
};

describe('gesture reducer', () => {
  it('uses a 10 px drag threshold', () => {
    expect(DRAG_THRESHOLD_PX).toBe(10);
  });

  it('idle → pending on primary down', () => {
    const r = reduceGesture(idle, down());
    expect(r.state).toEqual(pending);
    expect(r.effect).toEqual({ kind: 'none' });
  });

  it('ignores other buttons and non-primary pointers when idle', () => {
    expect(reduceGesture(idle, down({ button: 2 })).state).toEqual(idle);
    expect(reduceGesture(idle, down({ isPrimary: false })).state).toEqual(idle);
  });

  it('stays pending under 10 px of travel', () => {
    const r = reduceGesture(pending, { type: 'move', pointerId: 1, x: 105, y: 55 });
    expect(r.state).toEqual(pending);
    expect(r.effect).toEqual({ kind: 'none' });
  });

  it('goes scrolling at ≥ 10 px and hides hover', () => {
    const r = reduceGesture(pending, { type: 'move', pointerId: 1, x: 112, y: 50 });
    expect(r.state).toEqual({ kind: 'scrolling', pointerId: 1, pointerType: 'touch', lastX: 112 });
    expect(r.effect).toEqual({ kind: 'hide-hover' });
    const exact = reduceGesture(pending, { type: 'move', pointerId: 1, x: 100, y: 60 });
    expect(exact.state.kind).toBe('scrolling');
  });

  it('activates at the release point on pending up', () => {
    const r = reduceGesture(pending, { type: 'up', pointerId: 1, x: 102, y: 51 });
    expect(r.state).toEqual(idle);
    expect(r.effect).toEqual({ kind: 'activate', x: 102, y: 51 });
  });

  it('second pointer cancels a pending gesture', () => {
    const r = reduceGesture(pending, down({ pointerId: 2, isPrimary: false }));
    expect(r.state).toEqual({ kind: 'cancelled' });
    expect(r.effect).toEqual({ kind: 'none' });
  });

  it('cancel returns pending and scrolling to idle', () => {
    expect(reduceGesture(pending, { type: 'cancel', pointerId: 1 }).state).toEqual(idle);
    const scrolling: GestureState = {
      kind: 'scrolling',
      pointerId: 1,
      pointerType: 'touch',
      lastX: 120
    };
    expect(reduceGesture(scrolling, { type: 'cancel', pointerId: 1 }).state).toEqual(idle);
  });

  it('scrolling up does not activate', () => {
    const scrolling: GestureState = {
      kind: 'scrolling',
      pointerId: 1,
      pointerType: 'touch',
      lastX: 120
    };
    const r = reduceGesture(scrolling, { type: 'up', pointerId: 1, x: 130, y: 50 });
    expect(r.state).toEqual(idle);
    expect(r.effect).toEqual({ kind: 'none' });
  });

  it('mouse scrolling emits scroll by dx; touch does not', () => {
    const mouse: GestureState = {
      kind: 'scrolling',
      pointerId: 1,
      pointerType: 'mouse',
      lastX: 120
    };
    const r = reduceGesture(mouse, { type: 'move', pointerId: 1, x: 110, y: 50 });
    expect(r.state).toEqual({ ...mouse, lastX: 110 });
    expect(r.effect).toEqual({ kind: 'scroll', dx: -10 });
    const touch: GestureState = { ...mouse, pointerType: 'touch' };
    expect(reduceGesture(touch, { type: 'move', pointerId: 1, x: 110, y: 50 }).effect).toEqual({
      kind: 'none'
    });
  });

  it('cancelled returns to idle after the last pointer up, never activating', () => {
    const cancelled: GestureState = { kind: 'cancelled' };
    const r = reduceGesture(cancelled, { type: 'up', pointerId: 1, x: 1, y: 1 });
    expect(r.state).toEqual(idle);
    expect(r.effect).toEqual({ kind: 'none' });
    expect(reduceGesture(cancelled, { type: 'move', pointerId: 1, x: 1, y: 1 }).state).toEqual(
      cancelled
    );
  });

  it('ignores events from other pointers while pending', () => {
    const r = reduceGesture(pending, { type: 'up', pointerId: 9, x: 1, y: 1 });
    expect(r.state).toEqual(pending);
    expect(r.effect).toEqual({ kind: 'none' });
  });
});

describe('autoScrollTarget', () => {
  const width = 286;
  const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, width, 'interactive');
  const maxScroll = layout.width - width;
  const at = (...frets: number[]) => frets.map((fret) => ({ string: 6, fret }));
  const viewport = (scrollLeft: number) => ({ scrollLeft, width });

  it('returns null when nothing is highlighted', () => {
    expect(autoScrollTarget(layout, [], viewport(0))).toBeNull();
  });

  it('returns null when all highlighted positions are fully visible', () => {
    expect(autoScrollTarget(layout, at(1, 2, 3), viewport(0))).toBeNull();
  });

  it('scrolls the minimal distance when the span fits (end aligned to viewport end)', () => {
    const target = autoScrollTarget(layout, at(15, 16, 17), viewport(0));
    expect(target).not.toBeNull();
    expect(target).toBeCloseTo(layout.columns[17].end - width, 5);
    expect(target).toBeLessThanOrEqual(maxScroll);
  });

  it('scrolls back minimally when highlights are left of the viewport', () => {
    const target = autoScrollTarget(layout, at(2, 3), viewport(maxScroll));
    expect(target).toBeCloseTo(layout.columns[2].start, 5);
  });

  it('returns null when already at the minimal position', () => {
    const t = layout.columns[17].end - width;
    expect(autoScrollTarget(layout, at(15, 16, 17), viewport(t))).toBeNull();
  });

  it('aligns the lowest highlighted fret to the start when the span does not fit', () => {
    const target = autoScrollTarget(layout, at(2, 20), viewport(0));
    expect(target).toBeCloseTo(layout.columns[2].start, 5);
  });

  it('clamps to the scrollable range', () => {
    const target = autoScrollTarget(layout, at(21, 22, 20), viewport(0));
    expect(target).toBeLessThanOrEqual(maxScroll);
    expect(target).toBeGreaterThan(0);
  });

  it('never scrolls when the board fits the container', () => {
    const wide = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 2560, 'interactive');
    expect(autoScrollTarget(wide, at(22), { scrollLeft: 0, width: 2560 })).toBeNull();
  });
});

describe('scrollIntoViewTarget', () => {
  const width = 286;
  const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, width, 'interactive');

  it('returns null for a visible cell', () => {
    expect(
      scrollIntoViewTarget(layout, { string: 1, fret: 2 }, { scrollLeft: 0, width })
    ).toBeNull();
  });

  it('returns the minimal scroll for a cell off the right edge', () => {
    const t = scrollIntoViewTarget(layout, { string: 1, fret: 10 }, { scrollLeft: 0, width });
    expect(t).toBeCloseTo(layout.columns[10].end - width, 5);
  });

  it('returns the minimal scroll for a cell off the left edge', () => {
    const t = scrollIntoViewTarget(layout, { string: 1, fret: 1 }, { scrollLeft: 200, width });
    expect(t).toBeCloseTo(layout.columns[1].start, 5);
  });
});

describe('moveFocus', () => {
  const from = { string: 3, fret: 5 };

  it('moves along frets and strings', () => {
    expect(moveFocus(STANDARD_GUITAR, from, 'ArrowRight')).toEqual({ string: 3, fret: 6 });
    expect(moveFocus(STANDARD_GUITAR, from, 'ArrowLeft')).toEqual({ string: 3, fret: 4 });
    expect(moveFocus(STANDARD_GUITAR, from, 'ArrowUp')).toEqual({ string: 2, fret: 5 });
    expect(moveFocus(STANDARD_GUITAR, from, 'ArrowDown')).toEqual({ string: 4, fret: 5 });
  });

  it('stays put at the four edges (no wrap)', () => {
    expect(moveFocus(STANDARD_GUITAR, { string: 3, fret: 22 }, 'ArrowRight')).toEqual({
      string: 3,
      fret: 22
    });
    expect(moveFocus(STANDARD_GUITAR, { string: 3, fret: 0 }, 'ArrowLeft')).toEqual({
      string: 3,
      fret: 0
    });
    expect(moveFocus(STANDARD_GUITAR, { string: 1, fret: 4 }, 'ArrowUp')).toEqual({
      string: 1,
      fret: 4
    });
    expect(moveFocus(STANDARD_GUITAR, { string: 6, fret: 4 }, 'ArrowDown')).toEqual({
      string: 6,
      fret: 4
    });
  });

  it('maps Enter and Space to activate, other keys to null', () => {
    expect(moveFocus(STANDARD_GUITAR, from, 'Enter')).toBe('activate');
    expect(moveFocus(STANDARD_GUITAR, from, ' ')).toBe('activate');
    expect(moveFocus(STANDARD_GUITAR, from, 'a')).toBeNull();
    expect(moveFocus(STANDARD_GUITAR, from, 'Tab')).toBeNull();
  });
});
