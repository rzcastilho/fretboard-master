/**
 * Fit-to-screen runes store (025 data-model §1). Session only: no storage, no share-link field.
 * The Fretboard reports `FitEvent`s; the toolbar toggles the mode.
 */
import type { FitMode } from '$lib/fretboard/geometry';
import type { FitEvent } from '$lib/fretboard/types';
import type { Position } from '$lib/instrument/instrument';

let mode = $state<FitMode>('comfortable');
let available = $state(false);
let notice = $state<{ position: Position } | null>(null);
let noticeDismissed = $state(false);
let anchor = $state<Position | null>(null);

function effectiveMode(): FitMode {
  return available ? mode : 'comfortable';
}

/** Invariant: a notice exists only while the effective mode is whole. */
function dropStaleNotice(): void {
  if (effectiveMode() !== 'whole') notice = null;
}

function setMode(next: FitMode): void {
  mode = next;
  notice = null;
  noticeDismissed = false;
}

export const fit = {
  get mode(): FitMode {
    return mode;
  },
  get available(): boolean {
    return available;
  },
  get effective(): FitMode {
    return effectiveMode();
  },
  get notice(): { position: Position } | null {
    return notice;
  },

  toggle(): void {
    if (!available) return;
    setMode(mode === 'whole' ? 'comfortable' : 'whole');
  },

  handle(event: FitEvent): void {
    switch (event.kind) {
      case 'overflow':
        available = event.value;
        dropStaleNotice();
        return;
      case 'small-tap':
        if (effectiveMode() === 'whole' && !noticeDismissed) {
          notice = { position: event.position };
        }
        return;
    }
  },

  acceptNotice(): void {
    if (!notice) return;
    anchor = notice.position;
    setMode('comfortable');
  },

  dismissNotice(): void {
    notice = null;
    noticeDismissed = true;
  },

  /** One-shot: the position to centre after the next switch; consumed by the Fretboard. */
  takeAnchor(): Position | null {
    const a = anchor;
    anchor = null;
    return a;
  }
};

/** Test seam: back to the initial state (Vitest only). */
export function resetFitForTests(): void {
  mode = 'comfortable';
  available = false;
  notice = null;
  noticeDismissed = false;
  anchor = null;
}
