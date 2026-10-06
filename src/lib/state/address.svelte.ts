/**
 * SvelteKit binding for address sync (specs/022 contracts/link-api §3). The address bar follows
 * the view through `replaceState` only: no history entry is ever added (FR-014).
 */
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { ToolId } from '$lib/shell/tools';
import { createAddressSync } from './address';
import { currentLink } from './share.svelte';

export const ADDRESS_DEBOUNCE_MS = 150;

/** A failed write turns sync off for this tool screen until `openToolAddress` runs (A3). */
let syncDisabled = false;
/** Last link requested, re-applied after a shallow-history pop restores an older URL. */
let latest: string | null = null;
let listening = false;

function write(href: string): void {
  if (syncDisabled) return;
  try {
    const url = new URL(href);
    if (url.pathname !== location.pathname) return; // A2: never write another screen's link
    if (url.href === location.href) return;
    // The href is a same-origin absolute URL built by the link codec, not an app route to resolve.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    replaceState(url, page.state);
  } catch {
    syncDisabled = true;
  }
}

const sync = createAddressSync({
  write,
  delayMs: ADDRESS_DEBOUNCE_MS,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
});

function onPopState(): void {
  // The instrument panel's history.back() restores the URL it was opened from.
  if (latest !== null) sync.schedule(latest);
}

/** Tool screen mounted: replace the address with the canonical link right away (A5 seam for 006/002). */
export function openToolAddress(tool: ToolId): void {
  syncDisabled = false;
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('popstate', onPopState);
    listening = true;
  }
  sync.cancel();
  const href = currentLink(tool);
  latest = href;
  // On a first load, `onMount` runs before SvelteKit's router finishes hydrating and
  // `replaceState` would throw (which would disable sync for the screen). A microtask is enough:
  // the root component is assigned as soon as the synchronous hydrate call returns.
  queueMicrotask(() => {
    if (latest === href) write(href);
  });
}

export function scheduleAddress(href: string): void {
  latest = href;
  sync.schedule(href);
}

/** Leaving the screen: drop any pending write so it cannot land on the next screen. */
export function cancelAddress(): void {
  latest = null;
  sync.cancel();
}

export function resetAddressForTests(): void {
  sync.cancel();
  latest = null;
  syncDisabled = false;
  if (listening) window.removeEventListener('popstate', onPopState);
  listening = false;
}
