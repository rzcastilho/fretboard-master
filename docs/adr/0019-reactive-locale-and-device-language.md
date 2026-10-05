# ADR 0019: Reactive locale and device language

- **Status**: Accepted
- **Source**: spec 020-three-languages (research R-01, R-02, R-03, R-04, R-15)

## Context

The app ships in English, Portuguese (Brasil) and Spanish. A language switch must update every
string without a reload, without remounting components (focus, scroll, open dialogs and playback
must survive), and without a locale in the URL. Paraglide's default `setLocale` reloads the page,
and `setLocale(l, { reload: false })` is invisible to Svelte.

## Decision

- **Reactive locale through the getter.** At client start `overwriteGetLocale` and
  `overwriteSetLocale` route Paraglide to a Svelte `$state` rune in
  `src/lib/state/language.svelte.ts`. Compiled message functions read `getLocale()` on each call,
  so every `m.*()` call in a template, `$derived` or display model re-runs on switch. No call site
  changes and no `{#key}` remount. (R-01)
- **Resolve at init.** The client `init` hook (`src/hooks.client.ts`) resolves the language right
  after `preferences.start()`: stored `language` if valid, else device match. `language.start()`
  sets the rune and `<html lang>`; `choose()` keeps `<html lang>` in sync later. Prerendered HTML
  stays English; Svelte hydration patches differing text in place. Detection never writes
  storage. (R-02)
- **Device matching is a pure function.** `matchDeviceLanguage(tags)` in
  `src/lib/i18n/languages.ts` skips malformed tags, compares the lower-cased primary subtag, and
  first hit wins; no hit gives `en`. So `pt-PT` gives `pt-BR`, `es-419` gives `es`. No
  `Intl.Locale` (throws on malformed input). (R-03)
- **Gaps warn at activation time.** Paraglide silently compiles a missing key as the English
  text, so fallback display is built in but the signal is not. `vite.config.ts` computes missing
  keys per locale with `findMissingKeys` (`src/lib/i18n/gaps.ts`) and injects
  `__FM_MISSING_TEXT__`. `language.svelte.ts` logs `[fretboard-master] missing text` once per key
  per locale per session when a locale becomes active. (R-04)
- **Languages are data.** `LANGUAGES` is the single list; a unit test requires it to equal
  Paraglide `locales` and `project.inlang/settings.json`. See `docs/i18n/glossary.md` for the
  steps to add a language. (R-15)

## Consequences

- Switching language is a rune write; nothing remounts and nothing reloads.
- Message functions must be called at render time. A module top-level `const x = m.key()` is
  frozen in the first locale and is forbidden.
- A healthy build ships empty gap arrays (a few bytes).
- A hydration pass patches text for non-English first loads; a Playwright check asserts no
  `hydration_mismatch` warning.

## Alternatives considered

- **`{#key locale}` around the layout** (R-01): remounts everything, loses focus, scroll, dialog
  and playback state.
- **Paraglide `url`, `cookie` or `localStorage` strategies** (R-01): change the URL, need a cookie,
  or write on detection.
- **Resolve in `onMount`** (R-02): flashes English on first render.
- **Prerender one HTML per locale** (R-02): needs locale URLs.
- **Paraglide `preferredLanguage` strategy** (R-03): exact-tag matching, no `pt-PT` to `pt-BR`.
- **Rewrite compiled fallbacks, or wrap `m` in a `Proxy`** (R-04): couples to undocumented
  compiler output, or touches every import and hot paths.
- **Diff full catalogs at runtime** (R-04): duplicates catalog text in the bundle.
