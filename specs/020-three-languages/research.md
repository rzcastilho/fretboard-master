# Research: English, Portuguese, and Spanish (020)

Phase 0 output for [plan.md](./plan.md). Every unknown from Technical Context is resolved here.
Findings marked **(measured)** were checked in this worktree on 2026-10-05 against the installed
toolchain (`@inlang/paraglide-js` 2.25.4, Svelte 5, SvelteKit 2) by compiling a throwaway
three-locale inlang project and by building the current `main` state.

---

## R-01 — How the active locale becomes reactive without a reload

**Decision**: Keep Paraglide's compiled message functions and its `baseLocale` strategy (so
prerender stays English), and at client start call `overwriteGetLocale(() => current)` and
`overwriteSetLocale((l) => { current = l })`, where `current` is a Svelte `$state` rune held in
`src/lib/state/language.svelte.ts`. Every compiled message reads `getLocale()` when called, so any
template expression, `$derived`, or display-model function that calls `m.*()` (or
`Intl.ListFormat(getLocale())` in `src/lib/notation/notation.ts`) takes a dependency on the rune
and re-runs on switch. Nothing remounts.

**Rationale**: Paraglide 2's default `setLocale` reloads the page (`reload: true`) — forbidden by
FR-004. `setLocale(l, { reload: false })` changes Paraglide's internal variable but Svelte does
not observe it, so text would not update. Routing the getter through a rune makes the existing
~58 `m.*` call sites reactive with zero edits. Display models (`notes-model.ts`,
`triads-model.ts`, `caged-model.ts`, `fretboard/description.ts`) are pure functions already
evaluated inside `$derived` stores (ADR 0008), so they recompute too. (measured: runtime exports
`overwriteGetLocale`, `overwriteSetLocale`, `locales`, `baseLocale`.)

**Alternatives considered**:
- `{#key locale}` around the layout: remounts every component — loses focus, scroll, open
  `<dialog>` state, component-local state, and restarts playback hosts. Violates FR-004.
- Paraglide `url` / `cookie` / `localStorage` strategies: change the URL, need a cookie, or
  write storage on detection (FR-002 forbids writes on detection; DM-17 forbids URL locale).
- `globalVariable` strategy + manual re-render trigger: same non-reactivity problem.

## R-02 — Where the locale is resolved, and hydration

**Decision**: Resolve in the existing client `init` hook (`src/hooks.client.ts`), right after
`preferences.start()` reads the stored record: stored `language` if valid, else device match
(R-03). `language.start()` sets the rune, `document.documentElement.lang`, and nothing else.
`<title>` already comes from `screenTitle()` inside `<svelte:head>` and follows the rune.
`<html lang>` is kept in sync on later switches by the store's `choose()` (direct DOM write, one
place). Prerendered HTML stays English (`app.html` keeps `lang="en"`).

**Rationale**: ADR 0013 already restores a non-default instrument in `init` before hydration
(slices 010–019 hydrate pages whose prerendered markup differs from the restored state) without
hydration errors. Svelte 5 hydration updates differing text nodes and non-URL attributes in
place; structural `{#if}` differences are repaired the same way as for the restored instrument.
A Playwright check asserts no `hydration_mismatch` console warning for pt-BR/es first loads
(contract `language-ui.md` §5).

**Alternatives considered**: Resolve in `+layout.svelte` `onMount` — first interactive render
would flash English (FR-014). Prerender three HTML variants — needs locale URLs (rejected, DM-17).

## R-03 — Device language matching

**Decision**: Pure function `matchDeviceLanguage(tags: readonly string[]): LanguageTag` in
`src/lib/i18n/languages.ts`. Input is `navigator.languages` if non-empty, else
`[navigator.language]` (read only in `language.svelte.ts`, the DOM edge). For each tag in order:
trim; skip empty or malformed (must match `/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/`); compare the
lower-cased primary subtag with each supported language's `primary`; first hit wins. No hit →
`en`.

**Rationale**: Matches the clarified rule exactly (pt-PT → pt-BR, es-419 → es, EN-au → en,
`["fr-FR","es-MX"]` → es, `["ja"]` → en). Pure → test-first table test (constitution IV) covering
SC-002's ten cases plus malformed tags. Avoids `Intl.Locale` (throws on malformed input; not
needed).

**Alternatives considered**: Paraglide `preferredLanguage` strategy — exact-tag matching
(`pt-PT` would not map to `pt-BR`) and no control over "never write". `Intl.LocaleMatcher`
proposal — not shipped.

## R-04 — Missing-text fallback and the gap warning

**Finding (measured)**: When a key is absent from `pt-BR.json`, Paraglide 2.25.4 compiles
`const pt_br2_b = en_b;` — the English text is shown with no runtime signal. Fallback display
(FR-012 part 1) is therefore built in; the warning is not.

**Decision**: Compute gaps at build time and warn at activation time.
- `src/lib/i18n/gaps.ts` exports pure `findMissingKeys(base, catalog): string[]` (keys present in
  English but absent or empty in the other catalog; `$schema` ignored).
- `vite.config.ts` reads `messages/*.json`, calls it per non-base locale, and injects the result
  as the compile-time constant `__FM_MISSING_TEXT__: Record<LanguageTag, readonly string[]>`
  (empty arrays in a healthy build, so the shipped cost is a few bytes).
- `language.svelte.ts` calls `reportGaps(locale)` whenever a locale becomes active (start and
  each switch). It emits `console.warn('[fretboard-master] missing text', { key, locale })` for
  each listed key not yet reported for that locale in this session (module-level `Set`). No
  network, no storage.

**Rationale**: Exactly one warning per key per locale per session (SC-007) regardless of how many
times the message renders. No change to the 58 call sites, no dependence on Paraglide's private
output shape.

**Alternatives considered**:
- Vite transform rewriting `const pt_br2_x = en_x;` in the compiled output into a reporting
  wrapper: warns at the exact render, but couples to undocumented compiler output that can change
  in any Paraglide patch release.
- Wrapping `m` in a `Proxy` re-exported from `$lib/i18n`: requires changing every import site and
  adds per-call overhead on hot display-model paths.
- Shipping all catalogs as JSON and diffing at runtime: duplicates ~14 KB of text in the bundle.

**Test strategy** (spec US5): (a) Vitest contract test compiles a fixture inlang project with
one key removed from `pt-BR` using the installed `paraglide-js compile` CLI into a temp dir and
asserts the message returns English for `pt-BR` and Portuguese for the others; (b) unit tests of
`findMissingKeys` and `reportGaps` (once per key per locale, console only, spies on `fetch` and
`localStorage.setItem` stay uncalled). The shipped app always has zero gaps (R-08), so no
Playwright test removes a key from the production build.

## R-05 — Key missing from English fails `pnpm check`

**Finding**: Already true. `pnpm check` compiles messages then runs `svelte-check`; a call to
`m.some_key()` with no `some_key` in `en.json` is a TypeScript error ("Property … does not
exist"), because English (base) defines the generated module's exports. **Decision**: no new
mechanism; quickstart scenario 5.2 documents the check, and `pnpm check`'s
`paraglide-js compile` keeps `--strategy baseLocale`.

## R-06 — Bundle cost of three catalogs

**Measured**: current initial JS is **101.4 KB gzip** (cap 120 KB). `messages/en.json` is
17.9 KB raw / 4.7 KB gzip, 353 messages. Paraglide emits one function per locale per message
plus a locale branch.

**Estimate**: Portuguese/Spanish texts run ~15–25 % longer than English; each adds roughly
5–6 KB gzip of text plus ~1 KB of per-message branch/function overhead → **+12–14 KB**, landing at
~113–116 KB. Language store, selector, panel, detection, schema field: ~1.5 KB. Projected
**≈ 115–117 KB ≤ 120 KB**. `scripts/check-bundle-size.mjs` gates it; tasks measure after the
catalogs land, before layout work.

**Contingency (recorded, not planned)**: lazy-loading catalogs is not available (FR-015 and
ADR 0002 single bundle). If the gate fails: (1) shorten verbose catalog prose in all three
languages; (2) only then propose a constitution amendment, as slices 013–017 did.

## R-07 — Plural and parameterized messages (FR-016)

**Decision**: Keep the established `_one` / `_other` key-pair pattern (e.g.
`triads_compare_arrow_one/_other`, `notes_desc_selected_one`), selected in code by `count === 1`,
and add the same pair for any new count message. Each language fills both keys with its own
word order.

**Rationale**: For the counts this app shows (positions, frets, strings, shapes, notes) English,
Brazilian Portuguese and neutral Spanish all use the singular only for exactly 1 in the register
chosen ("0 posições", "0 trastes" are standard). The `_one` texts hard-code the digit "1", which
CLDR's Portuguese `one` category (0 and 1) would mis-render as "1" for zero. No code change, no
`Intl.PluralRules` registry in the bundle.

**Alternatives considered**: Paraglide variant messages (`declarations` / `match` on
`count: plural`) — (measured) compiles fine and imports `registry.plural`, but restructures ~10
existing keys and their call sites for no visible difference in these three languages.

**Fragment audit**: the implementation audits every `m.*` call whose parameter is itself a
translated word or whose output is concatenated. Known sites:
`triads-model.ts` `${name}${m.triads_desc_chain_wide()}` and `m.triads_desc_chain_entry(...) +
m.triads_desc_chain_wide()` (suffix concatenation), `list.join(', ')` for fret lists
(punctuation is locale-neutral for en/pt/es; kept), and `caged_layer_counts`
(`"{count} {layer} notes"` with a translated layer word — gender/order differ, e.g. pt "notas da
pentatônica"). Each concatenation becomes one parameterized message (or a per-variant message
when a translated word is inserted into a sentence with agreement), per FR-016.

## R-08 — Catalog completeness and "no mixed languages"

**Decision**: `tests/unit/i18n/catalogs.test.ts` reads the three JSON files and asserts:
1. same key set (no missing, no extra, `$schema` excluded);
2. every value is non-empty;
3. every `{param}` placeholder set is identical per key across languages;
4. every non-English value differs from English unless the key is in
   `tests/unit/i18n/identical-allowlist.ts` — product name keys (`app_name`), English-kept
   tuning names (`tuning_af4/5/6/7/23`), `note_spoken_natural` (`{letter}`), `card_label`, and
   purely symbolic/placeholder-only values (e.g. `"{value} %"`, and `title_screen` `"{screen} — Fretboard Master"`, which holds
   only a placeholder, a dash and the product name);
5. the allowlist has no stale entries (each listed key exists and is actually identical).

Playwright `e2e/languages.spec.ts` visits `/`, `/notes`, `/triads`, `/caged`, `/about` in each
language and asserts `<html lang>` and a per-language sample of known texts (contract
`language-ui.md` §6).

**Rationale**: SC-001 and FR-006 mechanically; placeholder parity also prevents runtime
`undefined` in a translated sentence.

## R-09 — Interval root label "R" vs "T"

**Finding**: `interval_root` is already a catalog message (`"R"`), returned by
`intervalLabel('R')` in `src/lib/notation/notation.ts` — the single path used by the fretboard
markers and the Triads composition panel. Non-root glyphs (`♭3`, `3`, `5`, `♭5`, `♯5`, `♭7`, …)
are code constants there, and CAGED shape letters are `CAGED_CYCLE` data in theory; neither is
catalog text, so both stay identical in every language by construction. **Decision**: Portuguese and Spanish set it to `"T"` (tônica / tónica). All other interval
label keys stay identical (allowlisted). The theory module keeps returning interval functions,
not strings (constitution III). The CAGED spoken word `caged_interval_root` ("root") translates
normally ("tônica", "tónica").

## R-10 — Selector and panel UI

**Decision**:
- `LanguageSelector.svelte` (`src/lib/shell/`): a `<fieldset>` with translated `<legend>`
  (`language_label`: "Language" / "Idioma" / "Idioma") and three native radio inputs in fixed
  order English, Português, Español; each `<label lang="…">` shows the autonym from the catalog
  key `language_autonym` read in that option's own locale (`m.language_autonym({}, { locale: tag })`),
  so it is catalog text (Constitution VIII) yet identical in every UI language. Native
  radios give arrow-key movement, checked-state announcement and keep focus on the activated
  option after the switch (spec: "focus stays on the selector option that was activated").
- Home: rendered inline in `HomeScreen.svelte`'s top bar (1 interaction, SC-006).
- Tools and About: `LanguageButton.svelte` in the app bar (`ToolLayout.svelte`,
  `routes/about/+page.svelte`) with `aria-expanded`/`aria-controls`, toggling a non-modal
  disclosure panel (`LanguagePanel.svelte`) placed in the header flow (not covering the
  fretboard, constitution VII). Escape and a close button dismiss it; focus returns to the
  button. Panel open state is component-local `$state`, so it adds no history entry and no URL
  change (unlike the instrument panel's shallow route). Open + pick = 2 interactions.
- Not a `<dialog>`/`showModal`: modals are forbidden for normal situations (constitution VII) and
  the spec says non-modal.

**Alternatives considered**: `<select>` — one fewer target but options cannot carry per-option
`lang` reliably across browsers' native pickers, and changes on arrow keys in some browsers
(switching language while browsing options). Popover API — Firefox/WebKit top-layer and light
dismiss semantics differ; disclosure is simpler and fully keyboard-operable.

## R-11 — Layout at 320 px and 200 % text

**Decision**: Emulate 200 % by setting `document.documentElement.style.fontSize = '200%'` in
Playwright (tokens are rem-based). Shared helper `expectNoTruncationOrOverlap(page)` in
`e2e/support/helpers.ts`: for every visible element with direct text, `scrollWidth >
clientWidth + 1` or `scrollHeight > clientHeight + 1` (with `overflow` not `visible`) or computed
`text-overflow: ellipsis` fails; pairwise intersection of visible interactive controls' bounding
boxes fails; `document.documentElement.scrollWidth > innerWidth` fails (fretboard scroller is
the only `overflow-x: auto` container and is excluded from the page-width check by construction).
Run on home, Notes, Triads, CAGED, About, instrument panel open, language panel open × 3
languages × {100 %, 200 %} at 320 px — in `e2e/languages-layout.spec.ts`. Notice check: each
visible notice's text block height ≤ 2 × computed `line-height` at 320 px / 100 %.

**Rationale**: SC-004/SC-005 definitions from clarifications. CSS fixes expected: `flex-wrap` on
remaining bars, `min-inline-size: 0` + `overflow-wrap: anywhere` on long labels, no fixed widths
in `ch` for translated text. No new tokens unless a fix needs one.

## R-12 — Existing e2e suites under device-language detection

**Decision**: Set `use.locale: 'en-US'` in `playwright.config.ts`, `pw.local.config.ts`,
`playwright.local.config.ts`, and `pw.ff.config.ts`, so every existing English-text assertion
stays deterministic on runners whose OS language is not English. Language specs override with
`test.use({ locale: 'pt-PT' })` or per-context `locale`; the `["fr-FR","es-MX"]` list case uses
`page.addInitScript` to define `navigator.languages`.

## R-13 — Glossary list for native review (FR-008)

**Decision**: `docs/i18n/glossary.md` — one table row per musical term used in the interface:
English, Portuguese (Brazil), Spanish, the catalog keys that use it, and a review-status column
(`draft` for all rows in this slice). Includes the translated tuning-name family flagged for
review. Seeded from file 10 §4. A unit test (`tests/unit/i18n/glossary.test.ts`) asserts every key
cited in the glossary exists in all three catalogs, so the list cannot rot. Review is a
pre-launch gate (constitution), not a merge gate.

## R-14 — Erase preferences and storage-unavailable behavior

**Decision**: `preferences.erase()` additionally calls `language.restore(null)`, which re-runs
device matching and applies it immediately (no write). When storage is unavailable, `session
.remember` is already a no-op; `language.choose()` updates the rune regardless, so the switch
holds for the session (FR-005).

## R-15 — Fourth language = text files only (FR-013)

**Decision**: Supported languages live in one data list `LANGUAGES` in
`src/lib/i18n/languages.ts` (`tag`, `primary`); the autonym is catalog key `language_autonym`. A unit test asserts `LANGUAGES` tags
equal Paraglide's generated `locales` (same order) and `project.inlang/settings.json` `locales`.
Adding a language = `messages/<tag>.json` + one `locales` entry + one `LANGUAGES` row. Types
(`LanguageTag`), the prefs schema picklist, the selector, detection, and the completeness test
all derive from `LANGUAGES`.

## R-16 — ADR

**Decision**: Record ADR `docs/adr/0019-reactive-locale-and-device-language.md` covering R-01,
R-02, R-03, R-04 (architecturally significant: how every string becomes reactive, and the
build-time gap list).
