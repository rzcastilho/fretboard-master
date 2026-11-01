# Research: Mode Tabs and Plain Metronome (036)

The spec's clarification session resolved every product question, so the Technical Context
has no `NEEDS CLARIFICATION` left. The decisions below are the engineering choices that turn
those answers into code in the existing metronome (slices 031–035).

## R-01 One store with a mode, not a second store

- **Decision**: Extend `src/lib/state/metronome.svelte.ts` with a `mode` field
  (`'plain' | 'ratios'`) and a second settings record `plain: PlainSettings`. The single
  `ClickScheduler`, run phase, generation counter, announcement and sound notice stay shared.
- **Rationale**: Only one mode can play at a time (FR-004), and the Start/Pause/Resume/Reset
  logic, keyboard handling and running view are the same (FR-011). One owner of the
  scheduler keeps the "switch stops at once" rule a single `halt()` call. The store doc
  comment already says it is "the only module that creates a `ClickScheduler`".
- **Alternatives considered**: A separate `plainMetronome` store, which duplicates the
  scheduler lifecycle and needs a coordinator so that two stores never play together.
  Rejected (Principle X: no new abstraction without two real uses of it; here it would only
  duplicate code).

## R-02 Plain run plan uses the existing engine unchanged

- **Decision**: A pure `plainRunPlan(p: PlainSettings): PlanFields` in
  `metronome-settings.ts` returns `{ clicksPerBeat: 1, initialCountIn: effectiveCountIn(p) }`
  with no `alternate`. `toRunPlan` in `src/lib/audio/metronome-cycle.ts` already maps a
  missing `alternate` to `loops: [n1], repeat: 0`: a single loop and no count-in between loops.
- **Rationale**: FR-006/FR-008/FR-009 need one click per beat, the beat-1 accent, the regular
  beat click and the count-in sound. The engine already does this for Ratios Training with the
  ratio off and Loop 1 = 1. No audio code changes, so timing accuracy and FR-016 hold by
  construction (SC-004).
- **Alternatives considered**: A `mode` flag in `SegmentStart`. Rejected because the engine
  must stay mode-agnostic (framework-free contract, 031).

## R-03 Shared rows act on the active mode

- **Decision**: The existing setters `setBpm`, `stepBpm`, `setBeats`, `stepBeats`,
  `setCountIn`, `setInitialCountIn` and `stepInitialCountIn` edit the active mode's record.
  The Ratios-only setters (`setRepeatCountIn`, `stepRepeatCountIn`, `setRatio`,
  `setSubdivision`, `setLoop2`) are no-ops while `mode === 'plain'`. A new getter `current`
  returns the active mode's four shared fields (typed `PlainSettings`; `MetronomeSettings` is
  a structural superset). `settings` keeps returning the Ratios record, so existing callers and
  tests keep their meaning.
- **Rationale**: The settings view reuses the same `ValueRow` wiring for both modes, and the
  setters can only change the record that is on screen (FR-005: no cross-mode leakage).
- **Alternatives considered**: Mode-qualified setters (`setPlainBpm`, …). Rejected because it
  doubles the API surface for identical behaviour.

## R-04 Generic settings maths

- **Decision**: `effectiveCountIn` takes `Pick<PlainSettings, 'countIn' | 'initialCountIn'>`;
  `atLimit` / `stepSetting` become generic over `S extends PlainSettings` for the fields
  `bpm | beats | initialCountIn`, keeping `repeatCountIn` for `MetronomeSettings`. The clamps
  (`clampBpm`, `clampBeats`, `clampCount`) are reused as they are, so ranges, steppers and
  typed-entry validation match (FR-007).
- **Rationale**: Same limits, one implementation. Unit tests for both shapes pin it down.
- **Alternatives considered**: Storing plain settings as a full `MetronomeSettings` with unused
  fields. Rejected because the stored record would carry meaningless fields and the type would
  allow Loop 1 to reach the plain plan (FR-006).

## R-05 Switching modes = halt + assign + remember

- **Decision**: `metronome.selectMode(mode)`: an unknown value or the active mode is a no-op
  (it neither stops a run nor writes). Otherwise it calls the existing `halt()`, which halts
  the scheduler with reason `'leave'`, bumps `generation` so stale callbacks are dropped,
  returns to `settings` and clears the run position and the sound notice. It then sets
  `state.mode` and writes the metronome record.
- **Rationale**: `halt()` is already the "leave the route" path. It stops sound at once,
  including during the count-in and while paused, and forgets the pause (edge cases; FR-004,
  SC-002). The live-region announcement is left unchanged. Assistive technology already
  announces the newly selected tab, and a second announcement would repeat it.
- **Alternatives considered**: Calling `reset()`. Rejected because `reset()` is a no-op in
  settings and announces "Reset", which is wrong for a mode change.

## R-06 Tab bar: WAI-ARIA Tabs, manual activation, native buttons

- **Decision**: A new `ModeTabs.svelte` holds a `div role="tablist"` (accessible name from the
  new `metronome_modes_label`) of `<button type="button" role="tab">` elements, each with
  `id`, `aria-selected`, `aria-controls="metronome-mode-panel"`, and a roving `tabindex`
  (0 on the selected tab, −1 on the others). A keydown on the tablist handles
  ArrowLeft/ArrowRight (with wrap), Home and End by moving focus only. Click, Enter and Space
  use the button's native activation and call `onselect(mode)`. The content of `MetronomePanel`
  goes inside `div role="tabpanel" id="metronome-mode-panel" aria-labelledby={selected tab id}`.
- **Rationale**: FR-012 asks for manual activation, so moving focus never stops playback. A
  `<button>` already counts as a native activator in `matchMetronomeKey`
  (`activatesNatively` → `BUTTON`), so Space on a tab selects it and never toggles Start/Pause,
  with no change to the key rules. The tabs stay mounted in every phase (settings, running,
  paused), so focus stays on the tab after a switch and is never lost.
- **Alternatives considered**: Automatic activation (focus selects). Rejected because arrowing
  across the bar would stop a run. A radio group or the existing `.segment` control was also
  rejected: the spec asks for tab semantics.

## R-07 Panel name moves from the heading to the tabpanel

- **Decision**: Remove the visible `<h2 id="panel-heading">` and the section's
  `aria-labelledby`. The outer `<section class="panel">` keeps `data-phase` and gains
  `data-mode`. The accessible name of the active mode's content now comes from the tabpanel
  (`aria-labelledby` = the selected tab), so it reads "Ratios Training" or "Metronome". The e2e
  helpers that locate `getByRole('region', { name: 'Ratios Training' })` (in
  `metronome.spec.ts`, `metronome-a11y.spec.ts`, `metronome-remembered.spec.ts` and
  `metronome-subdivisions.spec.ts`) switch to `getByRole('tabpanel', { name: 'Ratios Training' })`.
  This is a locator change only; the behaviour they assert is the same (SC-007).
- **Rationale**: FR-012 says the tab bar replaces the visible heading. Keeping a hidden duplicate
  name on the section would make screen readers announce the mode twice.
- **Alternatives considered**: A visually hidden `<h2>` kept for the tests. Rejected because
  it would duplicate the announcement and keep markup that exists only for the tests.

## R-08 Tab icons as inline SVG, hidden below 30rem

- **Decision**: Draw the `♩` (quarter note) and `+` icons as small inline SVGs with
  `aria-hidden="true" focusable="false"`, sized with `--bar-icon-size` like the Start button's
  play icon. `@media (max-width: 30rem)` hides them. This is the same literal breakpoint that
  `ValueRow.svelte` uses, because custom properties cannot appear in media queries.
- **Rationale**: The system UI font stack does not reliably carry U+2669 `♩` (the self-hosted
  subset covers only ♯ ♭ 𝄪 𝄫, ADR 0006), so a glyph could render as a missing-character box.
  SVG keeps the icons out of the message catalog (they are not text, Principle VIII) and out
  of the accessible name (FR-003).
- **Alternatives considered**: Unicode glyphs in the catalog. Rejected because of the font
  coverage, and because a translator could change them.

## R-09 Tab styling from tokens

- **Decision**: Equal widths come from `display: grid; grid-auto-flow: column;
  grid-auto-columns: 1fr`. The active tab uses `color: var(--color-accent)` and
  `border-block-end: var(--metronome-tab-underline) solid var(--color-accent)`; inactive tabs
  use `color: var(--color-text-muted)` and a transparent border of the same width, so nothing
  shifts. The new token `--metronome-tab-underline: 2px` goes in `src/lib/styles/tokens.css`.
  Tabs keep `min-block-size: var(--target-min)`, and labels may wrap onto two lines
  (`min-inline-size: 0`, no `text-overflow`). Focus uses the shared
  `--focus-ring-width` / `--color-focus-ring` outline.
- **Rationale**: FR-002 requires tokens (Principle VII). The selected state is shown by the
  underline as well as by colour (Principle V). A border survives forced-colours mode, which a
  `box-shadow` underline does not; under `forced-colors: active` the active border uses
  `Highlight`. At 320 px each tab gets about 130 px. "Entrenamiento de proporciones" wraps onto
  two lines, and its longest word ("proporciones") still fits, so nothing is truncated (FR-003).
- **Alternatives considered**: Reusing `--border-width` for the underline. Rejected because it
  is 1 px (2 px in high-contrast mode), and FR-002 asks for 2 px.

## R-10 Persistence: extend the 035 `metronome` record

- **Decision**: `Preferences.metronome` becomes
  `{ ratios: MetronomeSettings; plain: PlainSettings; mode: MetronomeMode }`. The prefs module
  mirrors the defaults as `METRONOME_PLAIN_DEFAULTS` and `METRONOME_MODES` (type-only import
  rule, parity-tested as in 035). The reader parses `ratios`, `plain` and `mode`
  independently, each with Valibot per-field `fallback`s. The writer emits `metronome` keys in
  the order `ratios`, `plain`, `mode`, and only the non-default ones. `metronome` is omitted
  when all three are default. The store always calls
  `preferences.remember({ metronome: { ratios, plain, mode } })` with the full object, because
  `session.remember` replaces top-level keys instead of deep-merging them.
- **Rationale**: FR-013 and Principle IX. Untouched records stay byte-identical to 035's (C1),
  and the session's unchanged-skip (comparing serialized strings) already makes writes with no
  change free.
- **Alternatives considered**: A new top-level `metronomeMode` key. Rejected because the 035
  contract reserved the per-mode `metronome` object for this purpose, and a 035 build reading
  the new record ignores the unknown keys (fixture C6).

## R-11 Catalog strings

- **Decision**: New keys in `messages/{en,pt-BR,es}.json`:

  | Key | en | pt-BR | es |
  |---|---|---|---|
  | `metronome_modes_label` | Metronome modes | Modos do metrônomo | Modos del metrónomo |
  | `metronome_mode_plain` | Metronome | Metrônomo | Metrónomo |
  | `metronome_mode_ratios` | Ratios Training | Treino de proporções | Entrenamiento de proporciones |
  | `metronome_start_plain` | Start | Iniciar | Iniciar |
  | `metronome_announce_started_plain` | Started, {bpm} BPM, {beats} beats | Iniciado, {bpm} BPM, {beats} tempos | Iniciado, {bpm} BPM, {beats} pulsos |
  | `metronome_announce_started_plain_count_in` | Started, {bpm} BPM, {beats} beats, count in {count} | (pattern of the existing `metronome_announce_started_count_in`, without the subdivision) | (same) |

  `metronome_mode_ratios` takes over the values of `metronome_panel_heading`, which is then
  removed because nothing uses it (no dead code). The pt-BR and es announcement wording copies
  the nouns of each locale's existing `metronome_announce_started` value, so the final text is
  taken from those strings during implementation.
- **Rationale**: FR-011/FR-015 and Principle VIII. The `identical-allowlist` and glossary tests
  cover the new keys; "Iniciar" is the same in pt-BR and es but differs from en, so it needs no
  allowlist entry unless the catalog test compares the two locales with each other.
- **Alternatives considered**: Reusing `tool_metronome_name` for the tab label. Rejected because
  it is a different concept (the tool, not the mode) and its translation could diverge later.

## R-12 Status line without `· SUB`

- **Decision**: `metronome.sub` returns `null` in plain mode. `statusParams` accepts
  `sub: number | null`, and `StatusBox` renders the separator and `SUB n` part only when `sub`
  is a number. The count-in branches are unchanged.
- **Rationale**: FR-010, and it is the smallest change that keeps the Ratios output identical.

## R-13 Bundle and performance

- **Decision**: No new dependency. The estimated cost is under 1.5 KB gzip: one component, a
  few store branches, a Valibot object and catalog strings for three locales. The existing
  `scripts/check-bundle-size.mjs` gate (≤ 160 KB) in `pnpm verify` and CI checks it.
- **Rationale**: Principle VI. A tab switch does a synchronous halt and one sub-1 KB `setItem`,
  well inside the 300 ms tool-switch budget.
