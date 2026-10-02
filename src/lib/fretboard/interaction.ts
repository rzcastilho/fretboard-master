/** Pure gesture state machine (data-model §6). No DOM, no Svelte. */
import type { Instrument, Position } from '../instrument/instrument';
import { screenOrder, type FretboardLayout } from './geometry';
import type { GestureEffect, GestureEvent, GestureState } from './types';

export const DRAG_THRESHOLD_PX = 10;

const NONE: GestureEffect = { kind: 'none' };
const IDLE: GestureState = { kind: 'idle' };

export function reduceGesture(
  state: GestureState,
  event: GestureEvent
): { state: GestureState; effect: GestureEffect } {
  switch (state.kind) {
    case 'idle':
      if (event.type === 'down' && event.button === 0 && event.isPrimary) {
        return {
          state: {
            kind: 'pending',
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            originX: event.x,
            originY: event.y
          },
          effect: NONE
        };
      }
      return { state, effect: NONE };

    case 'pending':
      if (event.type === 'down' && event.pointerId !== state.pointerId) {
        return { state: { kind: 'cancelled' }, effect: NONE };
      }
      if (event.type === 'cancel') {
        return event.pointerId === state.pointerId
          ? { state: IDLE, effect: NONE }
          : { state, effect: NONE };
      }
      if ('pointerId' in event && event.pointerId !== state.pointerId) {
        return { state, effect: NONE };
      }
      if (event.type === 'move') {
        const travel = Math.hypot(event.x - state.originX, event.y - state.originY);
        if (travel >= DRAG_THRESHOLD_PX) {
          return {
            state: {
              kind: 'scrolling',
              pointerId: state.pointerId,
              pointerType: state.pointerType,
              lastX: event.x
            },
            effect: { kind: 'hide-hover' }
          };
        }
        return { state, effect: NONE };
      }
      if (event.type === 'up') {
        return { state: IDLE, effect: { kind: 'activate', x: event.x, y: event.y } };
      }
      return { state, effect: NONE };

    case 'scrolling':
      if ('pointerId' in event && event.pointerId !== state.pointerId) {
        return { state, effect: NONE };
      }
      if (event.type === 'cancel' || event.type === 'up') return { state: IDLE, effect: NONE };
      if (event.type === 'move') {
        const next: GestureState = { ...state, lastX: event.x };
        return {
          state: next,
          effect:
            state.pointerType === 'mouse' ? { kind: 'scroll', dx: event.x - state.lastX } : NONE
        };
      }
      return { state, effect: NONE };

    case 'cancelled':
      // Caller feeds `up` only once the last pointer is released.
      if (event.type === 'up') return { state: IDLE, effect: NONE };
      return { state, effect: NONE };
  }
}

export interface ScrollViewport {
  scrollLeft: number;
  width: number;
}

/** Target for a horizontal span; null when already fully visible or no scroll is possible. */
function spanTarget(
  layout: FretboardLayout,
  start: number,
  end: number,
  viewport: ScrollViewport
): number | null {
  const { scrollLeft, width } = viewport;
  const maxScroll = Math.max(0, layout.width - width);
  if (start >= scrollLeft && end <= scrollLeft + width) return null;
  let target: number;
  if (end - start > width)
    target = start; // does not fit: align the start
  else if (start < scrollLeft)
    target = start; // minimal move left
  else target = end - width; // minimal move right
  target = Math.min(Math.max(target, 0), maxScroll);
  return Math.abs(target - scrollLeft) < 0.5 ? null : target;
}

/**
 * Where to scroll so the highlighted positions show (FR-014, R-09): null when they are all fully
 * visible (or none exist); the minimal move when their fret span fits; otherwise the lowest
 * highlighted fret aligned to the start.
 */
export function autoScrollTarget(
  layout: FretboardLayout,
  highlighted: readonly Position[],
  viewport: ScrollViewport
): number | null {
  if (highlighted.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const p of highlighted) {
    const col = layout.columns[p.fret];
    if (!col) continue;
    min = Math.min(min, col.start);
    max = Math.max(max, col.end);
  }
  if (min === Infinity) return null;
  return spanTarget(layout, min, max, viewport);
}

/** Minimal scrollLeft that brings one cell fully into view (keyboard moves, US5). */
export function scrollIntoViewTarget(
  layout: FretboardLayout,
  p: Position,
  viewport: ScrollViewport
): number | null {
  const col = layout.columns[p.fret];
  return col ? spanTarget(layout, col.start, col.end, viewport) : null;
}

/**
 * Keyboard mapping (US5): arrows move one cell on screen without wrapping (the position is
 * returned unchanged at an edge), Enter/Space activate, any other key is not ours (null).
 * Screen directions go through `screenOrder`, the single orientation mapping.
 */
export function moveFocus(
  instrument: Instrument,
  from: Position,
  key: string
): Position | 'activate' | null {
  if (key === 'Enter' || key === ' ' || key === 'Spacebar') return 'activate';
  const { rows, reversed } = screenOrder(instrument);
  const row = rows.indexOf(from.string);
  let dRow = 0;
  let dFret = 0;
  if (key === 'ArrowUp') dRow = -1;
  else if (key === 'ArrowDown') dRow = 1;
  else if (key === 'ArrowLeft') dFret = reversed ? 1 : -1;
  else if (key === 'ArrowRight') dFret = reversed ? -1 : 1;
  else return null;
  const nextRow = Math.min(Math.max(row + dRow, 0), rows.length - 1);
  const fret = Math.min(Math.max(from.fret + dFret, 0), instrument.fretCount);
  return { string: rows[nextRow], fret };
}
