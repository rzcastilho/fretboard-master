# Research: Open a Shared View (023)

Phase 0 output for [plan.md](./plan.md). Each item: **Decision**, **Rationale**, **Alternatives
considered**. Code references are to the tree at `991aeaa` (slice 022 merged).

## R-01 Where the received link is applied

- **Decision**: Apply the link in `src/hooks.client.ts` `init`, right after
  `preferences.start()`, through a new `opening.start(location.href)` call. `init` runs once per
  full page load, before hydration, so the first rendered frame already shows the shared view.
  The existing `openToolAddress(tool)` call in `ToolLayout`'s `onMount` then replaces the address
  with the canonical link of the state actually shown (022 A5), with no new history entry.
- **Rationale**:
  - "Opening a link" is defined as a full page load on a tool path with a non-empty query
    (spec FR-001, clarification). `init` runs exactly then and never on client-side navigation,
    so AppNav, Back and Forward keep today's behaviour without any extra check.
  - The startup restore of preferences already works this way (010 R-04): stores are filled
    before hydration and the prerendered default markup is repaired on hydrate. Opening a link
    is the same kind of startup input.
  - Applying in `onMount` (inside `openToolAddress`) would draw the default view first and then
    jump to the link's view: a visible flash, a playback/transition side effect, and one more
    reactive pass inside the 300 ms tool-open budget.
- **Alternatives considered**:
  - Inside `openToolAddress` (the 022 A5 seam as literally written): rejected for the flash
    above. The seam still holds in spirit: sync starts only after the link is applied, and the
    first write is the canonical repaired link (FR-017).
  - A `+page.ts` `load` reading `url.searchParams`: prerendering forbids reading the query in
    `load`, and `load` re-runs on client navigation, which must not re-apply links.

## R-02 Decoder: best-effort decoding and stored-instrument defaults

- **Decision**: Keep `decodeLink(url)` and its 022 contract (E1–E4, D1–D2, fixtures)
  unchanged. Refactor `src/lib/link/decode.ts` so the per-tool decoders take a `DecodeBase`
  (fallback instrument + `pairInstrument` flag), and add a new pure entry point
  `readReceivedLink(url, stored)` in `src/lib/link/receive.ts`:
  - Tool path, empty query → `{ kind: 'none' }` (normal tool open).
  - Tool path, non-empty query → decode with v1 rules against `stored` as the instrument
    default. A missing, non-integer or greater-than-1 `v` still decodes (FR-014) and marks the
    result `forcedNotice: true`.
  - Instrument rule (clarification): `sc` or `tu` missing/invalid (including a custom pitch
    list of the wrong length, out-of-order strings, or a preset not valid for the count) →
    string count **and** tuning both come from `stored`; `fr` missing/invalid → stored fret
    count. Both `sc` and `tu` keys are reported.
  - View fields are decoded against the resolved instrument, so a state impossible on the
    link's own instrument (EC-10.2, e.g. `ss=7` on 6 strings, an occurrence past the end, a
    region beyond `fr`) is clamped by the existing `revalidate*` functions and reported in
    `fellBack` exactly as 022 already does.
  - Non-tool path with a `v` key → `{ kind: 'unknown-tool' }`; without `v` → `{ kind: 'none' }`
    (not-found unchanged).
- **Rationale**: 022's decoder is total and per-field, but it stops at `unsupported-version` /
  `invalid` and falls back to factory defaults (6-string standard, 22 frets). The spec needs
  stored-instrument defaults and best-effort decoding. A parameter on the internal decoders is
  the smallest change; keeping `decodeLink` byte-for-byte compatible keeps the 022 property
  test, the v1 fixture suite and contract D2 intact.
- **Alternatives considered**:
  - Post-process `decodeLink` output (swap in stored values when `fellBack` has `sc`/`tu`):
    rejected because view fields would already have been validated against the wrong
    instrument (string filters, string sets and regions depend on it).
  - Change `decodeLink` itself to the paired rule: breaks 022 contract D2 for `sc`/`tu`.
  - A second Valibot schema set: duplicates the grammar and costs bundle bytes.

## R-03 Session instrument override lives in the instrument store

- **Decision**: Add `override: { tool, link: LinkInstrument, notice: boolean } | null` to
  `src/lib/state/instrument.svelte.ts`, with `receive`, `useMine`, `adopt` and
  `effectiveFor(tool)`. Each tool store already keeps its own instrument
  (`notes.instrument`, `triads.instrument`, CAGED `preferred`/`tuning`) and the fretboard draws
  from it, so the override is: the opened tool's store gets `applyInstrument(link)`, the other
  stores keep the stored instrument. `confirm()` (any confirmed change) and `restore()` (startup,
  erase) clear the override before applying to all tools.
- **Rationale**:
  - The instrument store is already the single orchestrator of tool instruments
    (ADR 0012). Putting the override anywhere else would need the instrument store to call it
    (import cycle) or duplicate the orchestration.
  - Leaving the tool and coming back keeps the override for free: nothing re-applies an
    instrument on navigation.
  - `adopt()` reuses the confirm path's persistence block (extracted into one private
    `persist(config)` helper), so "Adopt this one" writes through exactly the same code as the
    instrument panel (FR-007).
- **Alternatives considered**:
  - Writing the link instrument into `instrument.active` and restoring it later: violates
    "other tools keep the stored instrument" and risks a stray write through any confirm.
  - A separate `override.svelte.ts` store: needs an import cycle with `instrument.svelte.ts`
    for `confirm` to end the override.

## R-04 What counts as "instrument differs" and the panel interaction

- **Decision**:
  - Notice when `stringCount` differs or `!equalsTuning(link.tuning, stored.tuning)` (tunings
    are canonical per ADR 0014/0015, so a custom list equal to a preset is the preset).
  - A fret-count-only difference creates a silent override (`notice: false`): the opened tool
    uses the link's fret count for the session, nothing stored, no notice, no actions.
  - CAGED compares the link's preferred instrument (`sc`/`tu`/`fr`), ignoring `tmp`.
  - Any confirmed change in the instrument panel (`result.changed`) ends the override, including
    a presentation-only change (handedness, orientation). The panel shows and edits the stored
    instrument; Cancel or a no-change Confirm keeps the override.
  - `preferences.erase()` → `instrument.restore(defaults)` also ends the override.
- **Rationale**: Matches the clarifications. Ending on any confirmed change is the simplest
  rule that can never leave the opened tool on a foreign instrument after the user has
  explicitly configured theirs; `confirm` re-applies the stored instrument to every tool
  anyway, including on presentation-only changes.
- **Alternatives considered**: End the override only on a musical change: requires `confirm`
  to skip the opened tool for presentation changes, a second code path for a rare case.

## R-05 Applying a snapshot to a tool store with zero writes

- **Decision**: Add one method per tool store, used only by opening:
  - `notes.receive(view)`, `triads.receive(view)`: assign the view directly (it is already
    validated for the store's instrument), no playback stop, no `preferences.remember`.
  - `caged.receive(view, temporary)`: assign the view, then set `temporary` only if `temporary`
    is true and the in-use tuning class is `non-compatible` (FR-6.14 recomputation), then
    `settleLayers()` / focus re-resolution as the existing transitions do.
  - Order in `opening.start`: `instrument.receive(tool, link)` (applies the link instrument to
    the opened store when it differs) **then** `<tool>.receive(view)`.
- **Rationale**: The existing setters (`setLabelType`) persist the label preference; the spec
  requires zero preference writes on opening (FR-006, SC-003). `restoreLabelType` would change
  the remembered default for `reset()`, which is also wrong: the link's label type is a view
  value, not a preference.
- **Alternatives considered**: Calling the public transitions one by one: writes the label
  preference, stops playback repeatedly, and some transitions are not reachable directly
  (occurrence index, compare quality memory).

## R-06 Use mine and the nearest-equivalent notice

- **Decision**: `instrument.useMine()` stops playback (`'instrument'`), applies
  `instrumentOf(active)` (and the stored tuning for CAGED) to the opened store, clears the
  override, and sets `adjustedIn = tool` when that store reports an adjustment. The existing
  per-tool `instrument_adjusted` notice rendering (`NotesTool`, `TriadsTool`, `CagedTool`) is
  reused unchanged. For CAGED, `endTemporary()` runs when the stored tuning is not
  non-compatible; when it is, the temporary flag is kept (FR-6.14 for the instrument now in use).
- **Rationale**: EC-2.3 already exists for instrument changes (`adaptNotesView`,
  `revalidate` for triads, `reresolveFocus` for CAGED) together with its notice and wording.
  The spec asks for reuse, no new key.
- **Link impossible on its own instrument**: the decoder's clamps are reported in `fellBack`,
  so the incomplete-link notice covers it (clarification). No `instrument_adjusted` notice is
  added on opening, so the user sees one message, not two, for one cause.
- **Alternatives considered**: A new "moved to nearest" message on opening: duplicates the
  incomplete-link notice.

## R-07 Notices: placement, lifetime, wording

- **Decision**:
  - Both link notices render in `ToolLayout` under the header, in the existing `.share-notice`
    slot pattern, using the existing `Notice.svelte` (role `status`, polite, Dismiss button,
    ≥ 44 px targets via `--target-min`). `Notice` gains an optional second action (it has one
    `action` today); the instrument notice needs **Use mine**, **Adopt this one** and Dismiss.
  - Instrument notice: shown while `instrument.override?.tool === tool && notice` and not
    dismissed during the current visit. `dismissed` resets on a real screen change, so it
    reappears when the user returns to the tool (clarification).
  - Incomplete-link notice: `opening.incomplete = { screen }`; shown on that screen only;
    cleared by Dismiss or by `opening.screenChanged()` from the layout's `beforeNavigate`
    (same hook as the other screen-scoped notices).
  - Unknown tool: `[...unknown]/+page.svelte` renders `link_incomplete` instead of
    `notice_not_found` when `opening.incomplete?.screen === 'home'`; the existing address
    rewrite to `/` is unchanged (FR-013).
  - New catalog keys (en, es, pt-BR): `link_instrument` ("This view uses {tuning}"),
    `link_instrument_strings` ("This view uses {count} strings: {tuning}"), `link_use_mine`,
    `link_adopt`, `link_incomplete` ("This link was incomplete; we show the closest view
    possible"). `{tuning}` is `tuningLabel()` for a preset, or for a custom tuning the
    `tuningStrings()` pitches lowest → highest through `noteLabel()` joined by spaces.
- **Rationale**: C-VII (non-blocking, dismissible, ≤ 2 lines) and C-VIII (catalog only, note
  names only from `src/lib/notation`). Reusing `Notice` keeps axe, contrast and target-size
  behaviour already tested. `link_instrument_strings` avoids grammatical string-count prefixes
  that do not translate ("7-string" has no direct adjective form in pt-BR/es); it is the
  localized form of the clarification's "7-string Standard style".
- **Alternatives considered**: A custom banner component: duplicates `Notice`. Prefixing the
  tuning name with a numeral adjective: awkward in two of three languages and redundant with
  the 7-string preset names.

## R-08 Bundle budget (measured)

- **Measurement** (this session, `pnpm build` + `scripts/check-bundle-size.mjs`):
  - Baseline at `991aeaa`: bundle 122,603 B gzip, initial JS reported 120.0 KB (≈ 47 B under
    the 122,880 B cap, matching 022 T046).
  - Same build with `decodeLink` referenced from `hooks.client.ts`: bundle 124,789 B
    (**+2,186 B**), **FAIL 122.1 KB > 120 KB**. The decoder is not in the shipped bundle today
    because nothing in the app imports it (022 imported the encoder only, on purpose).
- **Decision**: Opening a link cannot ship without the decoder, so this slice crosses the
  120 KB cap. Estimated total: decoder +2.2 KB, opening layer + override + notices + messages
  +1.0–1.8 KB → **≈ 123.4–124.2 KB**. Plan:
  1. A savings pass first (tasks): no new Valibot features; `receive.ts` reuses the decoder
     internals; notice reuses `Notice.svelte`; measure after the decoder task and at slice end.
  2. Amend the constitution (MINOR, 1.8.0 → 1.9.0) to raise "Initial JavaScript, gzip" to
     **128 KB**, with a Sync Impact Report, and update `scripts/check-bundle-size.mjs` and the
     cap history in ADR 0002, following the same procedure as the six earlier raises. Recorded
     in plan Complexity Tracking.
- **Rationale**: ADR 0002 (single bundle, `bundleStrategy: 'single'`) forbids lazy chunks, so
  the decoder cannot be deferred. Valibot schemas for links are mandated (C-IX / stack table),
  so replacing the decoder with hand-written checks is not allowed. 128 KB leaves room for wave
  007 (comfort and launch readiness) without amending again immediately; the Lighthouse ≥ 90
  and 3 s home budgets remain the user-facing gates and are still enforced in CI.
- **Alternatives considered**:
  - Dynamic `import()` of the decoder only when a query is present: impossible under
    `bundleStrategy: 'single'` (inlined) and contrary to ADR 0002.
  - Trimming features of earlier slices to win 2–4 KB: out of scope (C-X: deliver this slice's
    scenarios, no more and no less) and would regress shipped behaviour.
  - Raising to exactly the measured need (≈ 124 KB): would force another amendment in wave 007,
    the pattern the maintainer wanted to stop.

## R-09 Security of the received link

- **Decision**: No new rendering path for link text. Every displayed value is either a catalog
  message, a preset name from `tuning-names.ts`, or note names re-derived from validated MIDI
  pitches via `tuningStrings()` + `noteLabel()`. Svelte text interpolation only (no `{@html}`;
  an existing unit test `no-raw-text.test.ts` style check is extended to the new components).
  Hostile inputs are covered by a fast-check property: `readReceivedLink` never throws for
  arbitrary query strings and paths (mirrors 022 D1), and an e2e opens markup/script/very long
  values and asserts no dialog, no injected element, and a usable view.
- **Rationale**: C-IX, NFR-6, FR-010, SC-004.

## R-10 Compatibility fixtures

- **Decision**: The existing `tests/unit/link/fixtures/v1` table (022) is the compatibility
  suite for FR-015/SC-006. This slice adds an "open" table next to it
  (`tests/unit/link/fixtures/v1/open.*`) with receive-layer cases: stored instrument defaults,
  paired `sc`/`tu` fallback, version > 1, missing `v`, unknown tool, unknown extra params,
  duplicates. Existing fixtures are not edited (C-IX: fixtures only grow).
- **Rationale**: One place for version guarantees; the receive table pins the new behaviour.

## R-11 Testing strategy

- Unit (Vitest, test-first per C-IV for `src/lib/link` and state):
  - `tests/unit/link/receive.test.ts` + `receive.property.test.ts` (round trip through
    `readReceivedLink` with stored = link instrument gives `fellBack: []`, never throws).
  - `tests/unit/state/instrument-override.test.ts` (receive / useMine / adopt / confirm ends /
    erase ends / other tools untouched / zero `remember` calls until adopt).
  - `tests/unit/state/opening.test.ts` (start on each URL class, incomplete lifecycle,
    zero storage writes using the in-memory `StorageLike` already used by prefs tests).
  - `tests/unit/tool-layout.test.ts`, `notice.test.ts`, `share-store.test.ts` extended
    (effective instrument in `currentSnapshot`).
- E2E (Playwright, `e2e/open-link.spec.ts`): one test per acceptance scenario of US1–US4
  (Ana scenario: left-handed + pt-BR stored, Drop D CAGED link), Back leaves the app, axe on
  both notices, 320 px layout with both notices visible. Local runs desktop only
  (`pnpm test:e2e:fast e2e/open-link.spec.ts`); full matrix in CI.
