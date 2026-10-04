# Research: Left-Handed Mode and String Orientation

**Feature**: `013-left-handed-and-orientation` | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-03

The spec's Clarifications session left no open question. Phase 0 resolved the design questions
below by reading the current code (`src/lib/fretboard/*`, `src/lib/state/instrument*`,
`src/lib/prefs/*`, `src/lib/shell/Instrument*.svelte`) and the prior contracts (010–012). Each
item: **Decision**, **Rationale**, **Alternatives considered**.

---

## R-01 — How the drawing is mirrored

**Decision**: Mirror in **layout coordinates** inside the pure `layoutFretboard`
(`src/lib/fretboard/geometry.ts`). The layout is first computed left-to-right as today; when
`screenOrder(instrument).reversed` is true every x is mapped `x' = width − x`, and each column's
`start`/`end` are swapped so `start < end` still holds. `columns[f]` stays indexed by fret.
New layout fields (`labelCenter`, `board`, `strings`, `mirrored`, see data-model §4) replace
the places in `Fretboard.svelte` that assume "label column at x = 0, nut on the left"
(`columns[0].start / 2`, `wood` rect, `stringsFrom → layout.width`).

**Rationale**: Every directional element (markers, fret lines, nut, inlays, fret numbers, tags,
arrows, region band, focus ring, hover hint, hit-testing) already derives its x from
`layout.columns`, so a mirrored layout mirrors them all from one place (FR-004, FR-018).
Text stays readable because nothing is flipped with a transform. Pure function → table tests
for all four combinations without a DOM.

**Alternatives considered**:
- SVG `transform="scale(-1,1)"` on the board: mirrors text (fret numbers, labels, arrow
  labels) and needs counter-transforms on every text node; hit-testing would have to undo it.
  Rejected.
- CSS `direction: rtl` on the scroller: gives "starts at the right" scrolling for free, but
  `scrollLeft` becomes ≤ 0 in RTL and every scroll helper and `animateScroll` would need a
  second code path; tags positioned with `inset-inline-start` would flip twice. Rejected in
  favour of explicit nut-anchored scrolling (R-06).

## R-02 — String orientation

**Decision**: `screenOrder` returns `rows = [1…n]` for `highest-top` and `[n…1]` for
`lowest-top`; `layoutFretboard` already builds `layout.rows` from it. Every lookup that indexes
rows by `string − 1` (`drawn` markers, arrows, hover hint, focus ring in `Fretboard.svelte`)
switches to a new pure `rowOf(layout, string)` helper. String thickness stays keyed by the
`string-N` class, so string 7/6 is still the thickest wherever it is drawn (FR-006).

**Rationale**: The mapping already existed as the documented single read point (identity until
now); rows are data, so orientation is a reordering, not a second geometry.

**Alternatives considered**: Vertical SVG flip — same text problem as R-01. Rejected.

## R-03 — Vertical placement of fret numbers and tags

**Decision**: Orientation decides the edges: `highest-top` → tags above the board, fret numbers
below (today); `lowest-top` → fret numbers above, tags below. The layout exposes
`numbersEdge: 'top' | 'bottom'`; with `'top'` the board starts at `boardTop = numbersRow` and
rows are offset by it. In `Fretboard.svelte` the tag strip is rendered **before** the `<svg>`
for `highest-top` and **after** it for `lowest-top`, so DOM (and Tab) order matches visual
order. Tag stacking rows keep row 0 nearest the board in both cases. Handedness never changes
either edge.

**Rationale**: Only reading of design §6 that honours both "depending on orientation" and
"always opposite the shape tags" (spec Clarifications, FR-005). Keeping DOM order equal to
visual order avoids a WCAG 2.4.3 focus-order mismatch that a CSS `order`/`column-reverse`
swap would create.

**Alternatives considered**: CSS `flex-direction: column-reverse` on the scroller — visual and
focus order would diverge. Rejected.

## R-04 — Inlays under orientation

**Decision**: Single inlays stay centred vertically. Double inlays (12, 24) are placed at the
boundaries counted from the **top of the drawn board** as today for `highest-top`, and at the
vertically mirrored boundaries for `lowest-top` (`y' = boardTop + boardBottom − y`), so a
lowest-on-top drawing is an exact vertical flip of the highest-on-top one. For 6 strings the
two are identical; for 7 they differ by one row.

**Rationale**: "Only the drawing differs" (US2-4) is easiest to verify when one orientation is
the exact flip of the other.

**Alternatives considered**: Leave by row index — would make the 7-string lowest-on-top board
not a true flip. Rejected (trivial cost).

## R-05 — Keyboard mapping and reading order

**Decision**: No change to `moveFocus` logic: it already reads `screenOrder` (`reversed` swaps
ArrowLeft/ArrowRight fret deltas, `rows` order drives ArrowUp/ArrowDown). Making
`screenOrder` real gives FR-010 directly. Grid DOM order: rows in drawn order (top → bottom),
cells inside each row in **fret order** (nut → body) regardless of handedness, so screen
readers always read from the nut (FR-009). `describeView` order (lowest string first, fret
ascending) and every `aria-label` are unchanged — identical text in all four combinations.
No announcement contains "left"/"right".

**Rationale**: The code was built for this (`moveFocus` docblock: "Screen directions go through
`screenOrder`, the single orientation mapping"). Cells iterate `layout.columns`, which stays
fret-indexed after mirroring (R-01).

**Alternatives considered**: Re-sorting cells by x — would read body → nut in left-handed mode.
Rejected.

## R-06 — Horizontal scrolling: nut-anchored offsets

**Decision**: Keep a normal LTR scroller and express every scroll rule in a **nut-relative
offset** `n = mirrored ? maxScroll − scrollLeft : scrollLeft`. Add pure helpers to
`interaction.ts`:
- `nutOffset(layout, scrollLeft, viewport)` / `scrollForNutOffset(layout, n, viewport)`;
- `spanTarget` "does not fit → align the start" becomes "align the **nut side** of the span"
  (`start` when right-handed, `end − width` when mirrored); the minimal-move branches are
  already symmetric;
- `trailingEdgeScroll` returns the far-from-nut end: `max(0, last.end − w)` right-handed, `0`
  mirrored.

`Fretboard.svelte` gains one anchor effect: whenever the layout's `width` or `mirrored` changes
(container resize, fret-count change, handedness switch, startup restore from preferences after
hydration), it re-applies the previous nut offset (for a handedness switch: the same fret
interval, i.e. `scrollLeft' = maxScroll − scrollLeft`). An unscrolled left-handed board
therefore starts at `maxScroll` (nut visible, FR-014). The R-11 fret-count shrink glide (slice
007) runs in nut-relative terms; when mirrored, the temporary "hold" spacer is placed on the
body side (a leading inline margin on the `<svg>` instead of the trailing `.hold` div).
Orientation never changes horizontal scroll. Switching either setting never animates (redraw
only; FR-017).

**Rationale**: Every existing rule ("region band scrolls into view", "keyboard focus scrolls
the cell into view", "comparison groups", "fret-count change preserves the visible stretch") is
defined relative to the nut; one conversion mirrors all of them and stays unit-testable with
plain numbers.

**Alternatives considered**: `direction: rtl` (see R-01); re-deriving each rule separately for
mirrored mode — more code, more tests, easy to miss one. Rejected.

## R-07 — Where the settings live in state

**Decision**: `InstrumentConfig` (`src/lib/state/instrument-config.ts`) gains
`handedness` and `orientation` (defaults `'right'`, `'highest-top'`). New pure transitions
`setHandedness(p, h)` and `setOrientation(p, o)`; `restoreDefault` already resets to
`DEFAULT_CONFIG` (now including both, FR-012); `cancelPanel` discards pending (EC-2.7).
`equalsConfig` compares all five fields; a new `equalsMusical` compares only string count,
tuning and frets. `confirmPanel` additionally returns `musicalChanged`.

`instrumentOf(config)` returns `tuningInstrument(...)` unchanged for the default presentation
(so `STANDARD_GUITAR` identity and every memo stay intact) and otherwise a frozen copy with
the two fields set, memoized per base instrument (`WeakMap<Instrument, Map<key, Instrument>>`)
so the same config always yields the same object.

**Rationale**: The panel already edits `InstrumentConfig` as pending state with confirm/discard
and preview; adding two fields reuses all of it (FR-001, FR-002). Memoized identity keeps the
tools' `next === instrument` short-circuit meaningful.

**Alternatives considered**: A separate "presentation" store read by `Fretboard.svelte` —
the renderer would import app state (it is a pure, prop-driven component today) and the panel
preview/thumbnail would need special plumbing. Rejected.

## R-08 — How the presentation reaches every fretboard without tools depending on it

**Decision**: Presentation travels inside the `Instrument` value (the model already carries
both fields as "presentation only"). On confirm:
- musical change (strings/tuning/frets, with or without presentation) → today's path
  (stop playback, apply to tools, maybe the adjustment notice);
- presentation-only change → write preferences, set `active`, call
  `notes.applyInstrument(inst)` / `triads.applyInstrument(inst)` so the tools' fretboards get
  the new instrument object, **no** playback stop, and `adjustedIn` stays `null`. Their
  adaptation functions are musical-only, so the view state is returned unchanged
  (`adjusted === false`) — pinned by tests (FR-017).
Thumbnails use `instrument.current`, the panel preview `instrument.preview` — both already
built by `instrumentOf`, so they follow confirmed / pending settings with no change (FR-015).

A unit "boundary" test scans `src/` and fails if the fields are read or set
(`.handedness`, `.orientation`, or object keys of those names; comments ignored) outside the
allow-list (`instrument/instrument.ts`, `instrument/tunings.ts`, `instrument/fixtures.ts`,
`fretboard/geometry.ts`, `state/instrument-config.ts`, `state/instrument.svelte.ts`,
`state/preferences.svelte.ts`, `prefs/schema.ts`, `shell/InstrumentPanel.svelte`,
`shell/InstrumentSummary.svelte`). The existing ESLint theory boundary already forbids them in
`src/lib/theory` (Constitution III).

**Rationale**: Tools pass the instrument through untouched; only `screenOrder` reads the fields
for drawing (FR-018).

**Alternatives considered**: Tools merge presentation into their instrument at render — every
tool would touch presentation. Rejected.

## R-09 — Stored preferences

**Decision**: Two optional v1 fields, `handedness` (`"right" | "left"`) and `orientation`
(`"highest-top" | "lowest-top"`), each `v.fallback(v.picklist(...), default)` — independent
fallback, never throws, `version` stays 1 (010 "Extension rule"). **Writer**: emitted only
when non-default (`"handedness":"left"`, `"orientation":"lowest-top"`), placed after `labels`;
a default user's record stays byte-identical to slice 012, so `lastWritten` canonical checks
and older bundles (version skew) are unaffected. Fixtures added: `left-only`, `lowest-only`,
`bad-handed` (spec), plus `left-lowest-full`; `future` keeps its expected value.
Erase → defaults (unchanged path, FR-012).

**Rationale**: Matches the 012 `strings` precedent (omit default to keep older output stable).

**Alternatives considered**: Always write both — changes every existing user's stored bytes on
next write for no benefit. Rejected.

## R-10 — Panel controls

**Decision**: Two native radio fieldsets in `InstrumentPanel.svelte`, after the frets stepper
and before the preview: **Handedness** (Right-handed / Left-handed) and **Strings on top**
(Highest string on top / Lowest string on top), same `count-option` styling as the Strings
group (≥ 44 × 44 px targets, wraps at 200 % zoom). Choosing updates pending state only.

**Rationale**: Native radios are keyboard-operable and announced correctly; mirrors the
existing Strings group; FR-001 asks for two independent controls; SC-001 (choose, confirm).

**Alternatives considered**: Toggle switches — two-state semantics less clear for "which string
is on top"; a single 4-way select — couples independent settings. Rejected.

## R-11 — Home-screen summary text

**Decision**: Replace the hard-coded "right-handed" in `instrument_summary_standard` /
`instrument_summary_preset` with a `{handedness}` parameter filled from new messages
`instrument_handedness_right` ("right-handed") / `instrument_handedness_left`
("left-handed"). Orientation is not shown (FR-015). Existing summary tests keep their exact
strings for the default.

**Rationale**: Keeps the summary a single translatable sentence with one variable.

**Alternatives considered**: Two more summary keys per handedness — four near-duplicate
sentences. Rejected.

## R-12 — Shipped languages

**Decision**: `project.inlang/settings.json` ships only `en` today (no `pt`/`es` catalogs
exist). New keys are added to every shipped catalog — `messages/en.json` — and nothing else;
when `pt`/`es` catalogs are added (per Constitution VIII, catalog files only), they must
include these keys (the existing `no-raw-text` and Paraglide compile checks enforce presence).

**Rationale**: The spec's "en/pt/es" assumption does not match the repository; adding stray
catalogs for two languages is out of this slice's scope and would need glossary review.

**Alternatives considered**: Create `pt.json`/`es.json` now — adds locales to the build and
untranslated review debt. Rejected; recorded in plan Complexity Tracking.

## R-13 — Testing strategy

**Decision**:
- **Unit (test-first)**: geometry table tests for the four combinations × {6, 7 strings} ×
  {12, 24 frets} (nut side, label column outermost, fret N left of N−1 when mirrored, rows
  order, numbers/tags edge); `moveFocus` table (US1-5, US2-6); nut-offset scroll helpers;
  `instrument-config` transitions (set/confirm/cancel/restore, `musicalChanged`); prefs schema
  fixtures + fast-check round-trip over both fields; property test: in all four combinations
  the set of `(string, fret)` cells and their pitches equals the right/highest set (SC-002);
  boundary grep test (R-08).
- **Component (Vitest + Testing Library)**: Fretboard mirrored rendering (label text x,
  nut rect x, fret-number y), panel radios pending/confirm/cancel, summary text.
- **E2E (Playwright)**: new `e2e/handedness.spec.ts` covering US1–US5 (phone 360 px, 320 px
  case, desktop 2560 px), axe zero violations in all four combinations; `preferences.spec.ts`
  reload/erase cases; `perf.spec.ts` switch ≤ 100 ms; TM-9 view 22 (view 6 left-handed) as a
  screenshot fixture in `triads-tm9.spec.ts`, seeded through `localStorage`
  (`{"version":1,"handedness":"left"}`) — the real startup path, no new test hook.
- The existing unit test "screenOrder lists string 7 last for every handedness/orientation"
  and "screenOrder is identity" pinned the placeholder behaviour and are **replaced** by the
  four-combination table (not a bug-fix test removal; the behaviour they pinned is the one this
  feature changes by specification).

## R-14 — Performance and bundle

**Decision**: Mirroring is an O(columns + rows) map inside an already-derived layout; no new
dependency; estimated bundle impact < 0.6 KB gzip (two transitions, two radio groups, scroll
helpers, ~8 messages). The perf suite adds "switch handedness → board updated ≤ 100 ms"
(SC-006) and keeps the 7 × 24 smooth-scroll case in a left-handed run.

**Rationale**: Constitution VI gates stay hard failures. *Update (implementation)*: measured
+1.3 KB gzip (84.8 → 86.1 KB), over the 85 KB cap; constitution 1.4.0 raised it to 90 KB.

## R-15 — ADR

**Decision**: Record `docs/adr/0016-handedness-and-orientation-in-layout.md`: mirroring in pure
layout coordinates, nut-anchored scroll offsets, presentation carried in `Instrument`,
presentation-only confirm path. Amends ADR 0005 (single SVG grid: reading order nut → body),
0009 (tags edge depends on orientation; keyed auto-scroll in nut-relative terms) and 0012
(store contract: presentation-only confirm).
