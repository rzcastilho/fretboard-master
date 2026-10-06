---

description: "Task list for Share the Current View (022)"
---

# Tasks: Share the Current View

**Input**: Design documents from `/specs/022-share-a-view/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-12), data-model.md, contracts/ (link-format, link-api, share-ui), quickstart.md

**Tests**: Included. Constitution Principle IV requires the link codec to be test-first, and plan.md / quickstart.md list every test file. Write each test task first and confirm it FAILS before the implementation task that follows it.

**Organization**: Grouped by user story. The codec (encode + decode) is Foundational because US1, US2, US3 and US4 all consume it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (send the view), US2 (manual-copy fallback), US3 (complete, private link), US4 (address follows view)
- Paths are relative to the repository root.

## Verification (CLAUDE.md "Verification tiers")

- Per task: `pnpm vitest run <touched test paths>`
- E2E: `pnpm build:test` once (and after any `src/` change), then `pnpm test:e2e:fast <spec files>`
- New screenshot only: `pnpm playwright test <spec> -g "<name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`
- End of slice, once: `pnpm verify`
- Do NOT run `pnpm test:e2e` (full matrix) or `pnpm lhci` locally.

---

## Phase 1: Setup

- [X] T001 Create empty directories `src/lib/link/`, `tests/unit/link/fixtures/v1/`, and confirm `tests/unit/state/` exists; add a one-line `src/lib/link/index.ts` barrel re-exporting `encodeLink`, `decodeLink`, `linkPath`, `LINK_VERSION`, `musicalOf` and the types (files filled in Phase 2)
- [X] T002 Add the ESLint boundary block for `src/lib/link/**` in `eslint.config.js`, modelled on the existing `src/lib/instrument/**` block. It MUST forbid imports of `svelte*`, `$app/*`, `$lib/paraglide/*`, `$lib/notation/*`, `$lib/prefs/*`, `$lib/shell/*`, and the globals `window`, `document`, `navigator`, `location`, `history` (R-01). Verify with `pnpm lint` on a scratch violation, then remove it.

---

## Phase 2: Foundational — link codec (blocks all stories)

**Purpose**: Pure, versioned, language-free codec. Test-first.

**⚠️ CRITICAL**: No user story starts until encode and decode pass their tests.

- [X] T003 [P] Define types in `src/lib/link/types.ts`: `LinkInstrument` (`stringCount: StringCount` 6|7, `tuning: Tuning`, `fretCount` 12..24), `ShareSnapshot` (discriminated on `tool`: notes/triads/caged; caged adds `temporary: boolean`), `DecodeResult` (`ok` with `fellBack: readonly string[]`, `not-a-tool`, `invalid`, `unsupported-version` with `version`), and `musicalOf(config: InstrumentConfig): LinkInstrument` that drops `handedness`/`orientation` (data-model §1, §2)
- [X] T004 [P] Write test `tests/unit/link/encode.test.ts` first: canonical key order per tool equals link-format §3–§5 exactly; output key set equals the allowed set (never-present list §6: no language, notation, accidentals, handedness, orientation, theme, sound, scroll, timestamps, ids); every value matches token grammar `[A-Za-z0-9.-]` (no percent-encoding); defaults are written explicitly; none token is `-`; 7-string custom tuning + 12 notes + card + 24 frets link length < 1,000 (SC-006); no `fetch` call (spy, FR-018)
- [X] T005 [P] Write test `tests/unit/link/decode.test.ts` first: `v` missing/non-integer → `invalid`; `v=2` → `unsupported-version` with `version: 2`; path `/`, `/about`, `/foo` → `not-a-tool`; each invalid field falls back alone and its key appears in `fellBack` (use the fallback table in data-model §1); unknown params and duplicate keys after the first are ignored; Triads `compare.on=1` with `cq=-` falls back to `{ on: false, quality: null }`; CAGED `ts` non-null only when `ly` has triad layer; `decodeLink` never throws for `fc.webUrl()` and arbitrary query strings (fast-check)
- [X] T006 [P] Write fixtures under `tests/unit/link/fixtures/v1/` (each exports `{ name, snapshot, link }`, origin `https://fretboard.example`): notes-default, notes-rich (7-string custom tuning, all 12 notes, card, hidden names), triads-default, triads-compare-full-neck, triads-compare-off-remembered, caged-default, caged-a-minor-e-shape (chord+pentatonic, link-format §7), caged-triad-layer-ts, caged-temporary, preset-af21-7string, custom-drop-d-6string. Create `tests/unit/link/fixtures/v1/MANIFEST` listing the file names, and `tests/unit/link/fixtures.test.ts` asserting `encodeLink(snapshot, origin) === link`, `decodeLink(new URL(link))` deep-equals `{ kind: 'ok', snapshot, fellBack: [] }`, and that the MANIFEST lists every fixture file and no listed file is missing (append-only guard, FR-019)
- [X] T007 [P] Write property test `tests/unit/link/roundtrip.property.test.ts` first: fast-check arbitraries per tool (valid snapshots only, built on the existing view `initial*`/`revalidate` helpers), ≥ 500 runs each: `decodeLink(new URL(encodeLink(s, o)))` equals `{ kind: 'ok', snapshot: s, fellBack: [] }` (SC-002); two snapshots are equal under the tool's `equals*View` + instrument musical equality + `temporary` iff their links are equal (E1, SC-003)
- [X] T008 Implement `src/lib/link/format.ts`: frozen v1 parameter order arrays per tool, explicit token maps (never `String(enumValue)` passthrough, link-format §8.3), `none` (`-`), bool (`0`/`1`), int and list (`.`-separated) helpers, layers digit order chord, arpeggio, pentatonic, scale, triad
- [X] T009 Implement `src/lib/link/encode.ts`: `LINK_VERSION = 1`, `linkPath(tool)` → `/notes|/triads|/caged`, `encodeLink(snapshot, origin)` building the string by concatenation (`<origin><path>?v=1&…&sc=…&tu=…&fr=…`, no fragment). Tuning: preset id when `tuning.kind === 'preset'`, else `c.` + absolute MIDI pitch per string, string 1 → n (R-03). `compare.quality` always encoded even when compare is off (R-04). Notes `activeStrings` emitted ascending, `selection` in first-selected order. Make T004 pass.
- [X] T010 Implement `src/lib/link/schema.ts` (Valibot: `object`, `picklist`, `fallback`, `pipe`, `regex` only, R-12) with one per-field schema and fallback exactly per data-model §1 validation table. Then implement `src/lib/link/decode.ts`: total `decodeLink(url: URL)`; parse instrument first, then view fields against that instrument, then apply existing pure `revalidate` helpers (notes, triads) for cross-field clamps; custom tuning → offsets against `referencePitches(count)` then `tuningFromOffsets` so a preset-equal custom list decodes to the preset (ADR 0014); collect `fellBack`. Make T005, T006, T007 pass.
- [X] T011 Run `pnpm vitest run tests/unit/link` and `pnpm lint`; then `pnpm build && node scripts/check-bundle-size.mjs build` to record the codec's bundle delta (R-12)

**Checkpoint**: codec green; stories can begin.

---

## Phase 3: User Story 1 — Send exactly this view (Priority: P1) 🎯 MVP

**Goal**: Every tool has a Share button; coarse pointer + share API → system sheet with link and localized title; otherwise clipboard with a "Link copied" notice.

**Independent Test**: CAGED, A minor, E shape, Chord + Pentatonic: phone → sheet receives `{ url, title: "A minor — CAGED, E shape" }`; desktop → clipboard holds the link and a role=status "Link copied" shows.

### Tests for User Story 1 (write first, confirm failing)

- [X] T012 [P] [US1] Write `tests/unit/state/share-store.test.ts`: the full behavior table of link-api §2 using a fake `SharePlatform` and injected clock — share ok / `AbortError` (no notice, `writeText` not called) / other error → clipboard notice; fine pointer never calls `share`; no API → copy; second `share()` while `busy` ignored; a second successful copy bumps `notice.id`; notice clears after 4,000 ms on the fake clock; `dismissNotice()` clears; `share()` never rejects; `share()` makes no `fetch` call; `currentLink(tool)` equals `encodeLink(currentSnapshot(tool), origin)`
- [X] T013 [P] [US1] Write `tests/unit/share-title.test.ts`: exact titles "A minor — CAGED, E shape", "A minor — CAGED", "C major — Triads, root position", "C, E, G — Notes", "Notes"; matrix of every state shape × en/es/pt-BR × letters/solfège notation × 3 accidental policies asserting the title is never empty and contains no `undefined`, empty segment, or dangling `—` or `,`; title derives from the same snapshot as the link (FR-015)
- [X] T014 [P] [US1] Write `tests/unit/share-button.test.ts` (@testing-library/svelte): native `<button type="button">`, visible text from `share_button`, `aria-busy="true"` while `share.busy`, activation calls `share.share(tool, shareTitle(currentSnapshot(tool)))`, registers itself via `share.registerOpener` and unregisters on destroy; extend `tests/unit/tool-layout.test.ts` so Share is present on notes, triads and caged and absent on Home/About
- [X] T015 [P] [US1] Write `e2e/share.spec.ts` scenarios US1-1…US1-5 and the double-tap edge case per quickstart §2: phone sheet (addInitScript stubs `navigator.share`, `matchMedia('(pointer: coarse)')` forced true) called once with `{ url, title }` and no notice; desktop copy with clipboard permission, clipboard text equals link and "Link copied" has role=status; Notes and Triads Share present, ≥ 44×44, per-tool title; `AbortError` shows nothing; es and pt-BR translated button/notice/title with link identical to en; two rapid clicks call a slow share stub once

### Implementation for User Story 1

- [X] T016 [P] [US1] Add the 12 `share_*` message keys to `messages/en.json`, `messages/es.json`, `messages/pt-BR.json` with the exact wording of share-ui §2 (`share_button`, `share_copied`, `share_fallback_label`, `share_fallback_region`, `share_title_caged`, `share_title_caged_shape`, `share_title_triads`, `share_title_inversion_root|first|second`, `share_title_notes`, `share_title_notes_empty`); align es/pt-BR terms with existing glossary (e.g. "Tríades"); run the paraglide compile and the catalog parity test
- [X] T017 [US1] Implement `src/lib/shell/share-title.ts` `shareTitle(snapshot): string` per share-ui §3: CAGED key via `noteLabel(cagedRootSpelling(view))`, quality via `triads_quality_<q>`, shape = `view.focus.letter`; Triads root via `noteLabel(effectiveRootSpelling(rootPc, override, quality))` + `share_title_inversion_<inv>`; Notes via `noteLabel(defaultSpelling(pc))` joined by `", "`, empty → `share_title_notes_empty`. Make T013 pass.
- [X] T018 [US1] Implement `src/lib/state/share.svelte.ts`: `currentSnapshot(tool)` (reads notes/triads/caged stores + `musicalOf(instrument.active)` + caged `temporary`), `currentLink(tool)` using `location.origin`, `SharePlatform` (default reads `navigator.share`, `navigator.clipboard?.writeText`, `matchMedia('(pointer: coarse)')` lazily at call time), `share` object with `busy`, `notice`, `fallback`, `share(tool, title)` cascade (R-07), `dismissNotice`, `closeFallback`, `viewChanged`, `registerOpener`, and test seams `useSharePlatformForTests`, `useShareClockForTests`, `resetShareForTests`. Invariants: notice and fallback never both non-null; `busy` ignores re-entry. Make T012 pass.
- [X] T019 [US1] Implement `src/lib/shell/ShareButton.svelte` per share-ui §1 (size ≥ `--target-min`, 44×44; `aria-busy`; opener registration). Make T014 pass.
- [X] T020 [US1] Edit `src/lib/shell/ToolLayout.svelte`: render `ShareButton` right after `AppNav` in the header (tools only); render the confirmation directly under `<header>` as existing `Notice.svelte` wrapped in `{#key share.notice.id}` with message `share_copied` and `ondismiss` → `share.dismissNotice()`. Make the tool-layout assertions from T014 pass.
- [X] T021 [US1] `pnpm build:test`, then `pnpm test:e2e:fast e2e/share.spec.ts` (US1 scenarios) and fix failures. If a screenshot is added, update only that one per the CLAUDE.md command.

**Checkpoint**: US1 delivers the MVP — share works on all three tools.

---

## Phase 4: User Story 2 — Fall back to a manual copy (Priority: P1)

**Goal**: When share and clipboard are unavailable or refused, the link appears in a labelled, pre-selected, read-only field; no false "copied".

**Independent Test**: Remove `navigator.clipboard` (or reject `writeText`), activate Share, see "Copy this address" with the whole value selected and focused; Escape/Dismiss/view change closes it and focus returns to Share.

### Tests for User Story 2 (write first, confirm failing)

- [X] T022 [P] [US2] Write `tests/unit/share-fallback.test.ts`: `<section aria-labelledby>`, `<label for>` text from `share_fallback_label`, `<input type="text" readonly>` value equals href, focused and fully selected on mount, Dismiss button (`notice_dismiss`) closes, Escape inside the section closes, focus returns to the registered opener, no focus trap, no error-red class, input has `min-inline-size: 0` and `inline-size: 100%`
- [X] T023 [P] [US2] Extend `tests/unit/state/share-store.test.ts`: fallback cases from the link-api §2 table (clipboard rejects / `writeText` null → `fallback.href` set, no notice ever, previous notice cleared); `viewChanged(newHref)` closes the fallback only when the href differs; `closeFallback()` focuses the registered opener
- [X] T024 [P] [US2] Add US2-1/2/3 scenarios to `e2e/share.spec.ts`: clipboard removed and `writeText` rejecting both show the field "Copy this address", focused, whole value selected, no "copied" text; Escape, Dismiss, then a view change each close the panel with focus on Share; axe clean with the fallback open in en, es and pt-BR (SC-005, SC-008)

### Implementation for User Story 2

- [X] T025 [US2] Implement `src/lib/shell/ShareFallback.svelte` per share-ui §1 using existing notice tokens only (no error red, no modal, ≤ 2 lines, `message share_fallback_region` as the region name). Make T022 pass.
- [X] T026 [US2] Complete fallback behavior in `src/lib/state/share.svelte.ts` (`fallback` path, `viewChanged`, `closeFallback`, focus return). Make T023 pass.
- [X] T027 [US2] Edit `src/lib/shell/ToolLayout.svelte`: render `ShareFallback` in the same slot under `<header>` (mutually exclusive with the notice); add an `$effect` calling `share.viewChanged(currentLink(tool))`; close the fallback on tool change/unmount
- [X] T028 [US2] `pnpm build:test`, then `pnpm test:e2e:fast e2e/share.spec.ts` and fix failures

**Checkpoint**: US1 + US2 — no Share attempt ends silently.

---

## Phase 5: User Story 3 — The link describes the full view and nothing personal (Priority: P1)

**Goal**: Prove completeness and exclusion across the product, and retire the stale "not in share links" documentation. The codec itself is in Phase 2.

**Independent Test**: Build a non-default view in each tool; decoding its link reproduces the state; changing any excluded preference leaves the link byte-identical.

### Tests for User Story 3

- [X] T029 [P] [US3] Add to `tests/unit/link/encode.test.ts` an exclusion matrix: for each tool, switching locale (en/es/pt-BR), notation, accidental policy, handedness, orientation, theme, sound and scroll leaves `currentLink(tool)` byte-identical (SC-003, E3); changing each included field changes it (100%); the encoder's output contains no timestamp, identifier or random token across 100 invocations
- [X] T030 [P] [US3] Add to `tests/unit/state/share-store.test.ts` an integration case: set a custom tuning with different notes on each string, `currentLink` carries each string's MIDI pitch; a default view on the default instrument still yields a valid link (`decodeLink` → `ok`); CAGED temporary flag appears as `tmp=1` and is never written to storage (spy on prefs persistence)

### Implementation for User Story 3

- [X] T031 [P] [US3] Edit comments in `src/lib/state/triads-view.ts` ("not in share links" → now encoded by `src/lib/link`) and `src/lib/state/caged-view.ts` ("Never serialized" → now encoded) so they are true
- [X] T032 [P] [US3] Edit the `temporary` comment in `src/lib/state/caged.svelte.ts`: the flag is now carried in share links (FR-009 supersedes slice 015) but is still never written to device storage
- [X] T033 [P] [US3] Write `docs/adr/0021-share-link-format-and-address-sync.md` (Context, Decision, Consequences, rejected alternatives from R-02, R-03, R-04, R-08); match the structure of the existing ADR files in `docs/adr/` and add it to the ADR index if one exists
- [X] T034 [US3] Run `pnpm vitest run tests/unit/link tests/unit/state/share-store.test.ts` and fix failures

**Checkpoint**: Links are complete, private, versioned, documented.

---

## Phase 6: User Story 4 — The address bar follows the view (Priority: P2)

**Goal**: Browser address equals the Share link within 150 ms of the last change, with zero added history entries.

**Independent Test**: On Triads change the inversion; the URL's `inv=` updates; browser back lands on the previous screen.

### Tests for User Story 4 (write first, confirm failing)

- [X] T035 [P] [US4] Write `tests/unit/state/address-sync.test.ts` with fake timers for `createAddressSync`: N `schedule` calls within 150 ms → exactly one `write`, with the last href, 150 ms after the last call (A4); 200 schedules in a burst → 1 write; `flush()` writes pending now; `cancel()` drops pending; a throwing `write` never propagates and later schedules on the same screen do not call `replaceState` again until `openToolAddress` runs (A3); for the SvelteKit binding with mocked `$app/navigation`: writes whose pathname differs from `location.pathname` or whose href equals `location.href` are skipped (A2), and only `replaceState` is ever called, with `page.state` preserved, never `pushState`/`goto` (A1)
- [X] T036 [P] [US4] Write `e2e/address-sync.spec.ts` per quickstart §2: US4-1 Home → Triads → change inversion, `expect.poll` URL has the new `inv=`, `goBack()` lands on `/`; US4-2/SC-004 10 view changes then one `goBack()` leaves the tool; US4-3 settled `page.url()` equals the copied Share link; US4-4 Triads → CAGED gives `/caged?v=1&…` with no Triads keys; Panel: change frets in the instrument panel (uses `history.back()`) and `fr=` reflects the new count; First load: `/triads?v=1&inv=second…` shows the initial state, URL replaced by the canonical default link, `history.length` unchanged
- [X] T037 [P] [US4] Add the SC-007 case to `e2e/perf.spec.ts`: 200 rapid inversion/root changes stay within the 100 ms control-to-fretboard budget, final URL matches the final view within 150 ms, no console error

### Implementation for User Story 4

- [X] T038 [US4] Implement `src/lib/state/address.ts`: `createAddressSync({ write, delayMs, setTimer, clearTimer })` returning `{ schedule, flush, cancel }` (plain TS, no framework imports)
- [X] T039 [US4] Implement `src/lib/state/address.svelte.ts`: `ADDRESS_DEBOUNCE_MS = 150`; `write` using `replaceState` from `$app/navigation` with `page.state` from `$app/state`, guarded by the pathname/href checks and wrapped in `try { … } catch { syncDisabled = true; }` (a non-empty catch: a failed write turns address sync off for the current tool screen so the error never reaches the UI and is not retried in a loop (FR-016); `openToolAddress` resets `syncDisabled = false`, and the Share command still encodes state directly); exports `openToolAddress(tool)` (immediate canonical replace, the single 006/002 seam, A5), `scheduleAddress(href)`, `cancelAddress()`; a `popstate` listener re-schedules the current link (instrument panel `history.back()`). Make T035 pass.
- [X] T040 [US4] Edit `src/lib/shell/ToolLayout.svelte`: in `onMount` call `openToolAddress(tool)`; add one `$effect` reading `currentLink(tool)` and calling `scheduleAddress`; nothing reads `url.searchParams` during render (prerender stays valid, R-09)
- [X] T041 [US4] Edit `src/routes/+layout.svelte`: `beforeNavigate` with a pathname change calls `cancelAddress()`; Home and About never get parameters
- [X] T042 [US4] `pnpm build:test`, then `pnpm test:e2e:fast e2e/address-sync.spec.ts e2e/perf.spec.ts` and fix failures

**Checkpoint**: all four stories work independently and together.

---

## Phase 7: Polish & Cross-Cutting

- [X] T043 [P] Add axe checks to `e2e/share.spec.ts` for tool screens with the notice open and with the fallback open in en/es/pt-BR (SC-008), plus 320 px and 200% zoom with the fallback open: no horizontal page overflow, fretboard not covered (Principle VII)
- [X] T044 [P] Add a Vitest assertion (in `tests/unit/state/share-store.test.ts`) that `share()` and link generation make no network request, and a prefs/storage spy assertion that Share writes nothing to storage (Principle II, FR-018)
- [X] T045 Run the quickstart manual smoke (§3) on `pnpm build && pnpm preview`: CAGED A minor E shape Pentatonic → address `rt=9&…&q=minor&fc=E.0&ly=10100…`, Share copies an identical link, Back returns Home
- [X] T046 End of slice, once: `pnpm verify` (check, lint incl. `src/lib/link` boundary, format, Vitest + coverage, build, bundle ≤ 120 KB, e2e desktop). Record the final bundle delta (expected +2.0–3.0 KB gzip) and fix any failure; leave the full browser matrix to CI.
  - Bundle: 122,833 B vs 119,415 B at merge-base 210be2d → **+3,418 B (+3.3 KB)**, above the expected range; 47 B headroom under the 122,880 B limit.
  - Fixed: TM-9 screenshot baselines regenerated (phone, phone-touch, desktop) for the new Share button in the app bar; `e2e/nojs.spec.ts` URL wait now accepts the synced `?v=1&…` query (desktop project).
  - Not verified locally: `e2e/perf.spec.ts` latency budgets failed under host load average ≈ 43 (10–11 tests, 1.0–3.5× budget); defer to CI.

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (blocks everything) → stories → **Phase 7**.
- **US1** needs Phase 2. **US2** needs US1's store/layout files (T018, T020) because it extends them. **US3** needs Phase 2 and `currentLink` from T018. **US4** needs Phase 2 and `currentLink` from T018; it is otherwise independent of US1's UI and of US2.
- Within a story: tests → implementation → e2e run. Tasks editing the same file are sequential (`ToolLayout.svelte`: T020 → T027 → T040; `share.svelte.ts`: T018 → T026; `share-store.test.ts`: T012 → T023 → T030 → T044; `e2e/share.spec.ts`: T015 → T024 → T043).
- Story priority order: US1, US2, US3 (all P1), then US4 (P2).

## Parallel Opportunities

- Phase 2: T003, T004, T005, T006, T007 together (different files); then T008 → T009 → T010.
- US1 tests T012–T015 together; T016 (messages) in parallel with T017 once T013 exists.
- US2 tests T022–T024 together.
- US3: T029, T030, T031, T032, T033 together.
- US4: T035, T036, T037 together; US4 (T038–T041) can run in parallel with US2/US3 on a second branch once T018 is merged, except `ToolLayout.svelte` edits, which must be serialised.
- Polish: T043, T044 together.

### Parallel Example: Phase 2 tests

```text
Task: "Write tests/unit/link/encode.test.ts"       (T004)
Task: "Write tests/unit/link/decode.test.ts"       (T005)
Task: "Write fixtures + fixtures.test.ts"          (T006)
Task: "Write tests/unit/link/roundtrip.property.test.ts" (T007)
```

## Implementation Strategy

### MVP first
1. Phase 1 + Phase 2 (codec, test-first).
2. Phase 3 (US1): Share works on every tool. **Stop and validate** with `pnpm test:e2e:fast e2e/share.spec.ts`.
3. Phase 4 (US2) immediately after: without the fallback, Share can silently do nothing, so US1 alone is not shippable.

### Incremental delivery
US1 → US2 → US3 (verification + docs) → US4 (address sync) → Polish. Each checkpoint is demonstrable. Measure bundle size after the codec (T011) and at slice end (T046).

## Notes

- Decode is exercised only by tests in this slice; applying a received link is 006/002 and must plug in at `openToolAddress` only. Do not build a hook registry (Principle X).
- Constraints quoted for implementers: `stringCount` 6|7; `fretCount` integer 12..24 (fallback 22); Notes `selection` 0–12 distinct ints 0..11; `activeStrings` non-empty, distinct, 1..stringCount; `region` 0 ≤ start ≤ end ≤ fretCount; Triads `stringSet` 3..stringCount; CAGED `layers` exactly 5 binary digits with at least one `1`; `ts` non-null only when `layers.triad`; link under 1,000 characters.
- Commit after each task or logical group using Conventional Commits.
