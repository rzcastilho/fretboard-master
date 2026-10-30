/**
 * Keyboard shortcuts switch and dispatcher (027, contracts/pure-api.md §3). The dispatcher
 * calls the very store methods the on-screen controls call, so a shortcut never drifts from its
 * control. It does not check `enabled` (the layout does) and never touches the DOM.
 */
import { INVERSIONS } from '$lib/theory/triad-shape';
import type { ScreenId } from '$lib/shell/screens';
import { caged } from './caged.svelte';
import { notation } from './notation.svelte';
import { notes } from './notes.svelte';
import { preferences } from './preferences.svelte';
import {
  CAGED_LABEL_ORDER,
  NOTES_LABEL_ORDER,
  TRIADS_LABEL_ORDER,
  cycle,
  type ShortcutAction
} from './shortcuts';
import { triads } from './triads.svelte';

let enabled = $state(true);

export const shortcuts = {
  get enabled(): boolean {
    return enabled;
  },

  /** Called once from `preferences.start()`. No write. */
  start(stored: boolean): void {
    enabled = stored;
  },

  /** Explicit pick: applied synchronously, then remembered (fire-and-forget). */
  choose(on: boolean): void {
    enabled = on;
    preferences.remember({ shortcuts: on });
  },

  /** Non-persisting (erase). */
  restore(on: true): void {
    enabled = on;
  }
};

function stepInversion(dir: 1 | -1): boolean {
  if (!triads.display.controls.inversion) return false;
  const next = cycle(INVERSIONS, triads.state.inversion, dir, true);
  if (next === null) return false;
  triads.setInversion(next);
  return true;
}

function stepShape(dir: 1 | -1): boolean {
  const steps = caged.display.steps;
  if (!(dir === 1 ? steps.next : steps.previous)) return false;
  caged.step(dir);
  return true;
}

function cycleLabels(screen: ScreenId): boolean {
  switch (screen) {
    case 'notes': {
      const next = cycle(NOTES_LABEL_ORDER, notes.state.labelType, 1, true);
      if (next === null) return false;
      notes.setLabelType(next);
      return true;
    }
    case 'triads': {
      const next = cycle(TRIADS_LABEL_ORDER, triads.state.labelType, 1, true);
      if (next === null) return false;
      triads.setLabelType(next);
      return true;
    }
    case 'caged': {
      const next = cycle(CAGED_LABEL_ORDER, caged.state.labelType, 1, true);
      if (next === null) return false;
      caged.setLabelType(next);
      return true;
    }
    default:
      return false;
  }
}

function listen(screen: ScreenId): boolean {
  switch (screen) {
    case 'notes':
      if (!notes.display.listen.enabled) return false;
      notes.listen();
      return true;
    case 'triads':
      if (!triads.display.listen.enabled) return false;
      triads.listen();
      return true;
    case 'caged':
      if (!caged.display.listen.enabled) return false;
      caged.listen();
      return true;
    default:
      return false;
  }
}

/** Runs the action on `screen` through the mirrored control's store method. true iff it ran. */
export function runShortcut(action: ShortcutAction, screen: ScreenId): boolean {
  // The Metronome has no character-key shortcuts (FR-023); its Space and Esc live on the page.
  if (screen === 'metronome') return false;
  switch (action) {
    case 'listen':
      return listen(screen);
    case 'next':
    case 'previous': {
      const dir = action === 'next' ? 1 : -1;
      if (screen === 'triads') return stepInversion(dir);
      if (screen === 'caged') return stepShape(dir);
      return false;
    }
    case 'labels':
      return cycleLabels(screen);
    case 'notation':
      notation.choose(notation.effective === 'letters' ? 'solfege' : 'letters');
      return true;
  }
}

/** Test seam: back to enabled (Vitest only). */
export function resetShortcutsForTests(): void {
  enabled = true;
}
