# Data Model: English, Portuguese, and Spanish (020)

Phase 1 output for [plan.md](./plan.md). Decisions referenced as R-NN are in
[research.md](./research.md).

## 1. Language (supported-language list)

Module: `src/lib/i18n/languages.ts` (pure; no DOM, no Svelte, no Paraglide import).

| Field     | Type                          | Rule                                                   |
| --------- | ----------------------------- | ------------------------------------------------------ |
| `tag`     | `'en' \| 'pt-BR' \| 'es'`     | BCP 47 tag; equals a Paraglide locale and a catalog filename |
| `primary` | `'en' \| 'pt' \| 'es'`        | Lower-case primary subtag used by device matching       |

```ts
export const LANGUAGES = [
  { tag: 'en', primary: 'en' },
  { tag: 'pt-BR', primary: 'pt' },
  { tag: 'es', primary: 'es' }
] as const;
export type LanguageTag = (typeof LANGUAGES)[number]['tag'];
export const BASE_LANGUAGE: LanguageTag = 'en';
```

Validation / invariants
- Order is the selector order (English, Português, Español) and never depends on the active UI
  language.
- `LANGUAGES.map(l => l.tag)` equals Paraglide `locales` and `project.inlang/settings.json`
  `locales` in the same order (unit test, R-15).
- `primary` values are unique.
- Autonyms (`English`, `Português`, `Español`) are catalog text (Constitution VIII), not data:
  each catalog holds `language_autonym` = its own language's name, and the selector reads it with
  Paraglide's per-call locale option, `m.language_autonym({}, { locale: tag })`, so every option
  shows its autonym regardless of the active UI language.

Functions (pure, test-first)
- `isLanguageTag(x: unknown): x is LanguageTag`
- `matchDeviceLanguage(tags: readonly string[]): LanguageTag` — R-03 rule; total, never throws.

## 2. Language preference (preferences record, v1)

Module: `src/lib/prefs/schema.ts` (existing). Additive optional field; `PREFS_VERSION` stays `1`.

| Stored key | In-memory field | Type | Absent / invalid → |
| --- | --- | --- | --- |
| `language` | `language` | `LanguageTag \| null` | `null` (= no stored choice) |

- Parsed with `v.fallback(v.nullable(v.picklist(LANGUAGE_TAGS)), null)`; any other value
  (`'pt'`, `'fr'`, `'PT-BR'`, number, object) → `null`; the rest of the record is unaffected
  (constitution IX).
- `DEFAULT_PREFERENCES.language = null`.
- Serialized only when non-null, placed after `tempo` (add-only key order; a record without a
  language stays byte-identical to slice 019's output).
- Written only by `language.choose(tag)` (explicit pick, including re-picking the active
  language). Never written by detection, start, or erase.
- Never encoded into share links, URLs, cookies, or any other storage key (DM-17).

Example v1 record with a choice:

```json
{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"},"language":"pt-BR"}
```

New fixtures (add-only, `tests/unit/prefs/fixtures/`): `language-pt.txt` (valid `pt-BR`),
`language-es.txt`, `bad-language.txt` (`"language":"pt"` → `null`, other fields kept),
`language-number.txt` (`"language":3` → `null`).

## 3. Active language (runtime state)

Module: `src/lib/state/language.svelte.ts` (runes store; the DOM edge for `navigator` and
`document.documentElement.lang`).

| State | Type | Meaning |
| --- | --- | --- |
| `current` | `$state<LanguageTag>` | Active interface language; read by Paraglide via `overwriteGetLocale` |
| `chosen` | `$state<LanguageTag \| null>` | Stored explicit choice for this session (null = following device) |

State transitions

```text
            start(stored)                     choose(tag)                    restore(null) [erase]
 (unset) ──────────────────▶ resolved ───────────────────────▶ chosen ──────────────────────▶ resolved
   stored valid → current = stored, chosen = stored          current = tag, chosen = tag,     current = device match,
   else        → current = device match, chosen = null       preferences.remember({language})  chosen = null, no write
```

Side effects on every change of `current`: `document.documentElement.lang = current`;
`reportGaps(current)` (§5). Nothing else: no URL change, no history entry, no network, no
remount, playback untouched.

## 4. Text catalog

Files: `messages/en.json` (source of keys), `messages/pt-BR.json`, `messages/es.json`;
registered in `project.inlang/settings.json` `locales: ["en", "pt-BR", "es"]`.

Rules (enforced by `tests/unit/i18n/catalogs.test.ts`, R-08)
- Identical key sets; `$schema` excluded from comparison.
- Every value non-empty.
- Identical `{placeholder}` sets per key across languages.
- Non-English value ≠ English value, except keys listed in
  `tests/unit/i18n/identical-allowlist.ts`; allowlist entries must exist and be identical
  (no stale entries).
- Count-dependent sentences use `_one` / `_other` key pairs (R-07); every sentence containing a
  value is one parameterized message (FR-016).
- English-kept catalog values (the allowlist seed): `app_name`, `title_screen`, `tuning_af4`
  (Drop D), `tuning_af5` (Drop C), `tuning_af6` (Double Drop D), `tuning_af7` (DADGAD),
  `tuning_af23` (Drop A), and symbolic/placeholder-only values (`sound_volume_value`
  `"{value} %"`, `note_spoken_natural` `"{letter}"`, `card_label` `"{name} — {question}"`).
  CAGED shape letters (`CAGED_CYCLE` in theory) and non-root interval glyphs (`♭3`, `3`, `5`,
  `♭5`, `♯5`, … returned by `intervalLabel` in `src/lib/notation/notation.ts`) are code
  constants, not catalog text, and stay identical by construction.
- Language-specific values worth calling out: `interval_root` = `R` / `T` / `T`;
  `language_label` = `Language` / `Idioma` / `Idioma`; `note_spoken_sharp` =
  `{letter} sharp` / `{letter} sustenido` / `{letter} sostenido` (letters unchanged).

New keys (English shown; Portuguese and Spanish drafted from the glossary)

| Key | English |
| --- | --- |
| `language_label` | Language |
| `language_autonym` | English (pt-BR: `Português`; es: `Español`) |
| `language_open` | Language |
| `language_close` | Close language settings |
| `language_panel_label` | Language settings |

## 5. Gap log entry

Module: `src/lib/i18n/gaps.ts` (pure parts) + reporting in `language.svelte.ts`.

| Field | Type | Source |
| --- | --- | --- |
| `key` | `string` | message key absent/empty in the active catalog |
| `locale` | `LanguageTag` | active language |

- Gap list computed at build time: `findMissingKeys(en, catalog)` per non-base locale, injected
  as `__FM_MISSING_TEXT__` (declared in `src/app.d.ts`, defined in `vite.config.ts` for build and
  Vitest). Healthy build → all arrays empty.
- Emitted as `console.warn('[fretboard-master] missing text', { key, locale })`, at most once
  per (key, locale) per page session (module-level `Set<string>` of `${locale}:${key}`).
- Never persisted, never transmitted.

## 6. Trilingual glossary list

File: `docs/i18n/glossary.md` (documentation artifact, not shipped).

| Column | Content |
| --- | --- |
| English | term as used in the UI |
| Português (Brasil) | glossary equivalent (file 10 §4) |
| Español | glossary equivalent |
| Keys | catalog keys using the term |
| Review | `draft` (pre-launch native review pending) |

Includes the translated tuning-name family (Standard, Half step down, Whole step down, Open G/D/E/A,
7-string standard, 7-string half step down) flagged for review. Every key cited must exist in all
three catalogs (`tests/unit/i18n/glossary.test.ts`).

## Relationships

```text
LANGUAGES ──derives──▶ LanguageTag ──▶ prefs schema picklist (language)
     │                       └──────▶ language store (current, chosen)
     │                                      │ overwriteGetLocale
     └── equals ── Paraglide locales ◀──────┘──▶ every m.*() call / Intl.ListFormat
messages/{tag}.json ──build──▶ compiled messages (English fallback) + __FM_MISSING_TEXT__
```
