/**
 * Supported interface languages and device matching (contracts/language-api.md §1).
 * Pure: no DOM, Svelte, Paraglide or storage. Autonyms live in the catalogs (`language_autonym`).
 */
export const LANGUAGES = [
  { tag: 'en', primary: 'en' },
  { tag: 'pt-BR', primary: 'pt' },
  { tag: 'es', primary: 'es' }
] as const;

export type LanguageTag = (typeof LANGUAGES)[number]['tag'];

export const LANGUAGE_TAGS: readonly LanguageTag[] = LANGUAGES.map((l) => l.tag);

export const BASE_LANGUAGE: LanguageTag = 'en';

export function isLanguageTag(x: unknown): x is LanguageTag {
  return typeof x === 'string' && (LANGUAGE_TAGS as readonly string[]).includes(x);
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
