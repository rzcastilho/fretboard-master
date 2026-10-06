/**
 * Supported interface languages and device matching (contracts/language-api.md §1).
 * Pure: no DOM, Svelte, Paraglide or storage. Autonyms live in the catalogs (`language_autonym`).
 */
import type { Notation } from '$lib/notation/policy';

export const LANGUAGES = [
  { tag: 'en', primary: 'en', notation: 'letters' },
  { tag: 'pt-BR', primary: 'pt', notation: 'letters' },
  { tag: 'es', primary: 'es', notation: 'solfege' }
] as const satisfies readonly { tag: string; primary: string; notation: Notation }[];

export type LanguageTag = (typeof LANGUAGES)[number]['tag'];

export const LANGUAGE_TAGS: readonly LanguageTag[] = LANGUAGES.map((l) => l.tag);

export const BASE_LANGUAGE: LanguageTag = 'en';

export function isLanguageTag(x: unknown): x is LanguageTag {
  return typeof x === 'string' && (LANGUAGE_TAGS as readonly string[]).includes(x);
}

/** The notation a language uses until the user picks one (021). */
export function defaultNotation(tag: LanguageTag): Notation {
  return LANGUAGES.find((l) => l.tag === tag)?.notation ?? 'letters';
}

const WELL_FORMED = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

/**
 * First device tag whose primary subtag is supported wins (case-insensitive); empty or malformed
 * tags are skipped; no match gives English. Total: never throws.
 */
export function matchDeviceLanguage(tags: readonly string[]): LanguageTag {
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim();
    if (!WELL_FORMED.test(tag)) continue;
    const primary = (tag.split('-')[0] ?? '').toLowerCase();
    const hit = LANGUAGES.find((l) => l.primary === primary);
    if (hit) return hit.tag;
  }
  return BASE_LANGUAGE;
}
