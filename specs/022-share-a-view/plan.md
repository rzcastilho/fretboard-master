# Implementation Plan: Share the Current View

**Branch**: `022-share-a-view` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-share-a-view/spec.md`

## Summary

Every tool (Notes, Triads, CAGED) gets a **Share** command in its application bar that turns
the current view into a canonical, versioned, language-independent link
(`<origin>/<tool>?v=1&…`) and delivers it through the system share sheet (share API **and**
coarse pointer), otherwise the clipboard with a polite "Link copied" notice, otherwise an inline
"Copy this address" field. The browser address follows the view through a 150 ms trailing
debounce using SvelteKit's shallow `replaceState`, so view changes never add history entries.

Technical approach (details in [research.md](./research.md)):

- New pure codec `src/lib/link` (encode + Valibot-based total decode) with an ESLint boundary
  that forbids i18n, notation, DOM and framework imports, making link language-independence
  structural (R-01–R-05).
- Append-only v1 compatibility fixtures under `tests/unit/link/fixtures/v1/` (R-06).
- `src/lib/state/share.svelte.ts` runs the share → copy → fallback cascade through an injectable
  `SharePlatform` (R-07); `src/lib/state/address.{ts,svelte.ts}` debounces address writes and
  guards against stale-tool writes and the instrument panel's `history.back()` (R-08).
- `src/lib/shell/share-title.ts` builds localized titles from new catalog templates and
  `src/lib/notation` (R-10); `ShareButton.svelte` and `ShareFallback.svelte` plus the existing
  `Notice.svelte` provide the UI (R-11).

Assumptions recorded (headless plan, no open questions):

- Custom tunings are encoded as absolute MIDI pitches per string (string 1 → n), not offsets
  — rejected alternative: offsets (relative to an implicit reference) (R-03).
- `compare.quality` is encoded even when Compare is off, because the store remembers it —
  rejected alternative: omit when off, which breaks the exact round trip (R-04).
- Decode in this slice is exercised only by tests; applying a received link is 006/002. The one
  seam is `openToolAddress()`; no hook registry is built (Principle X) (R-09).
- Share-title templates are new whole-sentence catalog keys rather than concatenated existing
  labels, because the existing inversion labels are sentence-case and es/pt-BR word order differs
  — rejected alternative: concatenating existing strings (R-10).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`), Svelte 5 (runes), SvelteKit 2 with
`adapter-static` (prerendered, `trailingSlash: 'never'`, `bundleStrategy: 'single'`)

**Primary Dependencies**: SvelteKit (`$app/navigation` `replaceState`, `beforeNavigate`;
`$app/state` `page`), Paraglide JS (catalog), Valibot 1 (link schema — already a runtime
dependency). No new runtime dependency.

**Storage**: N/A for links (state lives in the URL only). Preferences storage untouched; the CAGED
temporary flag is still never written to storage.

**Testing**: Vitest + fast-check (codec properties, store cascade with fake platform and fake
timers, title matrix), @testing-library/svelte (ShareButton, ShareFallback), Playwright +
@axe-core/playwright (`e2e/share.spec.ts`, `e2e/address-sync.spec.ts`, `e2e/perf.spec.ts`).

**Target Platform**: Last two major evergreen browsers, desktop and mobile; static hosting on
Cloudflare Pages; Web Share API and async Clipboard API are progressive enhancements.

**Project Type**: Static single-page web application (SvelteKit, single project).

**Performance Goals**: Control → fretboard ≤ 100 ms with address sync on; address settles ≤ 150
ms after the last change; ≤ 1 `replaceState` per 150 ms (≤ 67 per 10 s, under Safari's 100/10 s).

**Constraints**: Initial JS ≤ 120 KB gzip (estimate +2.0–3.0 KB, R-12); link < 1,000 chars
(worst case ≈ 170); no network request on share (FR-018); prerender must not read
`url.searchParams`; CSP unchanged (no new origins).

**Scale/Scope**: 3 tools × (7–10 view fields) + 3 instrument fields; 1 wire format version; 12
new message keys × 3 languages; ~6 new source files, 3 edited components/stores, ~8 new test
files.

Every open unknown is resolved in [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research and post-design results are identical; post-design notes are folded into each line.

- [x] **I. Musical Correctness** — No theory code changes; the codec stores pitch classes,
  spelling overrides and tuning pitches verbatim and reuses existing `revalidate`/`tuningFromOffsets`;
  titles spell roots via existing `effectiveRootSpelling` + `src/lib/notation`. No new theory
  suites required; existing suites stay green.
- [x] **II. On-Device, Static, Private** — Link built locally, no network request (FR-018, unit
  test spies `fetch`); no identifiers/timestamps (link-format §6 key-set test); Share/Clipboard
  APIs are user-gesture capabilities, not device permissions — `clipboard-read` is never
  requested; no storage writes.
- [x] **III. Pure Core, Thin Shell** — Codec in pure `src/lib/link` with a new ESLint boundary;
  state flows control → view state → (snapshot → link) without tools encoding anything; view state
  already lives outside components and is read via stores; `src/lib/theory` untouched.
- [x] **IV. Test-First** — Codec (named "link codec" in IV) is written test-first: fixtures and
  fast-check round-trip/never-throw properties before `encode.ts`/`decode.ts`; every acceptance
  scenario maps to a Vitest or Playwright case (quickstart tables); timers injected, no real-time
  waits.
- [x] **V. Accessible (WCAG 2.2 AA)** — Share is a native button ≥ 44×44 with translated name;
  notice is polite `role=status`; fallback has a programmatic label, focus moves in and back
  out, Escape closes, no trap; axe checks with notice and fallback open in three languages.
- [x] **VI. Performance Budgets** — No dependency; +2–3 KB gzip estimate under 120 KB, measured
  after the codec lands and at slice end; encode is O(fields) per change, writes debounced;
  `e2e/perf.spec.ts` gains the SC-007 200-change case.
- [x] **VII. Design System Fidelity** — Share sits in the app bar (main control, not in a menu);
  notice and fallback are non-blocking, dismissible, ≤ 2 lines, between header and main, never
  covering the fretboard; existing notice tokens, no error red, no modal; 320–2560 px with
  `min-inline-size: 0` on the field.
- [x] **VIII. International** — 12 new keys in en/es/pt-BR; note names only via
  `src/lib/notation`; titles are whole-sentence templates per language; link content cannot depend
  on locale because `src/lib/link` cannot import paraglide or notation.
- [x] **IX. Untrusted Input, Versioned Formats** — `v=1` in every link; Valibot schemas with
  per-field fallback; `decodeLink` total and never throws (fast-check); append-only v1 fixtures
  with a manifest guard; input never rendered as HTML (fallback uses an `<input value>`).
- [x] **X. Simplicity, Incremental Delivery** — Slice follows wave 006 order (001 before 002);
  no hook registry or generic "serializer" abstraction — one codec, one seam (`openToolAddress`);
  no new runtime dependency; failure path always ends in a visible field (never silent).
- [x] **Stack & layout** — Uses mandated `src/lib/link`, Valibot, runes stores in `src/lib/state`,
  Paraglide, plain CSS tokens; no ADR-level stack change. One new ADR records the link format and
  address-sync decision (`docs/adr/0021-share-link-format-and-address-sync.md`).
- [x] **Workflow gates** — Conventional Commits; local verification per tiers (targeted Vitest,
  `test:e2e:fast` on touched specs, `pnpm verify` once); full matrix left to CI.

Result: **PASS**, no violations; Complexity Tracking lists none.

## Project Structure

### Documentation (this feature)

```text
specs/022-share-a-view/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-12
├── data-model.md        # Phase 1: ShareSnapshot, DecodeResult, SharePlatform, ShareUiState, AddressSync
├── quickstart.md        # Phase 1: validation run guide
├── contracts/
│   ├── link-format.md   # Wire format v1 (external interface)
│   ├── link-api.md      # src/lib/link, share store, address sync TS API
│   └── share-ui.md      # Components, messages, title rules, a11y
├── checklists/          # From /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/link/                       # NEW pure codec (ESLint boundary)
├── types.ts                        # ShareSnapshot, LinkInstrument, DecodeResult, musicalOf
├── format.ts                       # frozen v1 keys, order, token maps, none/bool helpers
├── encode.ts                       # encodeLink, linkPath, LINK_VERSION
├── schema.ts                       # Valibot field schemas with per-field fallback
└── decode.ts                       # decodeLink (total)

src/lib/state/
├── share.svelte.ts                 # NEW share cascade store, currentSnapshot/currentLink, test seams
├── address.ts                      # NEW debounce core (injected timers/writer)
├── address.svelte.ts               # NEW SvelteKit binding (replaceState, popstate, cancel)
├── triads-view.ts                  # EDIT doc comments ("not in share links" → in links)
├── caged-view.ts                   # EDIT doc comments ("Never serialized" → in links)
└── caged.svelte.ts                 # EDIT temporary comment (FR-009 supersedes 015)

src/lib/shell/
├── ShareButton.svelte              # NEW
├── ShareFallback.svelte            # NEW
├── share-title.ts                  # NEW localized title builder
└── ToolLayout.svelte               # EDIT: button, notice/fallback slot, $effect → scheduleAddress, onMount → openToolAddress

src/routes/+layout.svelte           # EDIT: beforeNavigate pathname change → cancelAddress()
messages/{en,es,pt-BR}.json         # EDIT: 12 share_* keys
eslint.config.js                    # EDIT: src/lib/link/** boundary block
docs/adr/0021-share-link-format-and-address-sync.md   # NEW

tests/unit/link/                    # NEW
├── fixtures/v1/*.ts + MANIFEST     # append-only compatibility fixtures
├── fixtures.test.ts
├── encode.test.ts                  # canonical order, key set, exclusions, length
├── decode.test.ts                  # per-field fallback, versions, never-throws
└── roundtrip.property.test.ts      # fast-check per tool
tests/unit/state/share-store.test.ts      # NEW
tests/unit/state/address-sync.test.ts     # NEW
tests/unit/share-title.test.ts            # NEW
tests/unit/share-button.test.ts           # NEW
tests/unit/share-fallback.test.ts         # NEW
tests/unit/tool-layout.test.ts            # EDIT: Share present on each tool

e2e/share.spec.ts                   # NEW
e2e/address-sync.spec.ts            # NEW
e2e/perf.spec.ts                    # EDIT: SC-007 case
```

**Structure Decision**: Single SvelteKit project, using the constitution's mandated layout. The
existing directories `src/lib/state`, `src/lib/shell`, `src/routes`, `messages/`, `tests/unit`,
`e2e/` and `docs/adr/` are extended; `src/lib/link/` and `tests/unit/link/` are the only new
directories (`src/lib/link` is already reserved by the constitution's source layout). No backend,
no new package.

## Phase 0 / Phase 1 outputs

| Artifact | Status |
|---|---|
| [research.md](./research.md) | Complete — 12 decisions, no open unknowns |
| [data-model.md](./data-model.md) | Complete |
| [contracts/link-format.md](./contracts/link-format.md) | Complete — external wire format v1 |
| [contracts/link-api.md](./contracts/link-api.md) | Complete — module APIs and guarantees |
| [contracts/share-ui.md](./contracts/share-ui.md) | Complete — UI, messages, titles, a11y |
| [quickstart.md](./quickstart.md) | Complete |

Agent context file: this repository keeps agent guidance in hand-written `CLAUDE.md` (no
spec-kit agent-context markers), so no automated agent-file update applies; nothing in this plan
contradicts it.

## Risks

| Risk | Mitigation |
|---|---|
| SvelteKit `replaceState` before router init throws | Only called from `onMount`/effects after mount; wrapped (A3) |
| Instrument panel `history.back()` restores a stale URL | `popstate` listener re-schedules the current link (R-08); e2e "Panel" case |
| Pending debounce writes old tool state after navigation | `cancelAddress()` in `beforeNavigate` + pathname guard (A2) |
| Playwright cannot emulate `(pointer: coarse)` on desktop project | `addInitScript` overrides `matchMedia` for that query; phone-touch project covers real coarse in CI |
| Clipboard permission differs across engines | Desktop Chrome grants `clipboard-write` via context permissions; Firefox/WebKit smoke only checks the fallback/notice path appears |
| Bundle crosses 120 KB | Measure after codec; codec avoids Valibot features not already bundled (`object`, `picklist`, `fallback`, `pipe`, `regex` only) |

## Complexity Tracking

No Constitution Check violations; nothing to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |
