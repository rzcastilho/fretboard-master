# Contract: Language modules (internal API)

Module-level contracts for slice 020. Types and rules in [data-model.md](../data-model.md);
decisions in [research.md](../research.md).

## 1. `src/lib/i18n/languages.ts` (pure)

```ts
export const LANGUAGES: readonly [
  { readonly tag: 'en'; readonly primary: 'en' },
  { readonly tag: 'pt-BR'; readonly primary: 'pt' },
  { readonly tag: 'es'; readonly primary: 'es' }
];
// Autonyms are not in this module: they are the catalog key `language_autonym`
// (en "English", pt-BR "Português", es "Español"), read per option with
// `m.language_autonym({}, { locale: tag })` (Constitution VIII).
export type LanguageTag = 'en' | 'pt-BR' | 'es';
export const LANGUAGE_TAGS: readonly LanguageTag[];
export const BASE_LANGUAGE: LanguageTag; // 'en'
export function isLanguageTag(x: unknown): x is LanguageTag;
export function matchDeviceLanguage(tags: readonly string[]): LanguageTag;
```

`matchDeviceLanguage` table (all MUST hold; test-first):

| Input | Output |
| --- | --- |
| `['pt-PT']` | `pt-BR` |
| `['pt-BR']` | `pt-BR` |
| `['es-ES']`, `['es-MX']`, `['es-419']`, `['es-AR']` | `es` |
| `['en-GB']`, `['en-US']`, `['EN-au']` | `en` |
| `['fr']`, `['ja']`, `[]` | `en` |
| `['fr-FR', 'es-MX']` | `es` |
| `['', '  ', 'x_y', 'pt']` | `pt-BR` (empty/malformed skipped) |
| `['de', 'pt-PT', 'es']` | `pt-BR` (first supported wins) |

Never throws. Imports nothing from DOM, Svelte, Paraglide, or storage (ESLint boundary added
for `src/lib/i18n/**` like `src/lib/notation/**`, with `navigator`, `window`, `document`,
`localStorage` restricted).

## 2. `src/lib/i18n/gaps.ts` (pure)

```ts
export type Catalog = Readonly<Record<string, unknown>>;
/** Keys in `base` (excluding `$schema`) absent from `catalog` or whose value is '' / not a string-or-array. */
export function findMissingKeys(base: Catalog, catalog: Catalog): string[];
/** Returns the subset of `keys` not yet in `seen` for `locale`, adding them to `seen`. */
export function takeUnreported(seen: Set<string>, locale: string, keys: readonly string[]): string[];
export const GAP_WARNING = '[fretboard-master] missing text';
```

Also imported by `vite.config.ts` (relative import) to build
`__FM_MISSING_TEXT__: Readonly<Record<LanguageTag, readonly string[]>>`; `en` is always `[]`.

## 3. `src/lib/state/language.svelte.ts` (runes store, DOM edge)

```ts
export const language: {
  readonly current: LanguageTag;          // reactive
  readonly chosen: LanguageTag | null;    // reactive; null = following device
  /** Called once from preferences.start() before hydration. Idempotent. */
  start(stored: LanguageTag | null): void;
  /** Explicit user pick: apply + remember (also when tag === current). */
  choose(tag: LanguageTag): void;
  /** Non-persisting: null → re-resolve from device (erase); tag → apply. */
  restore(stored: LanguageTag | null): void;
};
export function resetLanguageForTests(): void;
```

Behavior
- First `start` installs `overwriteGetLocale(() => current)` and
  `overwriteSetLocale((l) => apply(l))` from `$lib/paraglide/runtime.js`.
- Device tags: `navigator.languages` if non-empty array, else `[navigator.language]`, else `[]`
  (guarded for missing `navigator`).
- Every apply: `current = tag`; `document.documentElement.lang = tag`; for each key from
  `takeUnreported(seen, tag, __FM_MISSING_TEXT__[tag])` → `console.warn(GAP_WARNING, { key, locale: tag })`.
- `choose(tag)`: apply; `chosen = tag`; `preferences.remember({ language: tag })` (no-op when
  storage unavailable — the switch still holds for the session).
- Never: reload, `goto`, `pushState`, `replaceState`, `fetch`, cookie, `playback.stop()`, store
  resets.

## 4. Preferences integration (`src/lib/prefs/schema.ts`, `src/lib/state/preferences.svelte.ts`)

- `Preferences.language: LanguageTag | null`; `DEFAULT_PREFERENCES.language = null`.
- Schema: `language: v.fallback(v.nullable(v.picklist(LANGUAGE_TAGS)), null)`.
- `serializePreferences`: `...(p.language === null ? {} : { language: p.language })` after
  `tempo`.
- `preferences.start()`: after existing restores, `language.start(p.language)`.
- `preferences.erase()`: after existing restores, `language.restore(null)`.
- `PreferencesPatch` already accepts any field; `language: null` is never written by the app.

## 5. Catalog contract (`messages/*.json`)

See data-model §4. Enforced by `tests/unit/i18n/catalogs.test.ts`:

| Check | Failure example |
| --- | --- |
| identical key sets | `pt-BR.json` lacks `language_close` |
| non-empty values | `"es": { "nav_home": "" }` |
| identical placeholders | `"{count} trastes"` vs English `"{count} frets"` ✔; `"{n} trastes"` ✘ |
| differs from English unless allowlisted | `"nav_about": "About"` in `es.json` ✘ |
| allowlist not stale | allowlisted key that now differs ✘ |
| locales registered | `settings.json` locales ≠ `LANGUAGES` tags ✘ |
