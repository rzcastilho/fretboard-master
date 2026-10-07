/**
 * Print state (contracts/pure-api.md §7). `active` is true while the print media query matches
 * or between `beforeprint` and `afterprint`, so the print layout is derived from the same
 * display model and is in the DOM before the browser snapshots the page. Never persisted,
 * never part of a share link.
 */
import { flushSync } from 'svelte';

let active = $state(false);
let started = false;

function set(next: boolean): void {
  if (active === next) return;
  active = next;
  // The print snapshot is taken right after `beforeprint` returns: render now.
  try {
    flushSync();
  } catch {
    // flushSync cannot run inside an effect; the update still lands on the next microtask.
  }
}

export const print = {
  get active(): boolean {
    return active;
  },

  /** Registers the listeners once (layout mount). No-op without `window`. */
  start(): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    const mql = typeof window.matchMedia === 'function' ? window.matchMedia('print') : undefined;
    if (mql) {
      mql.addEventListener('change', (e) => set(e.matches));
      if (mql.matches) set(true);
    }
    window.addEventListener('beforeprint', () => set(true));
    window.addEventListener('afterprint', () => set(false));
  }
};
