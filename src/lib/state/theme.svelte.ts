/**
 * Theme choice (contracts/pure-api.md §6). `device` means no pin: the stylesheet follows the
 * device through `color-scheme: light dark`. A pin sets `html[data-theme]`; the boot script
 * (`static/theme-boot.js`) applies a stored pin before first paint, this store takes over
 * after hydration. Never part of a share link.
 */
import { preferences } from './preferences.svelte';

/** Structurally the codec's `Theme`; only `preferences.svelte.ts` may import `$lib/prefs`. */
type Theme = 'light' | 'dark';

export type ThemeChoice = 'device' | Theme;

let choice = $state<ThemeChoice>('device');

function apply(c: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  if (c === 'device') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = c;
}

export const theme = {
  get choice(): ThemeChoice {
    return choice;
  },

  /** Called once from `preferences.start()`. Applies the stored pin. */
  start(stored: Theme | null): void {
    choice = stored ?? 'device';
    apply(choice);
  },

  /** Explicit pick: applied synchronously, then remembered (fire-and-forget). */
  choose(c: ThemeChoice): void {
    choice = c;
    apply(c);
    preferences.remember({ theme: c === 'device' ? null : c });
  },

  /** Non-persisting (erase). */
  restore(stored: null): void {
    choice = stored ?? 'device';
    apply(choice);
  }
};

/** Test seam: back to Follow device, attribute removed (Vitest only). */
export function resetThemeForTests(): void {
  choice = 'device';
  apply('device');
}
