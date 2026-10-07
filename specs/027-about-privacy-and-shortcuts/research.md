# Research: About Page, Privacy, and Keyboard Shortcuts

**Feature**: 027-about-privacy-and-shortcuts | **Date**: 2026-10-07 | **Plan**: [plan.md](./plan.md)

The spec's Clarifications settle most behaviour. This file records the implementation choices the
plan needed on top of them, read against the code as it is on the branch base (slice 026 merged).
Each entry gives the decision, why, and what was rejected. No open unknowns remain.

---

## R-01 Key matching on the produced character

**Decision**: A pure `matchShortcut(event)` in `src/lib/state/shortcuts.ts` maps
`KeyboardEvent.key` to an action through a fixed table: `p`/`P` → `listen`, `.` → `next`,
`,` → `previous`, `l`/`L` → `labels`, `n`/`N` → `notation`. Letters are compared after
`toLowerCase()`; `.` and `,` exactly. Any other `key` (including `Unidentified`, `Dead`, multi-char
names such as `ArrowRight`, `Enter`, `Escape`, `F1`, `Home`, `PageDown`, `' '`) returns `null`.

**Rationale**: `key` follows the user's layout (FR-008 "matched on the produced character"), so an
AZERTY or ABNT2 user gets the action from the key labelled with that character. Multi-character key
names can never collide with the table, so FR-009's reserved keys are excluded by construction and
a table test proves it (SC-005).

**Alternatives considered**: `KeyboardEvent.code` (physical position) — rejected, it ignores the
layout and would put `.` on a different printed key in ABNT2. `keyCode`/`which` — deprecated.

## R-02 Guard conditions (no clash)

**Decision**: `matchShortcut` returns `null` when any of these holds, checked before the table:

- `ctrlKey`, `metaKey` or `altKey` is true, or `getModifierState?.('AltGraph')` is true (AltGr
  reports as Ctrl+Alt on Windows and as `AltGraph` elsewhere; both are covered);
- `repeat` is true; `defaultPrevented` is true; `isComposing` is true (IME composition, so CJK or
  dead-key input never triggers an action);
- the target is an editable or type-ahead field: `textarea`, `select`, any element with
  `isContentEditable`, or an `input` whose `type` is not one of `checkbox`, `radio`, `range`,
  `button`, `submit`, `reset`.

`shiftKey` is tolerated (spec: AZERTY `.` needs Shift). The function takes a structural
`ShortcutEventLike` (key, modifier flags, repeat, defaultPrevented, isComposing, target descriptor)
so it is unit-testable in the `node` environment without a DOM; a tiny adapter reads the target's
`tagName`, `type` and `isContentEditable`.

**Rationale**: Exactly FR-009, plus IME composition, which is the same "user is typing" case and
costs one check. Screen readers in browse mode consume single letters before the page; in focus
mode they hand keys to the page, which is the intended path (spec clarification).

**Alternatives considered**: Ignoring Shift too — rejected, breaks layouts that need Shift for `.`.
A focus-scope rule ("only when focus is on the fretboard") — rejected, the spec makes shortcuts
screen-wide and focus-independent.

## R-03 Where the listener lives

**Decision**: One `<svelte:window onkeydown={onShortcutKey} />` in `src/routes/+layout.svelte`,
bubble phase, using the layout's existing `screen` derived value (`SCREENS` by pathname, `home`
fallback). The handler: `if (!shortcuts.enabled) return; const a = matchShortcut(e); if (a &&
runShortcut(a, screen)) e.preventDefault();`

**Rationale**: The layout already owns screen identity and other app-wide hooks
(`beforeNavigate`, `afterNavigate`). Bubble phase lets local handlers (ChoiceGroup arrows, Escape
handlers, the fretboard grid) run first and `preventDefault`, which R-02 then respects. Calling
`preventDefault` only when an action actually ran leaves no-op keys untouched for the browser
(FR-011, US2-5).

**Alternatives considered**: A listener per tool component — rejected, five copies of the guard
and `N` must also work on Home and About. Capture phase — rejected, it would pre-empt local
handlers. A `ShortcutsHost.svelte` component — rejected as an extra file for one line (YAGNI).

## R-04 Dispatch: same handler, same enabled condition

**Decision**: `runShortcut(action, screen): boolean` in `src/lib/state/shortcuts.svelte.ts` calls
the store method the matching control calls, guarded by the same flag the control reads for its
`aria-disabled`, and returns whether anything ran:

| Action | Notes | Triads | CAGED | Home / About |
|---|---|---|---|---|
| `listen` | `notes.display.listen.enabled` → `notes.listen()` | `triads.display.listen.enabled` → `triads.listen()` (never `listenComparison`) | `caged.display.listen.enabled` → `caged.listen()` | no-op |
| `next` / `previous` | no-op | `triads.display.controls.inversion` → `triads.setInversion(cycle(INVERSIONS, current, ±1, wrap))` | `caged.display.steps.next` / `.previous` → `caged.step(±1)` | no-op |
| `labels` | `notes.setLabelType(cycle(['name','octave','none']))` | `triads.setLabelType(cycle(['interval','name']))` | `caged.setLabelType(cycle(['interval','name']))` | no-op |
| `notation` | `notation.choose(effective === 'letters' ? 'solfege' : 'letters')` on every screen, including 404 (falls back to `home`) |

Focus is never touched. Playback stop/restart, announcements, motion and remembered preferences
follow automatically because the existing store methods already do them (`triads.listen` uses
`playback.sequence`, which restarts; `caged.step` opens the connection-ring window; label setters
call `preferences.remember`).

**Rationale**: FR-010/FR-011: no parallel logic. Gating by state flags instead of DOM presence also
covers the landscape side-panel drawer, where the control can be collapsed out of the DOM but is
still the screen's action.

**Alternatives considered**: Synthesising a `click()` on the on-screen control — rejected; fails
when the control is in a closed drawer, couples to DOM selectors and would move nothing but is
brittle under re-render. A store-agnostic command registry each tool registers into — rejected,
three users and a fixed table do not justify the abstraction (Principle X).

## R-05 Cycling order

**Decision**: Pure `cycle<T>(list, current, dir, wrap): T | null` in `shortcuts.ts`. Triads
inversions use `INVERSIONS` (`root → first → second`, wrap) — the same order as the radio group.
Label lists follow control order: Notes `name → octave → none`, Triads/CAGED `interval → name`;
they always wrap. CAGED next/previous do not use `cycle`: `caged.step` already implements no-wrap
neighbours in start-fret order.

**Rationale**: One helper, two real uses (inversions, labels) — meets the "two real uses" rule.
The label orders mirror the option arrays in `NotesActions.svelte`, `TriadsSecondary.svelte` and
`CagedTool.svelte`; a unit test pins them to the prefs codec's `NOTES_LABELS`/`TRIADS_LABELS`/
`CAGED_LABELS` order so drift is caught.

## R-06 Shortcuts switch persistence

**Decision**: Additive optional field in the v1 preferences record: `shortcuts: boolean`,
`DEFAULT_PREFERENCES.shortcuts = true`, schema `v.fallback(v.boolean(), true)`, serialised as
`shortcuts: false` only when off, placed last (after `theme`). `PREFS_VERSION` stays 1.
`PreferencesPatch` gains it through the existing `Partial`. A runes store
`src/lib/state/shortcuts.svelte.ts` exposes `enabled`, `start(stored)`, `choose(on)` (remembers),
`restore(true)` (erase, non-persisting). `preferences.start()` calls `shortcuts.start(p.shortcuts)`;
`preferences.erase()` calls `shortcuts.restore(true)`. With storage unavailable the session keeps
the value in memory for the load (existing session behaviour).

**Rationale**: Same pattern as `theme`, `tempo`, `cagedNote` (FR-009a). Records written before 027
have no field and parse to on; records written by 027 open unchanged in older builds because
unknown keys are ignored by Valibot `object` (non-strict).

**Alternatives considered**: A separate `localStorage` key — rejected, the spec requires one record
and FR-019(c) only `fretboard-master:` keys. Storing `true` too — rejected, keeps default records
byte-identical to 026 (existing fixture tests stay valid).

## R-07 Switch control

**Decision**: Native `<input type="checkbox" role="switch">` inside a `<label>` with the text
"Keyboard shortcuts", in the About shortcuts section right after the list. `checked` reflects
`shortcuts.enabled`; `onchange` calls `shortcuts.choose(checked)`. Styled with tokens to ≥ 44×44 px
target (`--target-min`).

**Rationale**: Native checkbox gives Space toggling, form semantics and a free accessible name;
`role="switch"` makes screen readers say "on/off" (ARIA 1.2 allows it on checkbox inputs, axe
accepts it). R-02 exempts checkbox targets, so pressing `N` while the switch is focused still works,
which is consistent.

**Alternatives considered**: `<button aria-pressed>` — acceptable but reads "pressed/not pressed",
less clear for an on/off setting. A two-option ChoiceGroup — rejected, heavier and the spec calls
it a switch.

## R-08 `aria-keyshortcuts` exposure

**Decision**: While `shortcuts.enabled`:

- Listen buttons (`NotesActions`, `TriadsSecondary` main Listen only, `CagedListen`) →
  `aria-keyshortcuts="P"`;
- CAGED Previous shape → `","`; Next shape → `"."`;
- Triads inversion ChoiceGroup (the `radiogroup` element) → `". ,"`;
- the three label-type ChoiceGroups → `"L"`;
- `NotationToggle` group → `"N"`.

`ChoiceGroup.svelte` gets one optional prop `keyshortcuts?: string` rendered on the
`role="radiogroup"` element. Components read `shortcuts.enabled` from the store; when off the
attribute is `undefined` (absent), per FR-009b.

**Rationale**: ARIA 1.2 defines `aria-keyshortcuts` as space-separated key values from UI Events
`key`; `.` and `,` are valid values. Upper-case letters match the visible About list. The
attribute is allowed on `button`, `radiogroup` and `group` roles (global attribute), so axe stays
clean.

**Alternatives considered**: Visible key hints on every control — rejected, adds chrome around the
fretboard and translates poorly on phone (spec: no visual change on phone).

## R-09 About page structure and legend

**Decision**: `src/routes/about/+page.svelte` renders `h1`, then five `<section
aria-labelledby>` blocks in FR-001 order, each with an `h2`:

1. **What this app is** — existing `about_description` (text updated, see R-10);
2. **Marker legend** — a `<ul>` of three `<li>`: `MarkerSample fn="root|third|fifth"` +
   the existing `legend_root_name`/`legend_third_name`/`legend_fifth_name` text, with the existing
   `legend_*_meaning` as the visible description (shape + function, never colour alone);
3. **Keyboard shortcuts** — new `ShortcutList.svelte` (`src/lib/shell/`): a `<dl>` or table of
   `<kbd>` key + localized action, then the switch (R-07);
4. **Privacy** (`id="privacy"`) — new `PrivacyPolicy.svelte` (`src/lib/shell/`) followed by the
   existing `ErasePreferences`;
5. **Version** — the existing `about_version` line.

`.` and `,` are rendered as `<kbd><span aria-hidden="true">.</span><span class="sr-only">period</span></kbd>`
(localized `shortcuts_key_period`/`shortcuts_key_comma`) because screen readers often skip bare
punctuation. `.sr-only` already exists in `global.css`.

**Rationale**: Reuses the shared marker sample so the legend matches the board exactly
(Principle VII). Two new shell components keep the route small and are unit-testable.
`ErasePreferences` keeps its behaviour (confirm, Escape, navigate home); its outer `<section>`
becomes a `<div>` so it is not an unnamed nested section inside Privacy.

**Alternatives considered**: Reusing `LegendPanel.svelte` — rejected, it is model-driven (derives
kinds from a display model) and shows 14 kinds; About must show exactly three. A separate
`/privacy` route — rejected, the spec places the policy on About with `#privacy`.

## R-10 Privacy text as catalog keys

**Decision**: The policy is nine catalog keys rendered as a `<ul>` of short items, one per
statement (data-model §4): `about_privacy_no_data`, `about_privacy_stored`, `about_privacy_erase`,
`about_privacy_not_measured`, `about_privacy_no_ads`, `about_privacy_no_permissions`,
`about_privacy_hosting`, `about_privacy_share_links`, `about_privacy_all_ages`, plus
`about_privacy_heading`. The intro `about_description` is reworded to one plain sentence on what
the app is (keeps "interactive fretboard study tools" so `e2e/about.spec.ts` stays valid). A unit
test sums the words of the privacy keys per locale (≤ 220 en, ≤ 280 pt-BR/es) and rejects the jargon
list ("data controller", "processing", "lawful basis" and their pt-BR/es equivalents
"controlador", "tratamento", "base legal", "responsable del tratamiento", "tratamiento",
"base jurídica").

**Rationale**: One key per statement lets tests assert presence of each required statement (1)–(8)
in every language without parsing prose, and keeps each string short for translators. Paraglide
tree-shakes per message, so only About pulls them in, but ADR 0002 keeps one bundle; the cost is
counted in R-13.

**Alternatives considered**: One long Markdown/HTML string — rejected, Principle IX forbids
rendering catalog content as HTML and it defeats per-statement tests. A static `privacy.html` —
rejected, breaks i18n (Principle VIII).

## R-11 Privacy and security enforcement tests (FR-019)

**Decision**:

- **(a)(b)(c) e2e** — new `e2e/privacy.spec.ts`, fresh context per test (Playwright default):
  - `context.on('request')` collects URLs; after the pass every URL's origin equals the base
    origin, ignoring `data:` and `blob:`.
  - `context.addInitScript` replaces `navigator.mediaDevices?.getUserMedia`,
    `navigator.geolocation.getCurrentPosition`/`watchPosition`, `Notification.requestPermission`,
    `navigator.permissions.query` and `navigator.requestMIDIAccess` with counters on
    `window.__permissionCalls`; asserted all zero. `page.on('dialog')` fails the test.
  - Pass: `/` → `/notes` (select a note, Listen) → `/triads` (Listen, Share) → `/caged` (Listen,
    open the instrument panel) → `/about` (open the language panel, switch language, toggle the
    shortcuts switch). Share on desktop goes to the clipboard path; the test grants
    `clipboard-write` only if Chromium needs it (no prompt either way) and accepts the fallback.
  - After the pass: `context.cookies()` is `[]`; every `localStorage` key starts with
    `fretboard-master:`; `page.locator('input[type=email],input[type=password],input[type=tel]')`
    has count 0 on every screen.
- **(d) CSP unit** — new `tests/unit/csp.test.ts` imports `svelte.config.js` and asserts every
  directive value is one of `self`, `none`, `data:` (no scheme-host source), and that
  `script-src`/`connect-src` are exactly `['self']`.
- **(e) stored fields unit** — extend `tests/unit/prefs/schema.test.ts`: the keys of
  `JSON.parse(serializePreferences(p))` for an all-non-default record are a subset of the known
  v1 record keys; no key matches `/id|uuid|time|date|stamp|session|user/i`.
- **(f) About keys unit** — new `tests/unit/i18n/about-catalog.test.ts`: `findMissingKeys` on the
  `about_*` and `shortcuts_*` subset of `en` against pt-BR and es returns `[]`; plus the word-count
  and jargon checks from R-10. (The existing `catalogs.test.ts` parity test also fails on any
  missing key; this test names the About contract explicitly.)

**Rationale**: Each FR-019 item maps to one deterministic check that runs in the existing merge
gate (Vitest + Playwright desktop/phone). `addInitScript` runs before app code, so even a call
during hydration is caught.

**Alternatives considered**: Asserting via `Permissions-Policy` header only — rejected, headers are
not applied by the local preview server and do not prove the app never calls the APIs. HAR
recording — heavier than a request listener with the same result.

## R-12 Shortcut tests

**Decision**:

- `tests/unit/state/shortcuts.test.ts` (node): table test over every action key (lower/upper,
  with Shift), every reserved key (`ArrowUp…`, `' '`, `Enter`, `Escape`, `Tab`, `Home`, `End`,
  `PageUp`, `PageDown`, `F1…F12`), every modifier (Ctrl, Meta, Alt, AltGraph), `repeat`,
  `defaultPrevented`, `isComposing` and every target kind; `cycle` cases.
- `tests/unit/state/shortcuts-store.test.ts` (jsdom): `start/choose/restore`, erase resets to on,
  `runShortcut` per screen against the real stores (calls the same method, returns `false` when the
  control flag is off).
- `tests/unit/prefs/schema.test.ts`: `shortcuts` absent → true, `false` kept, invalid → true,
  serialised only when false; new fixture `shortcuts-off.txt`.
- Component tests: `ShortcutList` (list, switch, `role=switch`), `PrivacyPolicy` (nine items),
  `ChoiceGroup` (`keyshortcuts` present/absent), Listen/step/notation attribute present only while
  on.
- `e2e/shortcuts.spec.ts` (desktop): US2-1…US2-9 — each key vs the matching control gives the same
  DOM/state (`aria-checked`, description text, URL), wrap/no-wrap, typing in the custom-tuning
  text field and with Ctrl/Alt/Meta does nothing, switch off persists across reload and Erase turns
  it on. Audio is asserted through the existing playback test hooks (sequence started), not sound.
- `e2e/about.spec.ts`: extended for US1 (sections in order, `#privacy`, three legend entries,
  all three languages, language switch keeps the page) and axe.

## R-13 Bundle budget

**Decision**: Estimate +2–3 KB gzip: privacy and shortcut strings in three locales (~1.6 KB gzip;
Paraglide messages carry all locales), matcher/dispatcher/store (~0.6 KB), two components and the
About markup (~0.6 KB). Measured baseline after 026: 136.9 KB against the 150 KB cap (constitution
1.11.0) — ~13 KB headroom. Measure with `pnpm build && node scripts/check-bundle-size.mjs build`
at the end of the slice; no amendment expected.

## R-14 `P` in Notes (spec inconsistency resolved)

**Decision**: `P` triggers **Listen** in Notes too, gated by `notes.display.listen.enabled`.

**Rationale**: The spec's clarification says "Notes … → no-op (no Listen exists there)", and
FR-008/FR-011 repeat that, but the premise is false: Notes has a Listen button
(`NotesActions.svelte`, `notes.listen()`, slice 004/019). The spec's governing rules — FR-010/FR-011
"call the same handler as the on-screen control … no-op exactly when that control is absent or
disabled", and spec 12 §5.4 "play / Listen" — require `P` to work where Listen exists. The spec
text (FR-008, FR-011, the clarification and the About list wording) is corrected in this plan run
so tasks and tests derive from one consistent statement.

**Alternatives considered**: Keep `P` a no-op in Notes — rejected: it contradicts the
"same control" rule, would make the About list wrong for one tool, and a user pressing `P` next to a
working Listen button would see nothing happen.

## R-15 Erase and the `#privacy` fragment

**Decision**: `preferences.erase()` adds `shortcuts.restore(true)`. Erase still navigates to `/`
(unchanged). `/about#privacy` on initial load scrolls natively (`afterNavigate` skips the `h1`
focus on `enter`). For in-app navigation to `/about#privacy` the existing `afterNavigate` focuses
the `h1`, which would scroll away from the fragment; the layout skips the `h1` focus when
`to.url.hash` is non-empty and instead focuses the target section's heading. No in-app link
targets `#privacy` in this slice, so this is a one-line guard with a unit-free e2e check.

**Rationale**: Keeps SC-002 (privacy reachable in ≤ 2 activations: About link, then the section on
the page) and makes the fragment robust for later links (e.g. from a future footer).

## R-16 ADR

**Decision**: `docs/adr/0026-character-key-shortcuts.md` records: produced-character matching,
the guard set, the single window listener in the layout, state-flag gating instead of DOM clicks,
and the off switch for WCAG 2.1.4. The privacy text needs no ADR (content, not architecture).
