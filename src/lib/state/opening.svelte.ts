/**
 * Opening store (specs/023 data-model §3). Applies the link of a full page load once, before
 * hydration, and holds the "this link was incomplete" notice. Writes nothing to storage: the
 * opened view and any instrument override live in memory for this load only.
 */
import { isIncomplete, readReceivedHref, toolOfHref } from '$lib/link/receive';
import { musicalOf } from '$lib/link/types';
import type { ToolId } from '$lib/shell/tools';
import { caged } from './caged.svelte';
import { instrument } from './instrument.svelte';
import { notes } from './notes.svelte';
import { triads } from './triads.svelte';

export type OpeningScreen = ToolId | 'home';

/** Incomplete-link notice target; null when hidden. */
let incomplete = $state.raw<{ readonly screen: OpeningScreen } | null>(null);
let started = false;

export const opening = {
  get incomplete(): { readonly screen: OpeningScreen } | null {
    return incomplete;
  },
  /**
   * Called once from `hooks.client` `init`, after `preferences.start()`. Idempotent. Never throws:
   * a failure leaves the tool on its normal state and raises the incomplete notice (O2).
   */
  start(href: string): void {
    if (started) return;
    started = true;
    try {
      const r = readReceivedHref(href, musicalOf(instrument.active));
      if (r.kind === 'none') return;
      if (r.kind === 'unknown-tool') {
        incomplete = { screen: 'home' };
        return;
      }
      const s = r.snapshot;
      // Instrument first: the view is revalidated against the instrument it is drawn on.
      instrument.receive(s.tool, s.instrument);
      if (s.tool === 'notes') notes.receive(s.view);
      else if (s.tool === 'triads') triads.receive(s.view);
      else caged.receive(s.view, s.temporary);
      if (isIncomplete(r)) incomplete = { screen: s.tool };
    } catch {
      const tool = toolOfHref(href);
      incomplete = { screen: tool ?? 'home' };
    }
  },
  dismissIncomplete(): void {
    incomplete = null;
  },
  /** A real screen change drops the incomplete notice; it is not shown again this session. */
  screenChanged(): void {
    incomplete = null;
  }
};

/** Test seam: forget that the link was applied and drop the notice (Vitest only). */
export function resetOpeningForTests(): void {
  incomplete = null;
  started = false;
}
