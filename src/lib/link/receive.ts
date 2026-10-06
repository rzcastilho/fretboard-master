/**
 * Receive side of share links (specs/023 data-model §1). Turns the address of a full page load
 * into a validated view. Total: never throws. Pure: no Svelte, DOM, i18n or storage.
 */
import { decodeToolParams, toolOfPath } from './decode';
import { parseVersion } from './schema';
import { LINK_VERSION } from './encode';
import type { LinkInstrument, LinkTool, ShareSnapshot } from './types';

/** What a full page load's address means to the app. */
export type ReceivedLink =
  /** Not a link: bare tool path, home, about, or a 404 without `v`. */
  | { readonly kind: 'none' }
  /** A non-tool path whose query has a `v` key. */
  | { readonly kind: 'unknown-tool' }
  | {
      readonly kind: 'tool';
      /** Validated view and the resolved link instrument. */
      readonly snapshot: ShareSnapshot;
      /** Param keys that were missing, invalid or clamped and took a default. */
      readonly fellBack: readonly string[];
      /** `v` missing, non-integer or not the supported version: the notice always shows. */
      readonly forcedNotice: boolean;
    };

/** Read the link in `url`. Missing or invalid instrument fields take `stored`. */
export function readReceivedLink(url: URL, stored: LinkInstrument): ReceivedLink {
  try {
    const tool = toolOfPath(url.pathname);
    if (tool === undefined) {
      return url.searchParams.has('v') ? { kind: 'unknown-tool' } : { kind: 'none' };
    }
    if (url.search === '' || url.search === '?') return { kind: 'none' };
    const { snapshot, fellBack } = decodeToolParams(tool, url.searchParams, {
      instrument: stored,
      pairInstrument: true
    });
    return {
      kind: 'tool',
      snapshot,
      fellBack,
      forcedNotice: parseVersion(url.searchParams.get('v')) !== LINK_VERSION
    };
  } catch {
    // Never blank (Constitution X): open the tool on its defaults and say the link was incomplete.
    return fallbackFor(url, stored);
  }
}

/** `readReceivedLink` for an address string (a `URL` is not reactive state, so Svelte stores call this). */
export function readReceivedHref(href: string, stored: LinkInstrument): ReceivedLink {
  return readReceivedLink(new URL(href), stored);
}

/** Tool whose path `href` is on, or `undefined` for any other address (never throws). */
export function toolOfHref(href: string): LinkTool | undefined {
  try {
    return toolOfPath(new URL(href).pathname);
  } catch {
    return undefined;
  }
}

function fallbackFor(url: URL, stored: LinkInstrument): ReceivedLink {
  try {
    const tool = toolOfPath(url.pathname);
    if (tool === undefined) return { kind: 'none' };
    const { snapshot } = decodeToolParams(tool, new URLSearchParams(), {
      instrument: stored,
      pairInstrument: true
    });
    return { kind: 'tool', snapshot, fellBack: ['*'], forcedNotice: true };
  } catch {
    return { kind: 'none' };
  }
}

/** True when the "this link was incomplete" notice applies. */
export const isIncomplete = (r: ReceivedLink): boolean =>
  r.kind === 'unknown-tool' || (r.kind === 'tool' && (r.fellBack.length > 0 || r.forcedNotice));
