# Implementation Plan: About Page, Privacy, and Keyboard Shortcuts

**Branch**: `027-about-privacy-and-shortcuts` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-about-privacy-and-shortcuts/spec.md`

**Note**: This plan was produced by the `/speckit-plan` command, following its execution workflow.

## Summary

This is the fourth slice of wave 007 (comfort and launch readiness). It has three parts.

- **About page** (US1, P1): About gains five `h2` sections in a fixed order — what the app is, a
  three-entry marker legend (root, third, fifth via the shared `MarkerSample`), the keyboard
  shortcut list with an on/off switch, a plain-language privacy policy (`#privacy`) followed by
  **Erase my preferences**, and the version — all in en, pt-BR and es.
- **Keyboard shortcuts** (US2, P2): `P` Listen, `.`/`,` next/previous (Triads inversions wrap,
  CAGED shapes do not), `L` label type, `N` notation. Matched on the produced character, never
  with Ctrl/Meta/Alt/AltGr, on repeat, after another handler, during IME composition, or in text
  fields. A remembered switch turns them all off (WCAG 2.2 SC 2.1.4).
- **Privacy proof** (US3, P1): automated checks that fail the merge gate — same-origin requests
  only, no permission APIs called, no cookies or foreign storage keys, no identity inputs, a
  self-only CSP, only known preference fields, and complete About translations.

The approach comes from [research.md](./research.md).

- **Matching** (R-01, R-02): a pure `matchShortcut(eventLike)` in `src/lib/state/shortcuts.ts`
  maps `KeyboardEvent.key` (letters case-insensitive, Shift tolerated) through a five-row table
  after the guard checks. Multi-character key names can never match, so arrows, Space, Enter,
  Escape, Tab, Home/End, PageUp/PageDown and F-keys are excluded by construction.
- **Dispatch** (R-03, R-04, R-05): one `<svelte:window onkeydown>` in `src/routes/+layout.svelte`
  (bubble phase, after local handlers) calls `runShortcut(action, screen)`. It invokes the very
  store method the on-screen control calls (`notes|triads|caged.listen`, `triads.setInversion`,
  `caged.step`, `*.setLabelType`, `notation.choose`), gated by the same display flag the control
  uses for `aria-disabled`. `preventDefault` only when something ran. Focus never moves.
- **Switch** (R-06, R-07, R-08): additive optional preferences field `shortcuts` (stored only when
  `false`, fallback `true`, `PREFS_VERSION` unchanged), a small runes store, a native
  `input[type=checkbox][role=switch]` on About, and `aria-keyshortcuts` on mirrored controls only
  while on (one new optional `keyshortcuts` prop on `ChoiceGroup`).
- **Content** (R-09, R-10): two new shell components, `ShortcutList.svelte` and
  `PrivacyPolicy.svelte`; nine one-statement privacy catalog keys (≈ 200 words in English) so each
  required statement is testable per language; word-cap and jargon unit test.
- **Enforcement** (R-11, R-12): `e2e/privacy.spec.ts` (request log, init-script permission spies,
  cookies, storage keys, identity inputs), `tests/unit/csp.test.ts`, a known-keys case in the
  prefs schema test, `tests/unit/i18n/about-catalog.test.ts`, plus unit and e2e suites for the
  shortcuts.
- **Budget** (R-13): about +2–3 KB gzip against about 13 KB headroom under the 150 KB cap.

**Spec correction recorded** (R-14): the spec says `P` is a no-op in Notes because "no Listen
exists there", but Notes has a Listen button (`NotesActions.svelte`). Following the spec's
governing rule (FR-010/FR-011: same handler as the on-screen control, no-op only when the control
is absent or disabled), `P` triggers Listen in Notes too. FR-008, FR-011 and the clarification in
`spec.md` are updated accordingly in this run.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`), Svelte 5 runes, SvelteKit 2 with `adapter-static` (prerendered, single bundle, ADR 0002).

**Primary Dependencies**: existing only — Paraglide JS (catalogs), Valibot (preferences schema), `@testing-library/svelte`, `@axe-core/playwright`, fast-check (dev). No new runtime or dev dependency.

**Storage**: `localStorage` through `src/lib/prefs` — one additive optional field `shortcuts` in the existing v1 record (`fretboard-master:prefs`), format version unchanged. Not part of share links. No cookies, sessionStorage or IndexedDB.

**Testing**:
- Vitest node: `shortcuts.ts` matcher and `cycle` tables, prefs codec, CSP config scan, About catalog completeness, word caps and jargon.
- Vitest jsdom: shortcuts store and `runShortcut` against the real tool stores, `ShortcutList`, `PrivacyPolicy`, `ChoiceGroup`/`NotationToggle`/Listen/step attribute tests, preferences store erase.
- Playwright: `about.spec.ts` (extended), new `shortcuts.spec.ts` and `privacy.spec.ts`, `preferences.spec.ts` (erase location). axe on About.
- Local runs on the `desktop` project only; CI runs the full matrix.

**Target Platform**: Evergreen browsers (last two majors), desktop and mobile, 320–2560 CSS px. Shortcuts work wherever a hardware keyboard sends key events; phone layouts unchanged.

**Project Type**: Static single-page web app (SvelteKit, prerendered, one JS bundle, Cloudflare Pages).

**Performance Goals**: A shortcut reaches the store in O(1) (one table lookup, no DOM queries) and the resulting fretboard update stays within the existing ≤ 100 ms control-change budget; Listen keeps tap-to-sound ≤ 100 ms after unlock (the keypress is the unlocking gesture). About adds no blocking work to Home's ≤ 3 s.

**Constraints**:
- Initial JS ≤ 150 KB gzip (136.9 KB after 026).
- CSP unchanged and `'self'`-only; `_headers` unchanged; no inline script.
- WCAG 2.2 AA including SC 2.1.4 (character key shortcuts can be turned off).
- Every string in the catalog in three languages; privacy text ≤ 220 words (en) and ≤ 280 (pt-BR, es); no legal jargon.
- No consent banner (Q-11 pending legal review); no owner/contact details (Q-2/Q-3 pending).

**Scale/Scope**:
- Code: 2 new pure/store modules (`shortcuts.ts`, `shortcuts.svelte.ts`); 2 new shell components (`ShortcutList`, `PrivacyPolicy`); 1 preferences field; about 24 new catalog keys × 3 locales and 1 changed; about 9 edited components/routes (`about/+page.svelte`, `+layout.svelte`, `ChoiceGroup`, `NotationToggle`, `NotesActions`, `TriadsSecondary`, `TriadsControls`, `CagedListen`, `CagedTool`, `ErasePreferences`).
- Tests: 2 new e2e specs, 1 extended; about 6 new unit test files and 4 extended; 1 ADR.

All Technical Context items are resolved in research.md; no open unknowns remain.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.11.0. The pre-research and post-design results are the same; post-design notes are
folded into each line.

- [x] **I. Musical Correctness**: No theory code changes. `.`/`,` call the existing `triads.setInversion` with the next value of the theory module's own `INVERSIONS` list, and `caged.step`; `N` switches notation through `src/lib/notation`. Spelling, shapes and pitches are untouched, and the theory suites keep gating.
- [x] **II. On-Device, Static, Private**: This slice strengthens the principle — the policy states nothing is measured or collected, and new gate tests prove same-origin-only requests, no permission API calls, no cookies, only `fretboard-master:` storage keys and a self-only CSP. The new `shortcuts` field lives in the same local record and is erased by Erase. No network, identifier or third-party content is added (Q-1 not adopted).
- [x] **III. Pure Core, Thin Shell**: `src/lib/theory` is untouched. The matcher is pure and DOM-free (structural event type). Dispatch goes through existing store methods, so data still flows control action → view state → display model → render; tools gain only an attribute. View state stays outside components; no screen coordinates are introduced.
- [x] **IV. Test-First / Tested Behavior**: The prefs codec field, matcher, `cycle` and `runShortcut` are written test-first ([contracts/pure-api.md](./contracts/pure-api.md)). Every US1–US3 scenario maps to a test ([quickstart.md](./quickstart.md) §4). Listen is asserted through the existing playback test hooks, not real audio time.
- [x] **V. Accessible by Default**: Shortcuts are extras on top of fully keyboard-operable controls (FR-010), never clash with AT/browser keys (guard table test), can be turned off (SC 2.1.4), never move focus, and are exposed with `aria-keyshortcuts`. The About legend shows shape plus label (never colour alone); punctuation keys have sr-only names; the switch is a native checkbox with `role=switch` and a 44 px target. axe zero violations on About in both themes and three languages.
- [x] **VI. Performance Budgets**: O(1) key handling, no DOM work per keypress; existing update and audio paths are reused, so the 100 ms budgets are unchanged. Bundle about +2–3 KB against about 13 KB headroom under 150 KB, measured at the end of the slice (R-13). No budget change.
- [x] **VII. Design System Fidelity**: The legend reuses `MarkerSample` (root rounded square, third circle, fifth diamond; role colours only there). No overlay tutorial, help popup or `?` key; no modal (Erase keeps its inline confirmation). Every visual value in the new components is a token (`--space-*`, `--target-min`, `--radius-md`, colour tokens). About is a single scrolling page at 320–2560 px with no horizontal scroll; phone layouts unchanged.
- [x] **VIII. International**: All new text (headings, shortcut actions, key names, switch, nine privacy statements) is in `messages/{en,pt-BR,es}.json`, enforced by `catalogs.test.ts` and the new About completeness test; `no-raw-text` still scans components. Shortcut characters are identical in every language and documented as such. Layout checked at 200 % text and 320 px in all three languages. No note names are formatted (the `N` row says "letters or solfège" in words).
- [x] **IX. Untrusted Input, Versioned Formats**: `shortcuts` is validated with `v.fallback(v.boolean(), true)`, falls back on its own, and is stored only when `false`; format version stays 1 and older/newer records open (unknown keys ignored). Share-link format and fixtures are untouched. Catalog text is rendered as text, never HTML.
- [x] **X. Simplicity, Incremental Delivery**: Follows breakdown wave 007 item 004. No dependency. One window listener and a fixed table instead of a command registry; `cycle` has two real uses (inversions, labels); `ChoiceGroup` gets one optional prop; no help overlay (YAGNI). Fallbacks: storage blocked → switch works for the session; a shortcut whose control is disabled does nothing.

**Gate result**: PASS. No principle is violated. One spec inconsistency (R-14) is resolved in
favour of the spec's governing rule and recorded in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/027-about-privacy-and-shortcuts/
├── plan.md              # This file
├── research.md          # Phase 0 (R-01 … R-16)
├── data-model.md        # Phase 1: prefs field, shortcut table, switch store, catalog keys + English drafts, About DOM
├── quickstart.md        # Phase 1: run, targeted verification, scenario → test map
├── contracts/
│   ├── pure-api.md      # codec field, matchShortcut, cycle, shortcuts store, runShortcut, layout handler
│   └── ui.md            # About sections, switch, per-screen key table, aria-keyshortcuts, privacy posture checks
├── checklists/          # from /speckit.specify and /speckit.clarify
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
src/lib/prefs/
├── schema.ts                       # EDIT: Preferences.shortcuts, default true, schema fallback, serialise only when false (last)
└── session.ts                      # EDIT: doc comment only (PreferencesPatch already covers the field)
src/lib/state/
├── shortcuts.ts                    # NEW: ShortcutAction, SHORTCUTS, matchShortcut, toShortcutEvent, cycle (pure)
├── shortcuts.svelte.ts             # NEW: shortcuts store (enabled/start/choose/restore), runShortcut
└── preferences.svelte.ts           # EDIT: shortcuts.start on start, shortcuts.restore(true) on erase
src/routes/
├── +layout.svelte                  # EDIT: <svelte:window onkeydown> shortcut handler; skip h1 focus when URL has a hash
└── about/+page.svelte              # EDIT: five h2 sections, legend, ShortcutList, PrivacyPolicy + Erase in #privacy, version
src/lib/shell/
├── ShortcutList.svelte             # NEW: dl of kbd + action, role=switch checkbox
├── PrivacyPolicy.svelte            # NEW: ul of nine privacy statements
├── ErasePreferences.svelte         # EDIT: outer <section> → <div> (now nested in #privacy)
└── NotationToggle.svelte           # EDIT: aria-keyshortcuts="N" while on
src/lib/tools/
├── ChoiceGroup.svelte              # EDIT: optional keyshortcuts prop on the radiogroup
├── notes/NotesActions.svelte       # EDIT: Listen "P", label group "L"
├── triads/TriadsSecondary.svelte   # EDIT: main Listen "P", label group "L"
├── triads/TriadsControls.svelte    # EDIT: inversion group ". ,"
├── caged/CagedListen.svelte        # EDIT: Listen "P"
└── caged/CagedTool.svelte          # EDIT: Previous "," / Next ".", label group "L"
messages/{en,pt-BR,es}.json         # EDIT: about_* / shortcuts_* keys (data-model §4); about_description reworded
tests/unit/
├── state/shortcuts.test.ts         # NEW: matcher + cycle tables (node)
├── state/shortcuts-store.test.ts   # NEW: store + runShortcut per screen (jsdom)
├── state/preferences-store.test.ts # EDIT: start/erase wire the switch
├── prefs/schema.test.ts            # EDIT: shortcuts field cases; known-keys/no-identifier case
├── prefs/fixtures/shortcuts-off.txt # NEW
├── i18n/about-catalog.test.ts      # NEW: About keys complete in pt-BR/es; word caps; jargon; policy covers every Preferences category
├── csp.test.ts                     # NEW: svelte.config.js CSP self-only
├── shortcut-list.test.ts           # NEW
├── privacy-policy.test.ts          # NEW
├── triads/choice-group.test.ts     # EDIT: keyshortcuts present/absent
├── notation-toggle.test.ts         # EDIT: aria-keyshortcuts on/off
└── erase-preferences.test.ts       # EDIT: container change; still confirms and erases
e2e/
├── about.spec.ts                   # EDIT: sections/order, #privacy, legend, 3 languages, language switch, axe
├── shortcuts.spec.ts               # NEW: US2-1 … US2-9
├── privacy.spec.ts                 # NEW: US3-1 … US3-3 (requests, spies, cookies, storage keys, inputs)
└── preferences.spec.ts             # EDIT: Erase button located inside #privacy
docs/adr/
└── 0026-character-key-shortcuts.md # NEW
```

**Structure Decision**: This is the single SvelteKit project at the repository root, in the
layout the constitution mandates. Every directory named above already exists: `src/lib/prefs`,
`src/lib/state`, `src/lib/shell`, `src/lib/tools` (with `notes/`, `triads/`, `caged/`),
`src/routes` (with `about/`), `messages/`, `tests/unit` (with `state/`, `prefs/`, `prefs/fixtures/`,
`i18n/`, `triads/`), `e2e/` and `docs/adr/`.
- The matcher and dispatcher go in `src/lib/state/` next to the stores they drive (`notation`,
  `theme`, tool stores), keeping `src/lib/prefs` imported only by `preferences.svelte.ts`.
- About-only presentation (`ShortcutList`, `PrivacyPolicy`) goes in `src/lib/shell/` beside
  `ErasePreferences`.
- The global key listener goes in the root layout, which already owns screen identity.

## Phase overview (for /speckit-tasks)

1. **Setup**: Add catalog keys in three languages (English drafts in data-model §4; pt-BR and es
   translations within the word caps). Record the bundle baseline.
2. **Foundations (test-first, blocking)**: prefs `shortcuts` field and fixture; `shortcuts.ts`
   matcher and `cycle`; shortcuts store and `preferences` wiring; `runShortcut`.
3. **US1 About (P1)**: About sections, legend, `PrivacyPolicy`, Erase inside `#privacy`,
   About catalog test, `e2e/about.spec.ts`.
4. **US3 Privacy proof (P1)**: `csp.test.ts`, known-keys prefs case, `e2e/privacy.spec.ts`.
5. **US2 Shortcuts (P2)**: layout listener, `ShortcutList` with switch, `aria-keyshortcuts` on
   the mirrored controls, `e2e/shortcuts.spec.ts`.
6. **Polish**: ADR 0026; bundle measure; 200 % text and 320 px check in three languages;
   `pnpm verify` once.

## Risks and mitigations

- **Screen readers in focus mode on the fretboard grid**: single letters reach the page there by
  design. The off switch (SC 2.1.4) is the escape hatch; the About hint text says so.
- **`h1` focus after in-app navigation scrolls away from `#privacy`**: the layout skips the `h1`
  focus when the target URL has a hash (R-15). No in-app link uses it yet; covered by an e2e case
  that loads `/about#privacy` directly and one that navigates in-app with `goto`.
- **Clipboard on Share in headless Chromium**: may reject without permission; the app falls back to
  `ShareFallback` with no prompt. The privacy spec accepts either path and only asserts no dialog
  or permission API call.
- **Translated privacy text over the 280-word cap**: the catalog test fails early; translators
  shorten, never drop a statement (the per-statement keys keep coverage visible).
- **Existing tests that find About content by text** (`about.spec.ts` description regex): the
  reworded `about_description` keeps "interactive fretboard study tools".
- **Erase now inside a section**: `preferences.spec.ts` selectors use roles and names, not
  position; updated if any rely on `section.erase`.

## Complexity Tracking

No constitution principle is violated. The table records the assumptions and rejected
alternatives that the headless planning run had to choose without a human.

| Violation / assumption | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `P` triggers Listen in Notes (spec said no-op) — spec FR-008/FR-011/clarification corrected | Notes has a Listen button; FR-010/FR-011 require the shortcut to mirror the control and be a no-op only when it is absent or disabled | Keeping it a no-op contradicts the spec's own governing rule, makes the About list wrong for Notes, and is based on a false premise ("no Listen exists there") |
| Shortcuts gated by store display flags, not by DOM presence of the control | The landscape side-panel drawer can unmount the control while the action still belongs to the screen | Synthesising `click()` on the control fails with a closed drawer and couples logic to DOM selectors |
| `isComposing` added to the FR-009 guard set | IME composition is "typing" in the same sense as a text field; prevents accidental actions for CJK/dead-key users | Omitting it lets composition keystrokes trigger actions in non-text targets |
| Native `input[type=checkbox][role=switch]` for the switch | Free keyboard support, accessible name and on/off semantics | `button[aria-pressed]` reads "pressed" rather than on/off; a two-option ChoiceGroup is heavier |
| Privacy text split into nine one-statement keys | Each required statement (1)–(8) becomes testable per language; short strings translate better | One long string would need HTML/Markdown rendering (Principle IX) or prose parsing in tests |
| Layout skips the `h1` focus when the URL has a hash | Keeps `#privacy` landing correct for future in-app links | Leaving it means an in-app `#privacy` link scrolls to the top |
| Policy names no hosting company, owner or contact | Q-2/Q-3 unresolved; spec asks for the generic hosting sentence | Naming Cloudflare or a maintainer pre-empts open product decisions and the Q-11 legal review |
