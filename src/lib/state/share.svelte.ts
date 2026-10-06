/**
 * Share store (specs/022 contracts/link-api §2). Builds the snapshot and link of the visible
 * view and runs the share cascade: system sheet (coarse pointer only), clipboard with a
 * confirmation notice, manual-copy fallback. Nothing here fetches or writes to storage.
 * Module singleton: survives navigation, resets on reload.
 */
// Deep imports on purpose: the `$lib/link` barrel also re-exports the decoder, whose top-level
// Valibot schemas the bundler keeps (side effects) and which nothing in the app uses yet.
import { encodeLink } from '$lib/link/encode';
import type { ShareSnapshot } from '$lib/link/types';
import type { ToolId } from '$lib/shell/tools';
import { caged } from './caged.svelte';
import { instrument } from './instrument.svelte';
import { notes } from './notes.svelte';
import { triads } from './triads.svelte';

/** Platform capabilities, read lazily at call time (R-07). */
export interface SharePlatform {
  /** `navigator.share` bound, or null when the device has no share sheet. */
  readonly share: ((data: { url: string; title: string }) => Promise<void>) | null;
  /** `navigator.clipboard.writeText` bound, or null when unavailable. */
  readonly writeText: ((text: string) => Promise<void>) | null;
  /** `matchMedia('(pointer: coarse)')`: touch is the primary input. */
  readonly coarsePointer: boolean;
}

export interface ShareClock {
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export const NOTICE_MS = 4000;

const browserPlatform: SharePlatform = {
  get share() {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return null;
    return (data: { url: string; title: string }) => navigator.share(data);
  },
  get writeText() {
    if (typeof navigator === 'undefined') return null;
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (!clipboard || typeof clipboard.writeText !== 'function') return null;
    return (text: string) => clipboard.writeText(text);
  },
  get coarsePointer() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }
};

const browserClock: ShareClock = {
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

let platform: SharePlatform = browserPlatform;
let clock: ShareClock = browserClock;

let busy = $state(false);
let notice = $state.raw<{ readonly id: number } | null>(null);
let fallback = $state.raw<{ readonly href: string } | null>(null);
let noticeSeq = 0;
let noticeTimer: unknown = null;
let opener: HTMLElement | null = null;

export function currentSnapshot(tool: ToolId): ShareSnapshot {
  // What is drawn: the link's instrument while a received link overrides it (023 I6).
  const musical = instrument.effectiveFor(tool);
  switch (tool) {
    case 'notes':
      return { tool: 'notes', view: notes.state, instrument: musical };
    case 'triads':
      return { tool: 'triads', view: triads.state, instrument: musical };
    case 'caged':
      return { tool: 'caged', view: caged.state, instrument: musical, temporary: caged.temporary };
  }
}

export function currentLink(tool: ToolId): string {
  return encodeLink(currentSnapshot(tool), location.origin);
}

function clearNoticeTimer(): void {
  if (noticeTimer === null) return;
  clock.clearTimer(noticeTimer);
  noticeTimer = null;
}

function showNotice(): void {
  clearNoticeTimer();
  fallback = null;
  noticeSeq += 1;
  notice = { id: noticeSeq };
  noticeTimer = clock.setTimer(() => {
    noticeTimer = null;
    notice = null;
  }, NOTICE_MS);
}

function showFallback(href: string): void {
  clearNoticeTimer();
  notice = null;
  fallback = { href };
}

const isAbort = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'AbortError';

/** Clipboard, then the manual-copy fallback. Never throws. */
async function copy(href: string): Promise<void> {
  const writeText = platform.writeText;
  if (writeText === null) {
    showFallback(href);
    return;
  }
  try {
    await writeText(href);
    showNotice();
  } catch {
    showFallback(href);
  }
}

async function run(tool: ToolId, title: string): Promise<void> {
  const url = currentLink(tool);
  const shareSheet = platform.share;
  if (shareSheet !== null && platform.coarsePointer) {
    try {
      await shareSheet({ url, title });
      return;
    } catch (error) {
      // A dismissed sheet is the person's choice: show nothing and do not copy.
      if (isAbort(error)) return;
    }
  }
  await copy(url);
}

export const share = {
  get busy(): boolean {
    return busy;
  },
  get notice(): { readonly id: number } | null {
    return notice;
  },
  get fallback(): { readonly href: string } | null {
    return fallback;
  },
  /** Runs the system sheet → clipboard → manual-copy cascade. Never rejects. */
  async share(tool: ToolId, title: string): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await run(tool, title);
    } catch {
      // Defensive: link generation or a throwing platform must not reach the UI.
      try {
        showFallback(currentLink(tool));
      } catch {
        // Nothing left to show.
      }
    } finally {
      busy = false;
    }
  },
  dismissNotice(): void {
    clearNoticeTimer();
    notice = null;
  },
  /** Closes the panel and returns focus to the registered Share button. */
  closeFallback(): void {
    if (fallback === null) return;
    fallback = null;
    opener?.focus();
  },
  /** Closes the panel without moving focus (tool change or unmount). */
  dismissFallback(): void {
    fallback = null;
  },
  /** Closes the fallback when the link it shows is no longer the current one. */
  viewChanged(href: string): void {
    if (fallback !== null && fallback.href !== href) share.closeFallback();
  },
  registerOpener(el: HTMLElement | null): void {
    opener = el;
  }
};

/** Test seam: replace the platform (Vitest only). */
export function useSharePlatformForTests(p: SharePlatform): void {
  platform = p;
}

/** Test seam: replace the timers (Vitest only). */
export function useShareClockForTests(c: ShareClock): void {
  clock = c;
}

/** Test seam: back to the browser platform and an empty state (Vitest only). */
export function resetShareForTests(): void {
  clearNoticeTimer();
  platform = browserPlatform;
  clock = browserClock;
  busy = false;
  notice = null;
  fallback = null;
  noticeSeq = 0;
  opener = null;
}
