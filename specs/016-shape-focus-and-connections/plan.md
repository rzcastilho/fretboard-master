# Implementation Plan: Shape Focus and Connections

**Branch**: `feature/016-shape-focus-and-connections` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-shape-focus-and-connections/spec.md`

## Summary

CAGED stops being a static picture of five shapes and becomes a way to travel the neck
(FR-6.5–6.7, FR-3.19, UJ-4).

- **Focus**: a player puts one shape **occurrence** in focus three ways: its tag (now a
  toggle button), the new zone-B selector (C A G E D **See all**), or **Previous/Next shape**
  in zone E. The focused occurrence is `highlighted`, every other marker is `dimmed`, a lit
  band covers its chord fret span, and the neck centres it. This takes up to 500 ms, or is
  instant under reduced motion.
- **Show connections**: a zone-D switch that rings every chord position shared by two
  adjacent drawn occurrences. Connections are computed, never tabled. Each step also rings the
  departing and arriving pair's shared positions for a 500 ms window, even with the switch
  off.
- **Rotate notice**: a one-time notice on a portrait phone suggests rotating the device.

Technical approach ([research.md](./research.md)):

- **Theory** (R-01): `cagedConnections` and `sharedPositions` in `src/lib/theory/caged.ts`
  intersect adjacent sorted occurrences and exclude synthesized altered-string notes. The
  Principle I table tests reproduce TM-6.3 and TM-7.2 exactly, and property tests cover random
  keys, frets and compatible tunings.
- **Focus logic** (R-02, R-03): a new pure `src/lib/state/caged-focus.ts` handles
  letter + ordinal focus, the tag toggle, the letter pick, the step with no wrap, step
  availability and re-resolution after key, quality or instrument changes. The CAGED store
  owns re-resolution and reports an occurrence change from `applyInstrument`, so the existing
  `instrument_adjusted` notice appears in CAGED.
- **Display** (R-04, R-09): `buildCagedModel` maps focus, connections and step transition
  onto the four emphasis levels, a new optional `Marker.ring`, `region` (with a new `align:
  'center'`), pressed interactive tags, and description sentences. These are announced through
  the Fretboard's existing polite live region.
- **Renderer** (R-04, R-05): a ring circle inside the marker group, plus a pure
  `centerScrollTarget`, and a new `--duration-medium: 500ms` token (`0s` under reduced motion)
  for centering and dimming. Other tools are untouched, because both fields are optional.
- **Step window** (R-06): a store-side `setTimeout(STEP_WINDOW_MS = 500)`, asserted equal to
  the token. It restarts on each press and is tested with fake timers and `page.clock`.
- **Controls** (R-07, R-08): `ChoiceGroup` gains per-option `aria-disabled`. Zone D gets a
  `role="switch"` button, and a new zone-E section holds the step buttons, which are always
  rendered with `aria-disabled`, plus the notices.
- **Rotate notice** (R-10): a pure `rotate-hint.ts` rule (width ≤ 599 and height > width).
  The v1 preferences record gains an optional `rotateHint: true`, with no version bump.
  `erase()` clears it, and a per-load flag covers unavailable storage.

Assumptions and defaults beyond the spec (each detailed in research.md):

- **Band span**: the band spans the occurrence's chord frets `start..end`, per the normative
  Clarification and FR-002. US1-1's "frets 7–10" is the TM-6.4 scale region, so it is treated
  as an erratum and the C-major E band is frets 8–10. *Rejected*: widening to the scale region,
  which would contradict FR-002 and the tag-centring rule.
- **Minimap**: no minimap exists yet (FR-3.13 is unbuilt), so "the minimap window follows" is
  N/A in this slice. *Rejected*: building a minimap here, which is out of scope and would cost
  bundle.
- **Translations**: new strings go only into `messages/en.json`, the only catalog today
  (Principle VIII allows English-only shipping). The pt and es catalogs come with the
  localization slice. *Rejected*: creating pt and es catalogs in this slice.
- **Playback**: focus, connections and step changes do not stop playback, because they are
  not musical (R-11). *Rejected*: routing them through `apply()`, which would cut off a
  sounding note on every tag tap.
- **Announcements**: there is no second live region. The focus sentence leads the existing
  description (R-09). *Rejected*: a separate status line, which would double-announce.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node via mise (`mise.toml`)

**Primary Dependencies**: Svelte 5 (runes) + SvelteKit `adapter-static`, Paraglide JS,
Valibot, all existing. **No new dependency.**

**Storage**: `localStorage` `fretboard-master:prefs` v1 record gains one optional boolean
`rotateHint` (written only when `true`, version unchanged). Focus and the connections toggle
are in-memory CAGED view state only: never stored, never in the URL.

**Testing**:

- **Vitest + fast-check**:
  - theory tables and properties;
  - pure focus and rotate rules;
  - the view, model and store, with fake timers for the 500 ms window;
  - instrument orchestration, the renderer (ring, centre target), `ChoiceGroup`, the CAGED
    tool component, and the prefs schema and store.
- **Playwright + @axe-core/playwright**:
  - new `e2e/caged-focus.spec.ts` (US1–US4, keyboard, reduced motion, persistence, axe), using
    `page.clock`;
  - a new TM-9 view 18 screenshot in `e2e/caged-tm9.spec.ts`.

**Target Platform**: evergreen browsers (last two majors), desktop and mobile, served
statically from Cloudflare Pages.

**Project Type**: static single-page web application (SvelteKit, prerendered, single bundle
per ADR 0002).

**Performance Goals**:

- Control change to fretboard update ≤ 100 ms.
- Focus dim and scroll complete ≤ 500 ms (instant under reduced motion).
- Instrument change ≤ 300 ms.
- Smooth scrolling with 7 strings and 24 frets.

**Constraints**:

- **Bundle**: initial JS ≤ 92 KB gzip. About 1.8 KB of headroom is left after slice 015, and
  this slice is estimated at +1.2–1.7 KB (R-12).
- **Layout**: no layout shift on focus changes, because the step buttons are always rendered
  (SC-006).
- **Accessibility**: 44×44 px targets and zero axe violations.
- **Motion and visuals**: durations come only from tokens, and emphasis uses only the four
  levels.

**Scale/Scope**:

- **Instruments**: one tool (CAGED), 12 keys × 2 qualities, 12–24 frets, 6 or 7 strings, every
  compatible or altered-string tuning.
- **Occurrences**: at most 9 drawn occurrences, so connection computation is trivial (≤ 8
  pairs × 6 notes).
- **Files**: about 9 new message keys, 3 new source modules (`caged-focus.ts`,
  `rotate-hint.ts`, `CagedFocusControls.svelte`) and about 10 edited ones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.6.0. Pre-research and post-design results are identical. The design
introduced no new violation.

- [x] **I. Musical Correctness**: connections are computed from the occurrences of the
  configured tuning, strings and frets (`cagedConnections`), never tabled. The new TM-6.3 and
  TM-7.2 table tests and the connection properties join the existing CAGED gate (R-01, R-14).
- [x] **II. On-Device, Static, Private**: everything runs in the browser. The only stored datum
  is a boolean in the existing erasable local preferences record. No network, permissions or
  identifiers are involved.
- [x] **III. Pure Core, Thin Shell**: theory additions import only `./pitch` and `./triad`.
  Focus and rotate rules are pure modules in `src/lib/state`. Data flows control → view state
  → display model → renderer. Mirroring stays in the renderer (`centerScrollTarget` uses the
  layout's columns). Tags report ids, not coordinates. View state lives in the module store.
- [x] **IV. Test-First / Tested Behavior**: the focus, connections, rotate and prefs modules
  are built test-first. Every acceptance scenario maps to Vitest or Playwright (quickstart §2).
  The 500 ms window is driven by fake timers or `page.clock`, never real time. TM-9 view 18 is
  added as a screenshot fixture.
- [x] **V. Accessible by Default**:
  - Tags, selector, switch and step buttons are keyboard-operable, with `aria-pressed`,
    `aria-checked` and `aria-disabled` as appropriate.
  - Targets are at least 44 px, and the existing `.tag` already uses `--target-min`.
  - Focus is conveyed by opacity plus size plus band plus pressed state, and connections by
    the ring shape, never by color alone.
  - Changes are announced politely through the existing description region.
  - Reduced motion is honored through the token.
  - axe is gated in e2e.
- [x] **VI. Performance Budgets**:
  - No dependency is added, and the computation is O(occurrences).
  - The centering reuses the existing rAF animation.
  - The bundle is measured after US1 and at the end of the slice. A breach triggers an
    amendment rather than a silent pass (R-12, Complexity Tracking).
- [x] **VII. Design System Fidelity**:
  - State is expressed only through `highlighted`, `normal` and `dimmed`. The ring is the
    design §2 "additional ring around the marker" and uses the text color, not a reserved
    function color.
  - New durations and ring values are tokens.
  - Controls sit in zones B, D and E and never cover the board.
  - Notices are non-blocking, dismissible, two lines at most, and never error red.
  - The tool still opens in its simplest state: no focus and connections off.
- [x] **VIII. International**:
  - Every new string is a `messages/en.json` key.
  - Shape letters stay literal parameters (014).
  - No note names are formatted outside `src/lib/notation`.
  - The layout uses wrapping flex rows for pt and es length and 200% zoom.
- [x] **IX. Untrusted Input, Versioned Formats**:
  - `rotateHint` is parsed with `v.fallback(v.boolean(), false)`. An invalid value never
    affects other fields, and the record keeps `version: 1`.
  - Existing prefs fixtures stay byte-identical because the key is omitted when `false`.
  - No share-link format changes in this slice. Letter + ordinal is chosen so area 10 can
    encode it later.
- [x] **X. Simplicity and Incremental Delivery**:
  - The slice follows the wave order (004-caged/003 after 001 and 002).
  - It reuses `ChoiceGroup`, `Notice`, the region band and `animateScroll`. The one new
    renderer option (`region.align`) extends an existing feature, so it is not a speculative
    abstraction.
  - Fallbacks: undrawn letters are disabled, and a non-compatible tuning clears focus. An
    instrument change that alters focus shows "We adjusted the view…".
- [x] **Technology Stack**: Svelte 5 runes store, Valibot, Paraglide, plain CSS tokens and
  inline SVG are all mandated choices. No stack change and no ADR are needed.
- [x] **Workflow gates**: local verification follows the tiers (targeted Vitest,
  `test:e2e:fast` on the touched specs, filtered `--update-snapshots`, and one `pnpm verify`).
  The full matrix is left to CI.

## Project Structure

### Documentation (this feature)

```text
specs/016-shape-focus-and-connections/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01…R-14
├── data-model.md        # Phase 1: entities, view state, display model, prefs field
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── caged-focus-api.md   # Module API contracts (theory, focus, view, model, store, renderer, prefs)
│   └── caged-focus-ui.md    # Observable UI / a11y / persistence contract
├── checklists/          # From /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/caged.ts                  # + CagedConnection, sharedPositions, cagedConnections
├── state/
│   ├── caged-focus.ts               # NEW pure: focus resolution, steps, re-resolve, STEP_WINDOW_MS
│   ├── rotate-hint.ts               # NEW pure: isPhonePortrait, shouldShowRotateHint
│   ├── caged-view.ts                # + focus, connections, setFocus, setConnections
│   ├── caged-model.ts               # + cagedOccurrencesFor, emphasis/ring/region/tags/description
│   ├── caged.svelte.ts              # + chooseShape, toggleTag, step, setConnections, transition timer, re-resolve
│   ├── instrument.svelte.ts         # adjustedIn may be 'caged'
│   └── preferences.svelte.ts        # + rotateHintShown, markRotateHintShown, erase clears
├── prefs/schema.ts                  # + rotateHintShown ⇄ "rotateHint"
├── fretboard/
│   ├── types.ts                     # + Marker.ring, region.align
│   ├── interaction.ts               # + centerScrollTarget
│   └── Fretboard.svelte             # ring circle, centred band scroll, medium-duration emphasis
├── tools/
│   ├── ChoiceGroup.svelte           # + per-option disabled (aria-disabled, arrow skip)
│   └── caged/
│       ├── CagedFocusControls.svelte  # NEW zone-B shape selector
│       └── CagedTool.svelte         # tags ontag, zone D switch, zone E steps + notices, rotate hint
└── styles/tokens.css                # + --duration-medium, --connection-ring(-width/-gap)
messages/en.json                     # + caged_group_shape … caged_rotate_hint

tests/unit/
├── theory/caged.test.ts, caged.property.test.ts
├── state/caged-focus.test.ts (new), rotate-hint.test.ts (new), caged-view.test.ts,
│   caged-model.test.ts, caged-store.test.ts, instrument-store.test.ts, preferences-store.test.ts
├── prefs/schema.test.ts
├── fretboard/interaction.test.ts, fretboard.test.ts
├── triads/choice-group.test.ts
└── caged/caged-tool.test.ts

e2e/
├── caged-focus.spec.ts              # NEW: US1–US4, keyboard, reduced motion, persistence, axe
└── caged-tm9.spec.ts                # + TM-9 view 18 (F♯ minor, connections on) snapshots
```

**Structure Decision**: this is the existing single SvelteKit project. Every directory above
already exists (`src/lib/{theory,state,prefs,fretboard,tools/caged,styles}`, `messages/`,
`tests/unit/{theory,state,prefs,fretboard,triads,caged}`, `e2e/`). The slice adds three files
(`caged-focus.ts`, `rotate-hint.ts`, `CagedFocusControls.svelte`) and two test files plus one
e2e spec. It creates no new directory, and the layering is the constitution's source layout.

## Implementation Order (for /speckit.tasks)

1. **Foundation**:
   - tokens (`--duration-medium`, ring tokens);
   - `cagedConnections` and `sharedPositions`, with the TM-6.3/7.2 tables and properties
     written first;
   - `caged-focus.ts`, with tests first;
   - `caged-view` fields.
2. **US1 (P1)**:
   - the model's emphasis, region, pressed tags and description;
   - the renderer's `centerScrollTarget` and medium-duration emphasis;
   - the store's `chooseShape` and `toggleTag`;
   - `ChoiceGroup` disabled options and `CagedFocusControls`;
   - tags made interactive in CagedTool;
   - re-resolve on key, quality and instrument, and `adjustedIn: 'caged'`;
   - e2e US1.
   - **Then measure the bundle.**
3. **US2 (P1)**: the store's `step` and transition timer, the zone-E buttons, and the ring
   drawing for the transition; then e2e US2 with `page.clock`.
4. **US3 (P2)**: the zone-D switch and connection rings; then e2e US3 and the TM-9 view 18
   screenshot.
5. **US4 (P3)**: the prefs field, the store API, `rotate-hint.ts`, and the CagedTool notice;
   then e2e US4.
6. **Polish**: axe and keyboard pass, then `pnpm verify` and the bundle check.

## Complexity Tracking

No constitution violation requires justification. The decisions below are recorded so
reviewers can approve them explicitly.

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|-------------------------------------|
| Spec erratum: band frets for C-major E shape | US1-1 says "frets 7–10", but FR-002 and the Clarification define the band as the chord fret span (8–10). The plan implements 8–10 | Implementing 7–10 (TM-6.4 scale region) would contradict the normative FR and the tag-centring rule, and needs scale data this slice doesn't have |
| Watched risk: bundle headroom about 1.8 KB vs. +1.2–1.7 KB estimate | The slice adds UI, renderer and theory code to the single bundle (ADR 0002) | Silently trimming required behavior would break the spec. If the `check-bundle-size` cap is crossed, the slice raises a MINOR amendment with a Sync Impact Report (precedent: 1.3.0, 1.4.0, 1.6.0) for explicit reviewer approval |
| `STEP_WINDOW_MS` constant in state alongside the `--duration-medium` token | The step window is a behavioral timer in the store, which cannot read computed CSS (Principle III keeps the DOM out of state) | Reading the token in state would couple the store to the DOM. A unit test asserts the constant equals the token, so the token remains the single visual source |
| Minimap "window follows" N/A | No minimap exists yet (FR-3.13 unbuilt) | Building it here is out of slice scope (Principle X). The future minimap reads the same scroll position, so it follows for free |
