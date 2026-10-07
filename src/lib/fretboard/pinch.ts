/** Two-finger pinch reducer (025 data-model §4). Pure: no DOM, no Svelte, one switch per gesture. */

export const PINCH_IN_RATIO = 0.8;
export const PINCH_OUT_RATIO = 1.25;

export type PinchState =
  | { kind: 'idle' }
  /** `start` is the finger distance (px) when the pinch began. */
  | { kind: 'tracking'; start: number }
  /** Switched once; waits for every touch to lift. */
  | { kind: 'done' };

export type PinchEvent = {
  type: 'touches';
  points: readonly { x: number; y: number }[];
};

export type PinchEffect = { kind: 'none' } | { kind: 'pinch'; direction: 'in' | 'out' };

const NONE: PinchEffect = { kind: 'none' };
const IDLE: PinchState = { kind: 'idle' };

export function reducePinch(
  state: PinchState,
  event: PinchEvent
): { state: PinchState; effect: PinchEffect } {
  const { points } = event;
  if (points.length !== 2) {
    // Any other finger count aborts; `done` waits until every touch lifts.
    if (state.kind === 'done' && points.length > 0) return { state, effect: NONE };
    return { state: IDLE, effect: NONE };
  }
  const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  switch (state.kind) {
    case 'idle':
      return { state: distance > 0 ? { kind: 'tracking', start: distance } : IDLE, effect: NONE };
    case 'done':
      return { state, effect: NONE };
    case 'tracking': {
      const ratio = distance / state.start;
      if (ratio <= PINCH_IN_RATIO) {
        return { state: { kind: 'done' }, effect: { kind: 'pinch', direction: 'in' } };
      }
      if (ratio >= PINCH_OUT_RATIO) {
        return { state: { kind: 'done' }, effect: { kind: 'pinch', direction: 'out' } };
      }
      return { state, effect: NONE };
    }
  }
}
