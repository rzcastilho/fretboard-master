/**
 * Active interface language (contracts/language-api.md §3). The DOM edge for `navigator` and
 * `document.documentElement.lang`; Paraglide reads the locale through the overrides installed on
 * the first `start`. Switching never reloads, navigates, fetches or resets other stores.
 */
import { GAP_WARNING, takeUnreported } from '$lib/i18n/gaps';
import { BASE_LANGUAGE, matchDeviceLanguage, type LanguageTag } from '$lib/i18n/languages';
import { overwriteGetLocale, overwriteSetLocale } from '$lib/paraglide/runtime.js';
import { preferences } from './preferences.svelte';

let current = $state<LanguageTag>(BASE_LANGUAGE);
let chosen = $state<LanguageTag | null>(null);
let started = false;
// Plain bookkeeping, never read by rendering.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const seen = new Set<string>();

function deviceTags(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  const list = navigator.languages;
  if (Array.isArray(list) && list.length > 0) return list;
  return navigator.language ? [navigator.language] : [];
}

function apply(tag: LanguageTag): void {
  current = tag;
  if (typeof document !== 'undefined') document.documentElement.lang = tag;
  const missing = typeof __FM_MISSING_TEXT__ === 'undefined' ? [] : __FM_MISSING_TEXT__[tag];
  for (const key of takeUnreported(seen, tag, missing)) {
    console.warn(GAP_WARNING, { key, locale: tag });
  }
}

export const language = {
  get current(): LanguageTag {
    return current;
  },
  get chosen(): LanguageTag | null {
    return chosen;
  },

  /** Called once from `preferences.start()` before hydration. Idempotent. */
  start(stored: LanguageTag | null): void {
    if (started) return;
    started = true;
    overwriteGetLocale(() => current);
    overwriteSetLocale((l) => apply(l as LanguageTag));
    chosen = stored;
    apply(stored ?? matchDeviceLanguage(deviceTags()));
  },

  /** Explicit pick: apply and remember (also when `tag` is already active). */
  choose(tag: LanguageTag): void {
    apply(tag);
    chosen = tag;
    preferences.remember({ language: tag });
  },

  /** Non-persisting: `null` re-resolves from the device (erase); a tag applies as is. */
  restore(stored: LanguageTag | null): void {
    chosen = stored;
    apply(stored ?? matchDeviceLanguage(deviceTags()));
  }
};

/** Test seam: forget start state and the reported gaps (Vitest only). */
export function resetLanguageForTests(): void {
  started = false;
  current = BASE_LANGUAGE;
  chosen = null;
  seen.clear();
  if (typeof document !== 'undefined') document.documentElement.lang = '';
}
