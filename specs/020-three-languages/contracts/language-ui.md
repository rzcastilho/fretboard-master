# Contract: Language UI (user-facing behavior)

Observable behavior that Playwright (`e2e/languages.spec.ts`, `e2e/languages-layout.spec.ts`)
and Vitest component tests (`tests/unit/language-selector.test.ts`,
`tests/unit/language-panel.test.ts`) verify. Maps to spec FR / SC ids.

## 1. Selector (`src/lib/shell/LanguageSelector.svelte`) — FR-003

```html
<fieldset>
  <legend>{m.language_label()}</legend>          <!-- Language / Idioma / Idioma -->
  {#each LANGUAGES as { tag }}
  <label lang={tag}><input type="radio" name="…" value={tag}> {m.language_autonym({}, { locale: tag })}</label>
  {/each}                                         <!-- English / Português / Español -->
</fieldset>
```

- Exactly three radios, fixed order, autonym labels, per-option `lang`, in every UI language.
  Autonyms come from the catalog key `language_autonym` read in the option's own locale.
- Checked radio = `language.current`.
- `change` → `language.choose(value)`. Focus stays on the activated radio (no remount).
- Accessible name of the group = translated legend. Targets ≥ 44×44 CSS px (`--target-min`).

## 2. Placement — FR-003, SC-006

| Screen | How | Interactions to pick |
| --- | --- | --- |
| `/` (home, also 404 home) | Selector inline in the top bar | 1 |
| `/notes`, `/triads`, `/caged`, `/about` | `LanguageButton` in the app bar → `LanguagePanel` | 2 |

`LanguageButton`: `<button aria-expanded aria-controls>` labelled `m.language_open()`.
`LanguagePanel`: `role="region"` with `aria-label={m.language_panel_label()}`, containing the
selector and a close button (`m.language_close()`); non-modal (not `<dialog>`, no focus trap,
no backdrop); in header flow, never covering the fretboard.
- Escape (focus inside panel) or close button → panel closes, focus returns to the
  `LanguageButton`.
- Choosing a language leaves the panel open.
- Opening/closing changes no URL and adds no history entry.

## 3. Switch effects — FR-004, FR-014, SC-003, SC-008

On choosing a different language, all of the following MUST hold:
- `location.href` unchanged; `history.length` unchanged; no navigation event.
- Zero network requests between click and settled text (Playwright `page.on('request')`).
- `document.documentElement.lang` ∈ {`en`, `pt-BR`, `es`} = chosen tag.
- `document.title` in the new language (e.g. Triads: "Triads — Fretboard Master" →
  "Tríades — Fretboard Master" / "Tríadas — Fretboard Master").
- Tool view state unchanged: e.g. Triads comparison stays on screen, same root/quality/
  inversion/string set; instrument (strings, tuning, frets, handedness) unchanged; open
  instrument panel or notice stays open with updated text; scroll offsets of window and
  fretboard scroller unchanged; playback in progress keeps playing (`playback` state unchanged).
- Root interval label: `R` (en) ↔ `T` (pt-BR, es); other labels unchanged.
- Letter note names and ♯ ♭ 𝄪 𝄫 unchanged; spoken names change only the accidental word.

## 4. Persistence — FR-002, FR-005, US1-5, US2-3

| Situation | Stored `language` | UI language |
| --- | --- | --- |
| First visit, device `pt-PT` | absent (not written) | pt-BR |
| User picks Español | `"es"` | es |
| Reload with device `en-US`, stored `"pt-BR"` | `"pt-BR"` | pt-BR |
| Stored `"language":"fr"` | treated as absent; other fields kept | device match |
| Erase preferences (About) | removed | device match, immediately |
| Storage unavailable, user picks pt-BR | none | pt-BR for the session |

Language never appears in any share link or URL.

## 5. Startup — FR-014

- With JS and stored/device language ≠ en: first interactive render, `<html lang>`, and
  `<title>` already in that language; no console `hydration_mismatch` warning or error.
- Without JS (`nojs` project): prerendered English, `<html lang="en">`.

## 6. Per-language text sample (no mixed languages) — FR-006, SC-001

Playwright visits `/`, `/notes`, `/triads`, `/caged`, `/about` in each language and asserts
`<html lang>` plus known texts. Minimum sample (final strings come from the catalogs; the test
reads expected values from `messages/<tag>.json` by key so it does not duplicate copy):
`nav_home`, `nav_about`, `tool_notes_name`, `tool_triads_question`, `about_heading`,
`fretboard_description_show`, `language_label`, and one tuning name (`tuning_af1`) plus one
English-kept (`tuning_af4` = "Drop D").

## 7. Layout limits — FR-010, FR-011, SC-004, SC-005

At viewport 320×640, for each language × {100 %, 200 % root font size} × {home, Notes, Triads,
CAGED, About, instrument panel open, language panel open}:
- no text element with `scrollWidth > clientWidth + 1` or `scrollHeight > clientHeight + 1`
  where its overflow is clipped, and none with computed `text-overflow: ellipsis`;
- no two visible interactive controls' bounding boxes intersect;
- `document.documentElement.scrollWidth ≤ window.innerWidth` (only the fretboard scroller
  scrolls horizontally).
At 100 %: every visible notice's text height ≤ 2 × its computed line height.
