import { describe, expect, it } from 'vitest';
import {
  DEFAULT_METRICS,
  layoutFretboard,
  trailingEdgeScroll
} from '../../../src/lib/fretboard/geometry';
import {
  DRAG_THRESHOLD_PX,
  autoScrollTarget,
  groupScrollTarget,
  moveFocus,
  nutOffset,
  reduceGesture,
  scrollForNutOffset,
  scrollIntoViewTarget,
  spanTarget
} from '../../../src/lib/fretboard/interaction';
import { screenOrder } from '../../../src/lib/fretboard/geometry';
import { STANDARD_GUITAR, withPresentation } from '../../../src/lib/instrument/instrument';
import { presetInstrument } from '../../../src/lib/instrument/tunings';
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

describe('groupScrollTarget', () => {
  const width = 286;
  const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, width, 'interactive');
  const at = (...frets: number[]) => frets.map((fret) => ({ string: 6, fret }));
  const viewport = (scrollLeft: number) => ({ scrollLeft, width });

  it('returns null for no groups', () => {
    expect(groupScrollTarget(layout, [], viewport(0))).toBeNull();
  });

  it('returns null when any group is fully visible', () => {
    expect(groupScrollTarget(layout, [at(18, 19, 20), at(1, 2, 3)], viewport(0))).toBeNull();
  });

  it('moves to the first group when none is visible', () => {
    const target = groupScrollTarget(layout, [at(15, 16, 17), at(19, 20, 21)], viewport(0));
    expect(target).toBeCloseTo(layout.columns[17].end - width, 5);
  });

  it('ignores empty groups', () => {
    expect(groupScrollTarget(layout, [[]], viewport(0))).toBeNull();
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

describe('left-handed interaction', () => {
  const LEFT = withPresentation(STANDARD_GUITAR, 'left', 'highest-top');
  const from = { string: 3, fret: 5 };
  const VIEW = 300;
  const lr = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, VIEW, 'interactive');
  const ll = layoutFretboard(LEFT, DEFAULT_METRICS, VIEW, 'interactive');
  const maxScroll = ll.width - VIEW;

  it('moveFocus: ArrowLeft goes up a fret, ArrowRight down, no wrap', () => {
    expect(moveFocus(LEFT, from, 'ArrowLeft')).toEqual({ string: 3, fret: 6 });
    expect(moveFocus(LEFT, from, 'ArrowRight')).toEqual({ string: 3, fret: 4 });
    expect(moveFocus(LEFT, { string: 3, fret: 22 }, 'ArrowLeft')).toEqual({ string: 3, fret: 22 });
    expect(moveFocus(LEFT, { string: 3, fret: 0 }, 'ArrowRight')).toEqual({ string: 3, fret: 0 });
  });

  it('nutOffset / scrollForNutOffset round-trip', () => {
    for (const x of [0, 17, maxScroll / 2, maxScroll]) {
      expect(scrollForNutOffset(ll, nutOffset(ll, x, VIEW), VIEW)).toBeCloseTo(x);
      expect(scrollForNutOffset(lr, nutOffset(lr, x, VIEW), VIEW)).toBeCloseTo(x);
    }
  });

  it('unscrolled left-handed (nut in view) is scrollLeft = maxScroll', () => {
    expect(nutOffset(ll, maxScroll, VIEW)).toBe(0);
    expect(nutOffset(lr, 0, VIEW)).toBe(0);
    expect(scrollForNutOffset(ll, 0, VIEW)).toBeCloseTo(maxScroll);
  });

  it('auto-scroll targets are the mirror of the right-handed targets', () => {
    const hl = [
      { string: 1, fret: 18 },
      { string: 2, fret: 19 }
    ];
    const r = autoScrollTarget(lr, hl, { scrollLeft: 0, width: VIEW });
    const l = autoScrollTarget(ll, hl, { scrollLeft: maxScroll, width: VIEW });
    expect(r).not.toBeNull();
    expect(l).not.toBeNull();
    expect(l ?? NaN).toBeCloseTo(maxScroll - (r ?? 0));
    const g = groupScrollTarget(lr, [hl], { scrollLeft: 0, width: VIEW });
    const gl = groupScrollTarget(ll, [hl], { scrollLeft: maxScroll, width: VIEW });
    expect(gl ?? NaN).toBeCloseTo(maxScroll - (g ?? 0));
    const s = scrollIntoViewTarget(lr, { string: 1, fret: 20 }, { scrollLeft: 0, width: VIEW });
    const sl = scrollIntoViewTarget(
      ll,
      { string: 1, fret: 20 },
      { scrollLeft: maxScroll, width: VIEW }
    );
    expect(sl ?? NaN).toBeCloseTo(maxScroll - (s ?? 0));
  });

  it('a span wider than the viewport aligns its nut side', () => {
    const t = spanTarget(ll, 0, ll.width, { scrollLeft: 0, width: 100 });
    expect(t).toBeCloseTo(ll.width - 100);
    const tr = spanTarget(lr, 0, lr.width, { scrollLeft: 50, width: 100 });
    expect(tr).toBe(0);
  });

  it('trailingEdgeScroll is 0 when mirrored', () => {
    expect(trailingEdgeScroll(ll, VIEW)).toBe(0);
    expect(trailingEdgeScroll(lr, VIEW)).toBeGreaterThan(0);
  });

  it('a handedness switch keeps the same fret interval in view', () => {
    const scroll = 200;
    const offset = nutOffset(lr, scroll, VIEW);
    const switched = scrollForNutOffset(ll, offset, VIEW);
    expect(switched).toBeCloseTo(maxScroll - scroll);
  });
});

describe('lowest-top interaction (US2)', () => {
  const combos = [
    ['right', 'highest-top'],
    ['right', 'lowest-top'],
    ['left', 'highest-top'],
    ['left', 'lowest-top']
  ] as const;

  it('ArrowUp from string 5 goes to 6 and ArrowDown from 6 to 5 when lowest is on top', () => {
    for (const h of ['right', 'left'] as const) {
      const inst = withPresentation(STANDARD_GUITAR, h, 'lowest-top');
      expect(moveFocus(inst, { string: 5, fret: 3 }, 'ArrowUp')).toEqual({ string: 6, fret: 3 });
      expect(moveFocus(inst, { string: 6, fret: 3 }, 'ArrowDown')).toEqual({ string: 5, fret: 3 });
    }
  });

  it('keeps highest-top behaviour: ArrowUp from 5 goes to 4', () => {
    expect(moveFocus(STANDARD_GUITAR, { string: 5, fret: 3 }, 'ArrowUp')).toEqual({
      string: 4,
      fret: 3
    });
  });

  it('does not wrap at the top or bottom edge in any combination', () => {
    for (const [h, o] of combos) {
      const inst = withPresentation(STANDARD_GUITAR, h, o);
      const rows = screenOrder(inst).rows;
      const top = { string: rows[0], fret: 4 };
      const bottom = { string: rows[rows.length - 1], fret: 4 };
      expect(moveFocus(inst, top, 'ArrowUp')).toEqual(top);
      expect(moveFocus(inst, bottom, 'ArrowDown')).toEqual(bottom);
    }
  });

  it('handedness and orientation are independent', () => {
    const a = withPresentation(STANDARD_GUITAR, 'left', 'lowest-top');
    expect(moveFocus(a, { string: 3, fret: 5 }, 'ArrowLeft')).toEqual({ string: 3, fret: 6 });
    expect(moveFocus(a, { string: 3, fret: 5 }, 'ArrowUp')).toEqual({ string: 4, fret: 5 });
    const b = withPresentation(STANDARD_GUITAR, 'right', 'lowest-top');
    expect(moveFocus(b, { string: 3, fret: 5 }, 'ArrowRight')).toEqual({ string: 3, fret: 6 });
    expect(moveFocus(b, { string: 3, fret: 5 }, 'ArrowUp')).toEqual({ string: 4, fret: 5 });
  });
});

describe('fret-count change when mirrored (US5)', () => {
  const VIEW = 300;
  const view = (frets: number, h: 'right' | 'left') =>
    layoutFretboard(
      withPresentation(presetInstrument('AF-1', 6, frets), h, 'highest-top'),
      DEFAULT_METRICS,
      VIEW,
      'interactive'
    );

  it('growing 22 → 24 frets extends the far end and keeps the visible frets', () => {
    for (const h of ['right', 'left'] as const) {
      const before = view(22, h);
      const after = view(24, h);
      for (const scroll of [0, 40, 120]) {
        const s0 = h === 'left' ? before.width - VIEW - scroll : scroll;
        const offset = nutOffset(before, s0, VIEW);
        const s1 = scrollForNutOffset(after, offset, VIEW);
        // Distance of each early fret from the nut-side viewport edge is unchanged.
        const edge = (s: number) => (h === 'left' ? s + VIEW : s);
        for (const f of [0, 1, 2, 3, 4]) {
          const d0 = Math.abs(before.columns[f].center - edge(s0));
          const d1 = Math.abs(after.columns[f].center - edge(s1));
          expect(Math.abs(d0 - d1)).toBeLessThan(2);
        }
      }
    }
  });

  it('the mirrored board grows leftward: fret 0 stays at the right edge', () => {
    const before = view(22, 'left');
    const after = view(24, 'left');
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.width - after.columns[0].center).toBeCloseTo(
      before.width - before.columns[0].center
    );
  });
});
