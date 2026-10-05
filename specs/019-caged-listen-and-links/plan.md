# Implementation Plan: CAGED Listen and Links to Other Tools

**Branch**: `019-caged-listen-and-links` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-caged-listen-and-links/spec.md`

## Summary

CAGED gains **Listen** with a Slow / Medium / Fast **tempo** (FR-6.17, FR-7.1–7.11), and the three
tools link: Notes ↔ CAGED, Triads ↔ CAGED carry key and chord on a user tool switch (FR-1.6), the
Notes position card offers **CAGED in this key**, and Triads offers **View in CAGED** with the
Triad layer on (FR-4.7, FR-5.16), disabled with an explanation for diminished and augmented.

Technical approach ([research.md](./research.md)):

- **Audio** (R-01): a fourth `PlaybackRequest` kind, `timeline`, carries explicit per-step onset and
  duration. It is needed for the Chord-only strum (250 ms onsets, notes ringing 1500 ms, block
  500 ms after the last onset, next shape 1500 ms later), which a uniform-beat `sequence` cannot
  express. The engine treats it as a sequence for Stop, `sequencePlaying`, interrupt and pulses.
  Notes and Triads playback stay byte-identical.
- **Planner** (R-02 – R-07): a new pure `state/caged-listen.ts` picks the widest layer
  (`LISTEN_ORDER`: Scale > Pentatonic > Arpeggio > Triad > Chord; no focus → every occurrence's
  chord, nut → body), takes the region as the focused occurrence's **highlighted** resolved
  positions filtered by layer degrees (so sound = what is drawn, string 7 and altered string 6
  included), dedupes unisons to the thicker string, and builds up-and-back steps (top once; scale
  from the lowest root). Triad playback reuses Triads' `[low, mid, high, block]` at `LISTEN_BPM`.
  Pitches come from the effective instrument (temporary standard tuning while active).
- **Tempo** (R-08): `Tempo` in `state/listen.ts` (80/120/180 BPM; Medium = `LISTEN_BPM`), owned by
  the CAGED store and stored as an optional `tempo` prefs field (picklist + fallback, written only
  when not Medium, `PREFS_VERSION` 1, erased with the rest).
- **Stopping** (R-09): a store-private `stopListen()` stops only a playing *sequence* on focus,
  layer, Triad-set and tempo changes (superseding 016 R-11 / 017 R-16 / 018 R-15 for sequences
  only). Key/quality/spelling/carry keep stopping everything, navigation/hidden/instrument stops
  are unchanged, and the label type no longer stops playback.
- **Links** (R-11, R-12): pure carry functions in `links.ts` (`carryFromCaged`,
  `carryTriadsToCaged`, `carryIntoCaged`), the four pairs in `linkTools`, and two one-`goto`
  shortcuts (`openCagedFromNote`, `openCagedFromTriads`). The CAGED store applies a carry through
  `apply(withResolvedFocus(...))`, as if the user picked the key, and `showTriadLayer()` turns on
  Triad with the default set and auto-focus.
- **UI** (R-10, R-12): a new `CagedListen.svelte` (Listen + Tempo radiogroup + polite status),
  a **CAGED in this key** button in `PositionCard`, and a **View in CAGED** button in
  `TriadsSecondary`. Stop is the existing app-bar `StopButton`.

Assumptions and defaults beyond the spec (detailed in research.md, listed in Complexity Tracking):

- **Label type no longer stops playback** (R-09). Today it is routed through `apply()`, which
  stops. The spec says it MUST NOT, so `setLabelType` bypasses the stop. *Rejected*: keeping the
  stop for single notes only, which adds a third rule for no user benefit.
- **Chord-only plays even when the Chord switch is off** (R-03), for example Triad on with no triad
  in the set. *Rejected*: disabling Listen, which contradicts the spec's fallback.
- **Notes → CAGED is a no-op on the same pitch class** (R-11): this keeps the spelling and focus,
  as the Clarification says.
- **View in CAGED in a non-compatible tuning** (R-12): it carries key and quality, but Triad cannot
  turn on (no shapes), so CAGED opens on its existing non-compatible notice. *Rejected*: disabling
  the button in Triads, which would need CAGED's tuning class inside Triads for a rare case that
  is already explained on arrival.
- **Translations** (R-14): keys go into `en.json` only, the only configured locale.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`). Node and pnpm are pinned through mise
(`mise.toml`).

**Primary Dependencies**: Svelte 5 (runes), SvelteKit `adapter-static`, Paraglide JS, Valibot, and
Web Audio through the existing `src/lib/audio` engine (ADR 0007). **No new dependency.**

**Storage**: one new optional field `tempo` in the existing v1 preferences record in
`localStorage` (via `src/lib/prefs`). Carried context and Listen state stay in memory only, and
nothing is added to URLs.

**Testing**:

- **Vitest + fast-check**:
  - Audio `timeline` planning and engine behaviour (fake clock and port).
  - `caged-listen` tables (C/G/A♯ keys, E/A/C shapes, open position, Drop D, 7-string, Half step
    down, temporary view).
  - Properties P-1 to P-6 across keys, qualities, shapes, fret counts 12–24 and generated
    compatible tunings.
  - The store stop matrix, tempo and prefs fixtures (added, never removed).
  - Carry tables: 12 roots × 2 qualities plus dim/aug origins.
  - Components: CAGED tool, position card and Triads secondary row.
- **Playwright + @axe-core/playwright**: a new `e2e/caged-listen.spec.ts` (US1, US2 through
  `__fmAudioLog` and `page.clock`), plus additions to `e2e/linked-tools.spec.ts` (US3, US4) and to
  `e2e/preferences.spec.ts` (tempo persistence and erase).

**Target Platform**: evergreen browsers (the last two majors), desktop and mobile, served
statically from Cloudflare Pages.

**Project Type**: a static single-page web application (SvelteKit, prerendered, a single bundle
per ADR 0002).

**Performance Goals**:

- Listen to first sound ≤ 100 ms after unlock (SC-002, Principle VI). The plan is O(region),
  ≤ ~40 positions.
- Stop takes effect in ≤ 100 ms (SC-003). This is the existing engine ramp of `STOP_RAMP_S`.
- A pulse starts within 50 ms of its sound (SC-004), because pulses and sound share the plan's
  marks.
- A tool switch with carry takes ≤ 300 ms.

**Constraints**:

- **Bundle**: initial JS ≤ 120 KB gzip; this slice is estimated at +2.0–3.0 KB (R-13).
- **Audio**: starts only from a gesture. `state/` imports `audio/` only in `playback.svelte.ts`.
- **Visual states**: only the four emphasis levels; the pulse uses the existing highlighted state.
- **Accessibility**: 44×44 px targets and zero axe violations.

**Scale/Scope**:

- **Tools touched**: 3 (CAGED, Notes, Triads), plus the audio engine and prefs.
- **Combinations**: 12 keys × 2 qualities × 5 shapes × 5 listen sources × 3 tempos.
- **Files**: 2 new source files (`state/caged-listen.ts`, `tools/caged/CagedListen.svelte`), about
  16 edited files and 12 new message keys.
- **Tests**: 1 new unit test file and 1 new e2e spec, plus additions to existing ones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This check is against constitution v1.8.0. The pre-research and post-design results are the same,
and the design introduces no principle violation. Spec-interpretation defaults are listed in
Complexity Tracking for explicit reviewer approval.

- [x] **I. Musical Correctness**:
  - Every pitch played is the effective instrument's open pitch plus the fret (P-6), and the
    region is exactly the drawn highlighted positions (P-2). So sound equals the shapes already
    gated by the TM-6 and TM-7 tables and the slice 017 and 018 properties.
  - Triad playback reuses the gated `shapeTriad`.
  - The order and unison rules are table- and property-tested (P-1, P-3, P-4, P-5) across
    generated tunings. No new spelling code is added: carried spellings go through the existing
    `effectiveRootSpelling` and `switchTo`.
- [x] **II. On-Device, Static, Private**: synthesis stays in the browser. The only new storage is
  the `tempo` field in `localStorage`, which the user can erase. There is no network, permission
  or identifier.
- [x] **III. Pure Core, Thin Shell**:
  - The planner `state/caged-listen.ts` and the carry functions in `links.ts` are pure.
  - The stores orchestrate. Components only render `display.listen`, `viewInCaged` and the status.
  - `src/lib/theory` is untouched.
  - Carry and the shortcuts run in activation handlers (ADR 0011).
  - View state stays outside components.
- [x] **IV. Test-First / Tested Behavior**:
  - The planner, the `timeline` scheduler, the prefs codec and the carry functions are written
    test-first.
  - Timing is tested through the engine's injectable clock and `page.clock`, never real time.
  - Every US1–US4 scenario maps to Vitest or Playwright (quickstart §4).
  - No TM-9 sample view depends on sound, so no screenshot is added. Any screenshot touched is
    regenerated only with `-g`.
- [x] **V. Accessible by Default**:
  - Listen, Tempo (radiogroup), Stop, CAGED in this key and View in CAGED are keyboard-operable,
    with visible labels.
  - Disabled states use `aria-disabled`, stay focusable and are described by a visible reason.
  - Playback state is announced through a polite `role="status"`.
  - Pulses use emphasis and size, not colour. Sound is never the only carrier: positions pulse
    even when muted.
  - Axe runs on every new state at phone and desktop widths in both themes.
- [x] **VI. Performance Budgets**:
  - No dependency is added. The estimate is +2–3 KB against the 120 KB cap, checked once by
    `pnpm verify`.
  - The tap-to-sound path is the existing engine path. The plan is computed only on the gesture,
    in O(region).
- [x] **VII. Design System Fidelity**:
  - Controls sit beside the fretboard and never cover it. CAGED still opens in its simplest state
    (tempo Medium, Chord only), and Listen and Tempo are not behind a menu.
  - All styling uses tokens. The new `--disabled-opacity` is a token in `tokens.css`.
  - No reserved root, third or fifth colour is reused, and no new emphasis level is added.
  - No modal is used.
- [x] **VIII. International**:
  - All 12 new strings are catalog keys, guarded by `no-raw-text.test.ts`.
  - Shape letters and note names come from `notation`, with accidentals as ♯ ♭ 𝄪 𝄫.
  - Button rows wrap for longer languages and at 200 % zoom.
- [x] **IX. Untrusted Input, Versioned Formats**:
  - `tempo` is parsed with a Valibot picklist plus fallback. Other fields are unaffected, and the
    parser never throws.
  - `PREFS_VERSION` 1 is kept. Existing fixtures stay byte-identical, and two new fixtures are
    added.
  - No share-link change, and no input-derived HTML.
- [x] **X. Simplicity and Incremental Delivery**:
  - The slice follows wave order (004-caged/006 after 005).
  - It reuses the engine, `StopButton`, `ChoiceGroup`, `carryTriad`, `carrySelection`,
    `withResolvedFocus`, `toggleLayer('triad')` and `defaultTriadSet`.
  - The one new abstraction, the `timeline` request kind, has two real uses: the focused chord
    strum and the all-shapes sequence.
  - Fallbacks: a disabled Listen gives its reason, and a disabled View in CAGED gives its note.
- [x] **Technology Stack**:
  - Web Audio, Svelte runes, Valibot, Paraglide and CSS tokens are all mandated choices, so the
    stack is unchanged.
  - **ADR**: none new. ADR 0007 gets a one-paragraph addendum on the `timeline` kind (R-15), and
    ADR 0011 covers carry.
- [x] **Workflow gates**:
  - Local runs follow the verification tiers: targeted Vitest, `test:e2e:fast` on
    `caged-listen`, `linked-tools` and `preferences` specs, then one `pnpm verify`. The full
    matrix and LHCI run in CI only.
  - Commits use Conventional Commits on `019-caged-listen-and-links`.

## Project Structure

### Documentation (this feature)

```text
specs/019-caged-listen-and-links/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01…R-16
├── data-model.md        # Phase 1: timeline request, tempo, planner, prefs field, carry, store
├── quickstart.md        # Phase 1: validation guide and acceptance → test map
├── contracts/
│   ├── caged-listen-api.md   # Module API (audio, playback, planner, store, prefs, links)
│   └── caged-listen-ui.md    # Observable UI, a11y, audio log, persistence
├── checklists/          # From /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── audio/
│   ├── types.ts                     # TimedStep; PlaybackRequest 'timeline'; log kind 'timeline'
│   ├── schedule.ts                  # planRequest handles 'timeline'; MAX_TIMELINE_MS
│   └── engine.ts                    # sequence flag true for 'timeline'
├── state/
│   ├── listen.ts                    # Tempo, TEMPOS, TEMPO_BPM, strum constants, RING_MS, isTempo
│   ├── caged-listen.ts              # NEW pure planner: listenSource, listenRegion, melodicSteps,
│   │                                #   chordPositions, strumEvents, buildCagedListen
│   ├── playback.svelte.ts           # timeline()
│   ├── caged-model.ts               # display.listen
│   ├── caged.svelte.ts              # tempo, setTempo/restoreTempo, listen, listening, carry,
│   │                                #   showTriadLayer, stopListen; setLabelType no stop
│   ├── triads-model.ts              # display.viewInCaged
│   ├── links.ts                     # CagedCarry, carryFromCaged, carryTriadsToCaged, carryIntoCaged
│   ├── links.svelte.ts              # linkTools CAGED pairs, openCagedFromNote, openCagedFromTriads
│   └── preferences.svelte.ts        # restoreTempo on start/erase
├── prefs/schema.ts                  # tempo field (parse + serialize)
├── tools/
│   ├── caged/CagedListen.svelte     # NEW Listen + Tempo + status
│   ├── caged/CagedTool.svelte       # mounts CagedListen
│   ├── notes/PositionCard.svelte    # "CAGED in this key"
│   ├── notes/NotesTool.svelte       # oncaged wiring
│   ├── triads/TriadsSecondary.svelte# "View in CAGED" + disabled note
│   └── triads/TriadsTool.svelte     # wiring
└── styles/tokens.css                # --disabled-opacity
messages/en.json                     # 12 keys (R-14)
docs/adr/0007-main-thread-karplus-strong-playback.md   # addendum: timeline kind

tests/unit/
├── audio/schedule.test.ts, engine.test.ts
├── state/caged-listen.test.ts (new), caged-store.test.ts, caged-model.test.ts, links.test.ts,
│   links-store.test.ts, playback.test.ts, preferences-store.test.ts, triads-model.test.ts
├── prefs/schema.test.ts, prefs/fixtures/{tempo-fast,bad-tempo}.txt (new), fixtures/index.ts
├── caged/caged-tool.test.ts
├── notes/ (position card), triads/ (secondary row)
└── no-raw-text.test.ts

e2e/
├── caged-listen.spec.ts             # NEW: US1, US2, keyboard, axe
├── linked-tools.spec.ts             # + US3 carries, US4 shortcuts
└── preferences.spec.ts              # + tempo persistence / erase
```

**Structure Decision**: this is the existing single SvelteKit project. Every directory above
already exists in the repository: `src/lib/{audio,state,prefs,tools/caged,tools/notes,tools/triads,styles}`,
`messages/`, `docs/adr/`, `tests/unit/{audio,state,prefs,prefs/fixtures,caged,notes,triads}` and
`e2e/`. The slice adds two source files, one unit test file, two fixtures and one e2e spec. It
creates no directory.

## Implementation Order (for /speckit.tasks)

1. **Foundation** (blocks every story):
   - `listen.ts` constants and `Tempo`.
   - The audio `timeline` kind: schedule tests first, then the engine flag and `playback.timeline`.
   - The `caged-listen.ts` planner: tables and P-1 to P-6 first.
   - `display.listen`.
2. **US1 (P1) Hear the focused shape**:
   - `caged.listen()` and `listening`.
   - `CagedListen.svelte` (Listen button, disabled reason, status) and the message keys.
   - e2e US1, through the audio log and pulses, including muted.
3. **US2 (P1) Control playback**:
   - The tempo prefs field (fixtures first), `setTempo` and `restoreTempo`, and the Tempo
     radiogroup.
   - `stopListen()` wiring and the `setLabelType` change, with the store stop matrix tested first.
   - e2e US2: Stop, the matrix, tempo deltas, persistence, interrupt and hidden.
4. **US3 (P2) Carry**:
   - The pure carry functions (tables first), `caged.carry` and the `linkTools` pairs.
   - e2e nav carries, including A♯ major guidance.
5. **US4 (P2) Shortcuts**:
   - `showTriadLayer`, `openCagedFromNote`, `openCagedFromTriads` and `display.viewInCaged`.
   - The position card button, and View in CAGED with its disabled note and token.
   - e2e shortcuts and axe on the disabled state.
6. **Polish**:
   - The ADR 0007 addendum.
   - A keyboard and axe pass at phone and desktop widths in both themes.
   - The no-raw-text check.
   - One `pnpm verify` with the bundle check.

## Complexity Tracking

There is no constitution violation in the design. The spec-interpretation defaults and one
behaviour change to an earlier slice are listed so that reviewers can approve them explicitly.

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| New `timeline` playback request kind (R-01) | The Chord-only strum needs irregular onsets with notes ringing past the next onset, and no-focus playback needs 1500 ms shape gaps. `sequence` gives every step one beat of onset and duration | *Chain `chord` requests with timers*: each request interrupts the last, which cuts the ringing notes, and timers outside the engine escape `stop()` and the injectable clock. *Change `sequence` semantics*: alters Notes and Triads playback |
| Superseding 016 R-11, 017 R-16 and 018 R-15 for sequences: focus, layer and Triad-set changes now stop a playing Listen sequence (R-09) | EC-7.4 and FR-7.9 require it, and the spec Clarification states that it takes precedence | *Stop every playback on those changes*: breaks the kept rule that tapped single notes survive focus and layer changes |
| Default: label type no longer stops playback (R-09) | FR-010 says label type changes MUST NOT stop playback. Today `setLabelType` goes through `apply()`, which stops | *Keep stopping single notes on label change*: inconsistent with the spec's rule and adds a special case |
| Default: Chord-only plays even when the Chord switch is off (R-03) | It is the spec's final fallback (Triad on and no triad in the set). The chord markers define the shape | *Disable Listen in that state*: contradicts the edge case "Listen plays the Chord-only strum and block" |
| Default: View in CAGED stays enabled for major and minor in a tuning CAGED cannot draw (R-12) | The disabled state is specified only for dim and aug. CAGED's existing non-compatible notice explains the result on arrival | *Disable the button by CAGED's tuning class*: couples Triads to CAGED tuning logic for a rare case with no spec requirement |
| Deviation: new strings go into `en.json` only, although "every supported language" is required (R-14) | `en` is the only configured locale. Principle VIII allows English-only shipping with catalog keys, and 016–018 set the precedent | *Add pt and es now*: out of scope (localization slice), and would duplicate untranslated strings |
