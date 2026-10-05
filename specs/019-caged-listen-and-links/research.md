# Research: CAGED Listen and Links to Other Tools

**Feature**: 019-caged-listen-and-links | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

Phase 0 output. Every spec Clarification is taken as settled; this file records the technical
decisions the plan needs, grounded in the code as of commit `e6df4b3` (slice 018 merged). No
`NEEDS CLARIFICATION` remains.

Code surveyed: `src/lib/audio/{types,schedule,engine}.ts`, `src/lib/state/{playback.svelte,listen,
caged.svelte,caged-view,caged-model,caged-layers,caged-triad,caged-focus,links,links.svelte,
preferences.svelte,triads-model}.ts`, `src/lib/prefs/{schema,session}.ts`,
`src/lib/theory/{caged,caged-layers,caged-triad}.ts`, `src/lib/fretboard/pulse.ts`,
`src/lib/shell/{StopButton,PlaybackHost,AppNav}.svelte`, `src/routes/+layout.svelte`,
`src/lib/tools/{notes/PositionCard,triads/TriadsSecondary,caged/CagedTool}.svelte`.

---

## R-01 — Playback of irregular timing: a new `timeline` request kind

**Decision**: add a fourth `PlaybackRequest` kind to `src/lib/audio/types.ts`:

```ts
| { readonly kind: 'timeline'; readonly events: readonly TimedStep[] }
// TimedStep = { positions: readonly Position[]; onsetMs: number; durationMs: number }
```

`planRequest` (`audio/schedule.ts`) maps each event to one `PlannedStep` with its own onset and
duration (onset and duration clamped to `0…MAX_TIMELINE_MS = 60_000`, non-finite values drop the
event; same `validUnique` filter as the other kinds). The engine treats `timeline` like
`sequence` for the "sequence playing" flag (`sequence: plan.kind === 'sequence' || plan.kind ===
'timeline'`), so the shared **Stop** button, `playback.sequencePlaying`, the hidden-page stop and
interrupt semantics apply unchanged. `AudioLogEntry.step.kind` gains `'timeline'`.
`playback.svelte.ts` gains `timeline(events, instrument)`.

**Rationale**: the existing `sequence` kind gives every step one beat of onset spacing *and* one
beat of duration (`schedule.ts`: `add(buildStep(…, i * beat, beat))`). The Chord-only strum
(FR-002) needs 250 ms onsets with notes that keep ringing (1500 ms, `NOTE_MS`), a block 500 ms
after the last strum onset, and — with no focus (FR-006) — a next strum 1500 ms after the
previous block. None of that is expressible as a uniform beat. The engine already schedules
per-step `onsetMs`/`durationMs` and per-mark pulses (`schedulePulses`), so the new kind is a
planner change plus one flag, not an engine rewrite.

**Alternatives rejected**:

- *Fake the strum with `sequence` at 240 BPM and a long block*: notes would be cut at the next
  onset (duration = beat), breaking "each note ringing on", and the 500 ms block gap and 1500 ms
  inter-shape gap are not multiples of one beat.
- *Several `chord` requests chained with `setTimeout` in the store*: each new request interrupts
  the previous one (`halt('interrupt')`), so ringing notes would be cut; timers outside the
  engine would escape `stop()` and the injectable clock (Principle IV).
- *A generic per-step `durationMs` on `sequence`*: changes the meaning of an existing kind used by
  Notes and Triads; a separate kind keeps their behaviour byte-identical.

## R-02 — Where the CAGED Listen plan is computed

**Decision**: a new pure module `src/lib/state/caged-listen.ts` (no Svelte, DOM, paraglide or
audio-engine import; imports only `instrument`, `theory/caged`, `theory/caged-layers`,
`theory/caged-triad`, `state/caged-layers`, `state/caged-view` and `state/listen`; the ring length
is `RING_MS = 1500` in `state/listen.ts`, asserted equal to `audio/schedule` `NOTE_MS` by a test, so
`state/` never imports `audio/` outside `playback.svelte.ts`). Exports:

- `listenSource(layers, focused, triad) → ListenSource` (R-03),
- `listenRegion(positions, layer, quality) → readonly RegionNote[]` (R-04),
- `melodicSteps(region, layer) → readonly Position[]` (R-05),
- `strumEvents(chordPositions, startMs) → { events, blockOnsetMs }` (R-06),
- `buildCagedListen(input) → CagedListenPlan` (the single entry point the store calls).

`CagedListenPlan` is either `{ kind: 'sequence', steps, bpm }`, `{ kind: 'timeline', events }`, or
`{ kind: 'none', reason }`; the store hands it to `playback.sequence` / `playback.timeline`.

**Rationale**: Principle III — tools never compute theory or playback order; the store
orchestrates and a pure function decides. Keeping it in `state/` (not `theory/`) is required
because it works on `Position`, `ResolvedPosition` and the display's emphasis, which are not
theory concepts, and because it encodes timing (presentation of sound). It is unit-testable with
no audio context.

**Alternatives rejected**: computing steps in `caged-model.ts` on every render (wasteful: the plan
is needed only on a Listen gesture, and the model is already 461 lines); computing in
`CagedTool.svelte` (violates III).

## R-03 — Which layer plays (FR-001, FR-006)

**Decision**: `listenSource` returns, in order:

1. no focus → `{ kind: 'all-chords' }` (whatever layers are on, FR-006);
2. `layers.scale` → `'scale'`; 3. `layers.pentatonic` → `'pentatonic'`;
4. `layers.arpeggio` → `'arpeggio'`;
5. `layers.triad && triad !== null` → `'triad'`;
6. otherwise → `'chord'`.

**Rationale**: spec Clarification "widest wins: Scale > Pentatonic > Arpeggio > Triad > Chord".
Note this is the *opposite* of the drawing priority `LAYER_PRIORITY` (triad first, used for
claiming markers), so a separate constant `LISTEN_ORDER` is declared rather than reversing
`LAYER_PRIORITY` — the two orders mean different things and must not drift together.
Triad on with no triad in the selected set falls to `'chord'` (spec edge case). Chord-only plays
even when the Chord switch is off (e.g. Triad on, set unavailable): the chord markers are the
shape's identity and the spec names Chord as the final fallback.

## R-04 — The region: exactly what the active layer draws for the focused occurrence

**Decision**: `listenRegion` filters the display's resolved positions:

```
display.positions.filter(p => p.emphasis === 'highlighted' && inLayer(p.degree, layer, quality))
```

for `layer ∈ {arpeggio, pentatonic, scale}`. `resolveCagedPositions` gives `'highlighted'` to
every position the focused occurrence claims (triad, chord, then each scale note of
`layerNotes(occ, …)`), and `'dimmed'`/`'normal'` to every other shape. Filtering by degree, not by
the claiming `layer` field, is essential: a chord tone claimed by the Chord layer is still part of
the Scale region.

**Rationale**: the spec says "exactly the positions the active layer draws for the focused
occurrence" (including string 7 and the altered string 6, which `layerNotes` already covers
because it scans every open pitch of the real or temporary tuning). Reusing the resolved positions
guarantees "sound = what is shown" (Principle I) with no second computation that could drift.
A unit property (P-2 in data-model §6) asserts this filter equals
`layerNotes(focused, openPitches, rootPc, quality, fretCount).filter(inLayer(·, layer))` for every
key, quality, shape and generated compatible tuning.

**Alternative rejected**: recomputing from `layerNotes` directly in the planner — equivalent today
but duplicates the clipping rules and would silently diverge if the drawing rules change.

## R-05 — Melodic order and unisons (FR-004, FR-005)

**Decision**:

- *Unisons*: positions are already sorted by `byPitch` (pitch ascending, ties → higher string
  number first, i.e. thicker string). `dedupeUnisons` keeps the first position of each pitch, so
  the thicker string sounds and pulses.
- *Arpeggio*: distinct pitches `d[0…n−1]` ascending; steps = `d[0…n−1] ++ d[n−2…0]`
  (2n − 1 steps; top once).
- *Pentatonic/Scale*: `r` = index of the lowest position whose degree is `'R'`; steps =
  `d[r…n−1] ++ d[n−2…r]`. If the region holds no root (cannot happen for a fitting occurrence, as
  the region always contains the shape's own root; guarded anyway), `r = 0`.
- One note per step: `playback.sequence(steps, TEMPO_BPM[tempo], instrument)`.

**Rationale**: spec Clarifications. Using `sequence` keeps the steady-beat, one-note-per-beat
behaviour identical to Notes/Triads Listen, just at the chosen tempo.

## R-06 — Chord strum timing (FR-002, FR-006)

**Decision**: constants in `state/listen.ts`: `STRUM_GAP_MS = 250`, `BLOCK_DELAY_MS = 500`,
`SHAPE_GAP_MS = 1500`. For chord positions `c[0…k−1]` ordered by pitch:

- strum note `i`: onset `t0 + 250·i`, duration `RING_MS` (1500 ms = `NOTE_MS`);
- block: onset `b = t0 + 250·(k−1) + 500`, duration `RING_MS`, all `k` positions.
- No focus: occurrence `j + 1` starts at `t0' = b_j + 1500`.

Chord positions = the focused occurrence's `notes` with `string ≤ 6`, minus string 6 when
`occ.alteredString` (the chord is drawn on 5–1 there). Pitches come from the effective instrument
(`caged.instrument`, i.e. the temporary standard tuning while it is active — FR-007).

A position that is still pulsing from its strum pulses again at the block: `applyPulses` keys by
position and the latest pulse id wins, so the marker shows one pulse restarted at the block onset —
the visible "all together" moment.

## R-07 — Triad playback (FR-003)

**Decision**: steps `[low, mid, high, [low, mid, high]]` from `selectedTriad(...)` (strings
`set, set − 1, set − 2`, frets `triad.frets`) via `playback.sequence(steps, LISTEN_BPM, …)` — the
same step shape `triads-model.ts` builds (line ~799) and the same 120 BPM. Tempo does not apply.

## R-08 — Tempo: values, storage, stop on change (FR-008, FR-024)

**Decision**:

- `state/listen.ts`: `type Tempo = 'slow' | 'medium' | 'fast'`, `TEMPOS`, `DEFAULT_TEMPO = 'medium'`,
  `TEMPO_BPM = { slow: 80, medium: 120, fast: 180 }` (`medium === LISTEN_BPM`, asserted by a test).
- Preferences: `Preferences.tempo: Tempo`; `recordSchema.tempo = v.fallback(v.picklist(TEMPOS),
  'medium')`; `serializePreferences` writes `tempo` only when not `'medium'` (key placed after
  `rotateHint`). `PREFS_VERSION` stays 1. Every existing fixture parses to `tempo: 'medium'` and
  re-serializes byte-identically (existing tests keep passing unchanged); new fixtures
  `tempo-fast.txt` and `bad-tempo.txt` are **added** (Principle IX: fixtures only added).
- Runtime: the CAGED store owns `tempo` (`$state`), `setTempo(t)` (stops a playing Listen
  sequence, then `preferences.remember({ tempo })`), `restoreTempo(t)` (no write, no stop).
  `preferences.start()` and `preferences.erase()` call `caged.restoreTempo(p.tempo)`.

**Rationale**: same additive pattern as `handedness`, `orientation`, `rotateHint`,
`labels.caged`. Tempo is CAGED-only (spec), so the CAGED store, not `playback`, owns it.

**Alternative rejected**: tempo in the `playback` store (it would invite Notes/Triads to use it,
which the spec forbids); bumping `PREFS_VERSION` (unneeded for an optional field with fallback).

## R-09 — Stopping rules (FR-009, FR-010)

**Decision**: a store-private `stopListen()` = `if (playback.sequencePlaying) playback.stop('view')`.
Called by every CAGED change that is *not* already routed through `apply()`:

| Change | Today | After this slice |
|---|---|---|
| key, quality, spelling, reset (`apply`) | stops any playback | unchanged |
| label type (`setLabelType` via `apply`) | stops any playback | **no longer stops** (spec: label type MUST NOT stop) — `setLabelType` bypasses `apply`'s stop |
| Show connections | no stop | unchanged |
| focus (`commitFocus`: tag, shape selector, See all, Next/Previous, auto-focus) | no stop (016 R-11) | `stopListen()` |
| layer switch (`toggleLayer`) | no stop (017 R-16) | `stopListen()` |
| Triad string set (`selectTriadSet`) | no stop (018 R-15) | `stopListen()` |
| tempo (`setTempo`) | — | `stopListen()` |
| instrument/tuning, temporary view | `stop('instrument')` | unchanged |
| tool/screen change | `+layout` `beforeNavigate` → `stop('navigate')` | unchanged |
| app hidden | `PlaybackHost` → `stop('hidden')` | unchanged |
| carry into CAGED | — | goes through `apply()` → stops |

`playback.sequencePlaying` is true only for `sequence`/`timeline` requests, so a tapped single
note (kind `note`) still survives focus and layer changes (016 R-11 / 017 R-16 kept for single
notes, as the spec requires). Listen pressed again calls `play`, which interrupts and restarts
(engine `halt('interrupt')`).

**Rationale**: EC-7.4 / FR-7.9 supersede the earlier slice decisions for sequences only.

## R-10 — Listen availability and announcements (FR-013)

**Decision**: `CagedDisplay.listen = { enabled, reason, source }`:

- `enabled = occurrences.length > 0`; `reason` = `caged_listen_reason_no_shapes` when the tuning is
  non-compatible (without temporary view) or `caged_listen_reason_no_fit` when no shape fits the
  fret count; `null` otherwise.
- `source` = the `ListenSource` (R-03), used for the button's accessible description and the
  status text.

UI (`CagedListen.svelte`): a **Listen** button (`aria-disabled` + `aria-describedby` → visible
reason, same pattern as `TriadsSecondary`), a **Tempo** `ChoiceGroup` (radiogroup "Tempo" with
Slow / Medium / Fast), and a `role="status"` polite text "Playing: {layer}, {shape} shape" /
"Playing every shape" while `playback.sequencePlaying` and the request came from CAGED; empty
otherwise. The shared `StopButton` in the app bar is the Stop control (already keyboard-operable,
focus-returning). Pulses already carry emphasis + size (not colour only).

## R-11 — Carry-over pairs (FR-014 – FR-018)

**Decision**: pure additions in `state/links.ts` (no Svelte):

- `carryFromCaged(c: CagedViewState): CarryContext` → `{ kind: 'notes', selection: [root, third,
  fifth] }` via `QUALITY_INTERVALS` (reuses the `notes` context kind, so `notes.carrySelection`
  applies unchanged).
- `cagedTriadCarry(c): { rootPc, quality, spelling }` for CAGED → Triads (applied with the existing
  `triads.carryTriad`, which revalidates and keeps inversion, set, view and Compare).
- `carryTriadsToCaged(t: TriadsViewState): CagedCarry` → `{ rootPc, quality: major|minor ⇒ t.quality
  else 'major', spelling: major|minor ⇒ t.spellingOverride else 'none' }`.
- `carryIntoCaged(c: CagedViewState, k: CagedCarry): CagedViewState` → `selectRoot`/spelling/
  `setQuality` composition; same object when equal. Notes → CAGED uses
  `{ rootPc, quality: c.quality, spelling: 'none' }` and is a no-op when `rootPc === c.rootPc`
  (keeps spelling and focus, per Clarification).

`links.svelte.ts` `linkTools` drops its `from === 'caged' || to === 'caged'` guard and adds the four
pairs. The CAGED store gains `carry(k: CagedCarry)` = `apply(withResolvedFocus(carryIntoCaged(view,
k)))` — the same path as the user picking the key, so focus re-resolves (R-02 of slice 016) and
playback stops.

**Rationale**: ADR 0011 — carry only in the activation handler; nothing serialized.

## R-12 — Shortcuts (FR-019 – FR-021)

**Decision**:

- `openCagedFromNote(pc)` in `links.svelte.ts`: `caged.carry({ rootPc: pc, quality:
  caged.state.quality, spelling: 'none' })` (no-op if same pc), then one `goto(resolve('/caged'))`.
  `PositionCard` gains an `oncaged` prop and a **CAGED in this key** button after "Triads from this
  note".
- `openCagedFromTriads()`: returns if `triads.state.quality` is diminished/augmented; else
  `caged.carry(carryTriadsToCaged(triads.state))`, `caged.showTriadLayer()`, `goto('/caged')`.
- `caged.showTriadLayer()`: if Triad is off → existing `toggleLayer('triad')` (auto-focuses the
  occurrence nearest the nut when there is no focus, sets `defaultTriadSet`); if already on →
  `setTriadSet(defaultTriadSet(availability))` and, without focus, focus index 0. In a
  non-compatible tuning (switch disabled) it is a no-op; CAGED opens on its notice.
- **View in CAGED** sits in `TriadsSecondary` after Listen. For dim/aug it keeps
  `aria-disabled="true"`, stays focusable, ignores activation, and is `aria-describedby` a visible
  `<span>` "CAGED covers major and minor chords" (the existing `triads_hint_octave_isolated`
  pattern). Disabled styling: the existing `--color-disabled-text`/`--color-disabled-border` tokens plus a new `--disabled-opacity` token (reduced opacity) and the visible note, so it is not conveyed by colour alone.

## R-13 — Bundle and performance

**Estimate**: +2.0–3.0 KB gzip (planner ~1 KB, timeline kind ~0.3 KB, UI ~0.8 KB, links ~0.4 KB,
messages ~0.3 KB). Current ≈ 98–99 KB after slice 018; cap 120 KB. Measured once in `pnpm verify`.
SC-002 (≤ 100 ms to first sound): the plan is O(region) ≤ ~40 positions; the engine path is the
existing one already gated at ≤ 100 ms.

## R-14 — Translations

New keys go to `messages/en.json` only (only configured locale; precedent 016–018). Keys:
`caged_listen`, `caged_listen_reason_no_shapes`, `caged_listen_reason_no_fit`,
`caged_listen_playing_layer`, `caged_listen_playing_all`, `caged_tempo_label`, `caged_tempo_slow`,
`caged_tempo_medium`, `caged_tempo_fast`, `notes_card_caged`, `triads_view_in_caged`,
`triads_view_in_caged_unavailable`. `no-raw-text.test.ts` guards them.

## R-15 — ADR

**Decision**: no new ADR is required. The `timeline` request kind extends ADR 0007 (main-thread
Karplus-Strong playback) without changing its architecture; carry pairs follow ADR 0011. The plan
records the extension in ADR 0007's "Consequences" as a one-paragraph addendum (task in Polish).

## R-16 — Test strategy (Principle IV)

- **Vitest**:
  - `tests/unit/audio/schedule.test.ts` + `engine.test.ts`: `timeline` planning (onsets, durations,
    clamps, invalid positions), sequence flag, stop/interrupt, pulses, with the fake clock.
  - `tests/unit/state/caged-listen.test.ts` (new): layer choice table; region property P-2;
    arpeggio/scale order tables for C major E shape, A shape, open C, Drop D, 7-string, Half-step
    down, temporary view; unison dedupe; strum timing; no-focus order; triad steps.
  - `tests/unit/state/caged-store.test.ts`: stop matrix of R-09 (fake engine), tempo, carry,
    `showTriadLayer`.
  - `tests/unit/state/links.test.ts`, `links-store.test.ts`: four pairs × 12 roots × 2 qualities +
    dim/aug origins (SC-005).
  - `tests/unit/prefs/schema.test.ts`: tempo parse/serialize, new fixtures, old fixtures unchanged.
  - Components: `caged-tool.test.ts` (Listen, tempo, reason), position card, Triads secondary.
- **Playwright** (`e2e/caged-listen.spec.ts`, new; plus `e2e/linked-tools.spec.ts` additions):
  US1–US4 via `__fmAudioLog` (kinds, pitches, `scheduledAtMs` deltas) and `page.clock`, pulses
  muted, Stop, hidden page, axe at phone/desktop and both themes, keyboard paths.
