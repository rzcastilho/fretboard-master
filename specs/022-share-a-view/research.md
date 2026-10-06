# Research: Share the Current View (022)

Phase 0 output for [plan.md](./plan.md). Every Technical Context unknown is resolved below as
Decision / Rationale / Alternatives. Code references are to the repository at `afdd607`.

## R-01 Where the codec lives and what it may import

- **Decision**: New pure module `src/lib/link/` (`format.ts` wire tokens, `encode.ts`,
  `decode.ts`, `schema.ts` Valibot, `types.ts`). It imports `$lib/theory/*`,
  `$lib/instrument/*`, the pure view modules `$lib/state/{notes,triads,caged}-view` (types and
  `revalidate`/`initial*` helpers) and `valibot`. It MUST NOT import `svelte`, `$app/*`,
  `$lib/paraglide/*`, `$lib/notation/*`, `$lib/prefs/*`, `$lib/shell/*`, or touch `window`,
  `document`, `navigator`, `location`, `history`. A new `eslint.config.js` block enforces this,
  modelled on the `src/lib/instrument/**` block.
- **Rationale**: Constitution source layout already reserves `src/lib/link`; Principle III wants
  view state outside components "so that share links … can drive it"; Principle IV lists the
  link codec as test-first. Forbidding `$lib/notation` and paraglide makes FR-010/FR-012
  language-independence structural, not just tested.
- **Alternatives**: put the codec in `src/lib/state/` (rejected: state may import `$app/*`, the
  boundary would be weaker); reuse `src/lib/prefs/schema.ts` (rejected: prefs is a different
  versioned format with different fields and fixtures).

## R-02 Wire format v1 (path, query, tokens, order)

- **Decision**: `<origin>/<tool>?v=1&<tool fields>&<common fields>`; fixed per-tool parameter
  order; all values from the ASCII set `[A-Za-z0-9.-]`, so no percent-encoding ever occurs and
  the encoder builds the string by concatenation (no `URLSearchParams` ordering or encoding
  surprises). List separator `.`; the single "none" token is `-`; booleans are `0`/`1`. Full
  grammar in [contracts/link-format.md](./contracts/link-format.md).
- **Rationale**: Spec clarifications fix path-per-tool, `v` first, query params, no fragment,
  every field explicit (canonical), and one "none" token. Short keys keep the 7-string Notes
  worst case near 170 characters (SC-006 < 1,000). Enum values reuse the code's own ids
  (`full-neck`, `diminished`, `AF-21`), which are stable ASCII identifiers.
- **Alternatives**: base64 JSON blob (rejected: opaque, not canonical across key order, longer);
  fragment (`#`) state (rejected by clarification); omitting defaults (rejected by
  clarification: defaults may change).

## R-03 Instrument in the link: preset id vs per-string pitches

- **Decision**: `sc=<6|7>&tu=<id>&fr=<12..24>`, where `tu` is the preset `TuningId` (`AF-1` …
  `AF-23`) when `InstrumentConfig.tuning.kind === 'preset'`, otherwise `c.` followed by each
  string's absolute MIDI pitch in string order 1 → n (string 1 = highest), e.g.
  `c.64.59.55.50.45.38` (drop D). Decode converts pitches to offsets against
  `referencePitches(count)` and re-canonicalises with `tuningFromOffsets`, so a custom list that
  matches a preset decodes to that preset (ADR 0014).
- **Rationale**: Clarification says "each string's pitch listed in string order". Absolute
  pitches are self-describing and survive a future change of the offset reference; offsets
  stay the in-memory/prefs form. The source is `instrument.active` (app-wide store, ADR 0012),
  which already holds the canonical `Tuning`; handedness/orientation are in the same record but
  are never read by the encoder (FR-010).
- **Alternatives**: offsets (`c.0.0.0.0.0.-2`, rejected: relative to an implicit reference;
  minus sign collides with the none token visually); note names (rejected: language/notation
  dependent, FR-012).

## R-04 Per-tool field mapping

- **Decision** (state field → param):
  - Notes: `selection` → `sel` (pitch classes, first-selected order, `-` if empty);
    `activeStrings` → `str`; `region` → `rg=<start>.<end>`; `background` → `bg`;
    `hideNames` → `hn`; `card` → `cd=<string>.<fret>` or `-`; `labelType` → `lb`.
  - Triads: `rootPc` → `rt`; `spellingOverride` → `sp`; `quality` → `q`; `inversion` → `inv`;
    `stringSet` → `ss`; `view` → `vw`; `occurrence` → `oc`; `compare.on` → `cmp`;
    `compare.quality` → `cq` (quality or `-`); `labelType` → `lb`.
  - CAGED: `rootPc` → `rt`; `spellingOverride` → `sp`; `quality` → `q`; `focus` →
    `fc=<letter>.<ordinal>` or `-`; `layers` → `ly` (five `0/1` digits in the fixed order
    chord, arpeggio, pentatonic, scale, triad); `connections` → `cn`; `triadSet` → `ts`
    (3..7 or `-`); `labelType` → `lb`; temporary-standard flag → `tmp`.
- **Rationale**: Mirrors the clarification table one-to-one; `compare.quality` is encoded even
  when `on` is false because the store remembers it (`setCompare` reuses it), so the round trip
  is exact (SC-002). Comments in `triads-view.ts` ("not in share links") and `caged-view.ts`
  ("Never serialized") are now false and are updated by this slice; the CAGED
  `temporary` comment in `caged.svelte.ts` ("never in the URL") likewise (FR-009 supersedes 015).
- **Alternatives**: drop `cq` when `cmp=0` (rejected: loses remembered state, breaks exact
  round-trip); encode layers as a name list (rejected: longer, order ambiguity).

## R-05 Decoding and validation (Principle IX)

- **Decision**: `decodeLink(url: URL): DecodeResult` is total and never throws. `v` absent,
  non-integer, or ≠ 1 → `{ kind: 'invalid' | 'unsupported-version' }`. Path not a tool →
  `{ kind: 'not-a-tool' }`. Otherwise the instrument is parsed first (each field with its own
  Valibot `v.fallback` to the default), then the view fields against that instrument (each with
  its own fallback to the tool's initial value), then the tool's existing pure `revalidate`
  helper clamps cross-field constraints (strings ≤ `sc`, region ≤ `fr`, occurrence count). The
  result lists `fellBack: readonly string[]` param keys. Unknown params are ignored (forward
  extensibility, FR-011).
- **Rationale**: Constitution IX mandates schema parsing with per-field fallback; prefs already
  uses Valibot this way. 006/002 consumes `fellBack` to decide on notices; this slice uses
  decode only in round-trip and fixture tests, but it must exist now so the fixture suite
  proves both directions (FR-019).
- **Alternatives**: all-or-nothing decode (rejected by IX); hand-written parsing without
  Valibot (rejected: stack table mandates Valibot for share links).

## R-06 Compatibility fixtures

- **Decision**: `tests/unit/link/fixtures/v1/*.ts` each export `{ name, snapshot, link }`;
  `tests/unit/link/fixtures.test.ts` asserts `encodeLink(snapshot) === link` and
  `decodeLink(new URL(link))` deep-equals `snapshot` with `fellBack: []`. Minimum set: Notes
  default, Notes rich (7-string custom, all 12 notes, card, hidden), Triads default, Triads
  compare on + full-neck, Triads compare-off-remembered, CAGED default, CAGED BD example (A
  minor, E shape, chord+pentatonic), CAGED triad layer with `ts`, CAGED temporary, preset
  tuning (`AF-21` 7-string), drop-D custom 6-string. A guard test asserts the fixture file list
  only grows (snapshot of names in `tests/unit/link/fixtures/v1/MANIFEST`).
- **Rationale**: FR-019 / IX "fixtures only ever added". Origin fixed to
  `https://fretboard.example` in fixtures; encoder takes origin as a parameter.
- **Alternatives**: Vitest inline snapshots (rejected: `-u` silently rewrites them, defeating
  "never removed").

## R-07 Share path selection

- **Decision**: `share()` in `src/lib/state/share.svelte.ts`:
  1. If `busy`, return (edge case: double tap).
  2. Build `href` from current state (never from the address bar, so never stale).
  3. If `platform.canShare && platform.coarsePointer` → `await platform.share({ url, title })`;
     resolve → done (no notice; the OS sheet is the feedback); reject with `name ===
     'AbortError'` → done, nothing shown; other reject → step 4.
  4. If `platform.writeText` exists → `await writeText(href)`; resolve → show "Link copied"
     notice (replace any current one, 4 s auto-hide); reject → step 5.
  5. Open fallback panel with `href`.
  `platform` is an injectable `SharePlatform` adapter (default reads `navigator.share`,
  `navigator.clipboard?.writeText`, `matchMedia('(pointer: coarse)')` lazily at call time).
- **Rationale**: Clarifications (coarse-pointer rule, AbortError convention, FR-005 cascade).
  Injection keeps Vitest deterministic (IV) without touching globals; Playwright stubs
  `navigator.share`/`clipboard` with `page.addInitScript` and `emulateMedia`/touch projects.
  `navigator.canShare` is not consulted: URL+title payloads are always shareable where `share`
  exists.
- **Alternatives**: `document.execCommand('copy')` legacy path (rejected: deprecated, and the
  fallback field already covers it); capability-only detection (rejected: contradicts BD
  desktop acceptance).

## R-08 Address-bar sync mechanics

- **Decision**: `src/lib/state/address.ts` (plain TS, injected `write` and `clock`) exposes
  `createAddressSync({ write, delayMs: 150, setTimer, clearTimer })` with `schedule(href)`,
  `flush()`, `cancel()`. `src/lib/state/address.svelte.ts` binds it to SvelteKit:
  `write = (href) => { try { if (location.pathname === new URL(href).pathname &&
  location.href !== href) replaceState(href, page.state); } catch { syncDisabled = true; } }` using
  `replaceState` from `$app/navigation` (keeps router state and the instrument panel's
  `page.state` flag). `ToolLayout.svelte` runs one `$effect` that reads `currentLink(tool)` and
  calls `schedule`, started in `onMount` via `openToolAddress(tool)` (first write immediate,
  replace, no debounce). `beforeNavigate` with a pathname change calls `cancel()`. A `popstate`
  listener (instrument panel Back calls `history.back()`, which restores the older URL of the
  tool entry) re-schedules the current link.
- **Rationale**: FR-013/FR-014, SC-004, SC-007. Shallow `replaceState` does not run
  `beforeNavigate`/`afterNavigate` for a new screen, so playback, CAGED `screenChanged` and
  focus-to-heading are untouched. Debounce bounds Safari's 100-calls/10 s limit at ≤ 67 calls
  per 10 s. The pathname guard prevents a stale timer from writing the old tool's state onto
  the new tool's URL (spec US4-4). The `catch` is not empty (address writes are not one of the
  constitution's fire-and-forget storage/measurement exceptions): it sets `syncDisabled`, which
  makes `write` a no-op for the rest of the current tool screen, so a failure never reaches the
  UI (FR-016) and is not retried in a loop; `openToolAddress` clears it. The Share command still
  encodes state directly, so it is never stale.
- **Alternatives**: `history.replaceState` directly (rejected: desyncs SvelteKit's
  `sveltekit:pageurl`/index as the `[...unknown]` route comment warns); `goto(..., {
  replaceState: true, noScroll, keepFocus })` (rejected: runs load and navigation callbacks,
  stops playback, moves focus); throttle instead of debounce (rejected: clarification fixed
  trailing debounce).

## R-09 Prerender and first load

- **Decision**: Routes stay `prerender = true`. Nothing reads `url.searchParams` during render
  (SvelteKit throws when prerendering accesses search params). `openToolAddress` runs in
  `onMount` only, after the stores hold their initial state (preferences restore already ran in
  the layout). In this slice it ignores incoming params and replaces the address with the
  initial state's canonical link (FR-013). `openToolAddress` is the single seam where 006/002
  will insert "decode and apply" before the first write; no hook registry is built now
  (Principle X).
- **Rationale**: Keeps the static/no-JS behavior and prerender intact (ADR 0001, 0003).
- **Alternatives**: `+page.ts` load reading params (rejected: breaks prerender, and applying is
  006/002 scope).

## R-10 Share title

- **Decision**: `src/lib/shell/share-title.ts` exports `shareTitle(snapshot): string`, built
  from new catalog templates plus `src/lib/notation` names:
  - CAGED: `share_title_caged` "{key} {quality} — CAGED" / `share_title_caged_shape`
    "{key} {quality} — CAGED, {shape} shape"; key = `noteLabel(cagedRootSpelling(view))`,
    quality = existing lower-case `triads_quality_major|minor`; shape = the CAGED letter (a
    system name, not a note name, same as `caged_focus_status`).
  - Triads: `share_title_triads` "{root} {quality} — Triads, {inversion}" with new lower-case
    `share_title_inversion_root|first|second` (existing `triads_inversion_*` are
    sentence-case control labels).
  - Notes: `share_title_notes` "{notes} — Notes" with notes = selection mapped through
    `noteLabel(defaultSpelling(pc))` joined by `", "`; empty → `share_title_notes_empty`
    "Notes".
  Templates are whole sentences per language so es/pt-BR word order is free; a unit test runs
  every state shape × 3 languages × 2 notations × 3 accidental policies and asserts no
  `undefined`, empty segment, or dangling `—`/`,`.
- **Rationale**: FR-015, FR-017, Principle VIII (note names only from `src/lib/notation`). The
  title lives in `shell` because it needs paraglide; the codec stays language-free.
- **Alternatives**: reuse tool names (`tool_notes_name` = "Fretboard Notes", rejected: spec
  example says "Notes"); concatenate pieces in code (rejected: breaks non-English word order).

## R-11 Confirmation notice and fallback panel UI

- **Decision**:
  - `ShareButton.svelte` (shell) in the `ToolLayout` app bar after `AppNav`; label
    `share_button` ("Share"), `aria-busy` while pending; target ≥ `--target-min`.
  - Confirmation reuses `Notice.svelte` (role=status, polite) rendered by `ToolLayout` under the
    header, keyed by a counter (`{#key share.noticeId}`) so a repeat replaces, not stacks;
    `ondismiss` clears it; the store's 4 s timer (injected clock in tests) clears it too.
  - Fallback `ShareFallback.svelte`: `<section aria-labelledby>` with `<label for>`
    "Copy this address", `<input readonly value={href}>` focused and `select()`ed on mount,
    a Dismiss button; Escape on the section closes it; closes when `currentLink(tool)` differs
    from the shown `href` (view change) or on unmount (tool change); focus returns to the Share
    button (`bind:this` ref passed through the store as an opener callback, pattern from
    `instrument-opener.ts`).
  - Colors from existing notice tokens; no error red; no new tokens expected.
- **Rationale**: C-VII (non-blocking, dismissible, ≤ 2 lines, no modal, tokens), C-V (keyboard,
  focus, no trap), spec clarifications.
- **Alternatives**: toast library (rejected: dependency, bundle); `<dialog>` (rejected: modal).

## R-12 Bundle and performance

- **Decision**: No new runtime dependency (Valibot already shipped). Estimated +2.0–3.0 KB gzip
  (codec ~1.2, share/address state ~0.6, two components ~0.6, catalog strings ×3 ~0.4). Measure
  with `pnpm build && node scripts/check-bundle-size.mjs build` after the codec lands and at the
  end of the slice. Encoding is O(fields) string concatenation (< 0.05 ms), run on every view
  change by the `$effect`; the write is deferred by the debounce, so the 100 ms control budget
  (C-VI) is unaffected. `e2e/perf.spec.ts` gains a 200-rapid-changes case (SC-007).
- **Rationale**: C-VI gates; 021 left headroom under 120 KB.
- **Alternatives**: lazy-load the share UI (rejected: ADR 0002 single bundle).
