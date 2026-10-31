# Phase 0 Research: Alternate Two Ratios

All decisions below build on the code shipped by slices 031 (click engine), 032 (subdivisions)
and 033 (count-in): `src/lib/audio/metronome.ts`, `src/lib/state/metronome-settings.ts`,
`src/lib/state/metronome-view.ts`, `src/lib/state/metronome.svelte.ts` and
`src/lib/tools/metronome/*`. No item was left as NEEDS CLARIFICATION.

## R-01 — Grid model: one cyclic beat-slot grid

- **Decision**: Replace 033's "count-in prefix + one infinite loop" grid with a **run plan** that
  is a prefix (initial count-in, *k* slots) followed by a **repeating cycle** of phases:
  - section on: `Loop 1 (N slots) → Repeat (r slots) → Loop 2 (N slots) → Repeat (r slots)`,
    cycle length `S = 2N + 2r` slots and `C = N·n1 + N·n2 + 2r` clicks;
  - section off: `Loop 1 (N slots)`, `S = N`, `C = N·n1` (identical to 033 after the prefix).
  A **slot** is one beat of time (a count-in click or a loop beat). Click index `c` maps to a
  slot and a within-slot sub-click with integer division by `C` and a walk over at most four
  phases; time is `anchor + (slotIndex − startSlot) × T + j × T / n`, where the slot difference
  is an integer computed before any multiplication. Nothing is accumulated.
- **Rationale**: Gap-free switches (FR-008, SC-002) hold by construction: every phase starts on
  a whole slot, so the last click of a phase and the first of the next are exactly one beat
  apart at any BPM, and cycle *m* starts at slot `k + m·S` with no drift after any number of
  cycles. Pause, Resume, skip-forward and per-slot reporting stay one code path, as in 033
  (which chose one combined grid over chained segments for the same reason).
- **Alternatives considered**: (a) Chaining one engine segment per phase and starting the next
  from the previous one's end time — boundary jitter and a second Pause path, rejected in 033
  R-01 already. (b) Two schedulers, one per loop — overlapping streams on a fast switch,
  violates the "no overlap" requirement. (c) Accumulating `when += T/n` — drifts, forbidden by
  031.

## R-02 — Pure cycle module

- **Decision**: Put the plan arithmetic in a new framework-free module
  `src/lib/audio/metronome-cycle.ts`: `RunPlan`, `toRunPlan` (validation), `slotAt(plan, s)`,
  `slotStart(plan, s)` (first click index of a slot), `clickAt(plan, c)` (slot, sub-click,
  kind, phase) and `cycleSlots(plan)`. `metronome.ts` keeps scheduling, frames and halt, and
  calls these.
- **Rationale**: `metronome.ts` is 373 lines; the cycle walk is the part with the most edge
  cases (N = 1, r = 0, n1 = n2, k = 0) and deserves a table-and-property test file of its own
  without fake audio. Constitution III/X: small single-purpose pure modules.
- **Alternatives considered**: Growing `clickAt`/`skipTo` inside `metronome.ts` — workable, but
  mixes pure maths with the scheduler's mutable state and makes the property tests depend on
  the scheduler file.

## R-03 — Segment start: `startSlot` replaces `startBeat` and `countIn.from`

- **Decision**: `SegmentStart` becomes `{ bpm, beats, clicksPerBeat, initialCountIn?,
  alternate?: { clicksPerBeat, repeatCountIn }, startSlot?, run, pressedAtMs }`. The plan is
  the same for the whole run; Start passes `startSlot: 0`, Resume passes the slot after the
  last one that sounded. `startBeat` and `countIn: { from, total }` are removed.
- **Rationale**: With a cycle, a position needs loop, phase and beat or click; a single
  run-global integer encodes all of it and makes Resume trivially exact (FR-009, SC-004),
  including "never replay a finished count-in" (the slot is past it). The store does not need
  to reconstruct engine positions.
- **Alternatives considered**: Keeping `startBeat` and `countIn` and adding `startLoop` and a
  repeat flag — four fields that must agree, with invalid combinations to reject. Keeping the
  old fields as a compatibility layer next to `startSlot` — two ways to say one thing (YAGNI);
  the only callers are the store and the engine unit tests, which are updated mechanically
  (`startBeat: b` → `startSlot: b − 1`; `countIn: { from, total }` → `initialCountIn: total,
  startSlot: from`).

## R-04 — Position reporting: `SlotPosition`

- **Decision**: A new union `SlotPosition`:
  `{ kind: 'count-in', slot, click, total, repeat, next }` |
  `{ kind: 'beat', slot, beat, loop, clicksPerBeat }`. `HaltedAt = SlotPosition | { kind:
  'none' }`. The events keep their names and gain the position as a second argument:
  `onBeat(beat, at)`, `onCountIn(click, at)`.
- **Rationale**: Additive for existing consumers (`frozen.kind === 'beat'` / `.beat`,
  `'count-in'` / `.click` still work); the store gets the loop and its clicks per beat for
  `SUB` (FR-007) and the count-in total (*k* or *r*) without re-deriving the plan.
- **Alternatives considered**: One `onSlot(at)` event replacing both — cleaner but renames
  every engine-test expectation for no behaviour gain. Store-side derivation from the slot
  number — duplicates the cycle walk outside `src/lib/audio`.

## R-05 — Skip-forward and audible index on the cycle

- **Decision**: `skipTo(now)` takes `slot = startSlot + floor(u / T)` with `u = now + lead −
  anchor`, then `c = slotStart(plan, slot)` and advances `c` while `when(c) < now + lead`
  (at most `n ≤ 8` steps). `audibleIndex()` uses the same floor on `now − latency` and steps
  back at most `n` sub-clicks. Missed clicks are never scheduled; the frame loop reports the
  slot of the latest audible click, so the view lands on whichever phase that slot belongs to.
- **Rationale**: Matches the 031/033 "skip forward, no burst" rule across a skipped switch
  (Edge Cases), with O(1) work per call.
- **Alternatives considered**: Iterating click by click from `next` to now — unbounded after a
  long background suspension.

## R-06 — Accents and the log entry

- **Decision**: Every count-in click (initial or repeat) uses `accent`; loop sub-click `j % n
  = 0` uses `accent` on beat 1 of each loop (Loop 1 and Loop 2) and `normal` on beats 2…N;
  other sub-clicks use `sub`. The test-build `click` log entry gains `phase: 'initial' |
  'repeat' | 'loop1' | 'loop2'`; `slot` becomes the run-global slot (count-in clicks are slots
  0…k−1, no longer negative); `beat` is the beat within the current loop (0 for count-in);
  `countIn` stays the 1-based click number in its own count-in.
- **Rationale**: Clarification "Accents at a switch". E2E specs can assert the whole audible
  sequence (US1-1, SC-001) from the log without timing guesses.
- **Alternatives considered**: Keeping negative count-in slots — undefined for repeat
  count-ins in later cycles.

## R-07 — Settings fields and effective counts

- **Decision**: `MetronomeSettings` gains `ratio: boolean` (default `true`) and `loop2:
  Subdivision` (default `6`). `toRatio(v)` returns `v` when boolean, else `true`. Loop 2 is
  validated with the existing `toSubdivision` (fallback 6 at the parse boundary; setters ignore
  invalid input like `setSubdivision`). New pure `effectiveRepeatCountIn(s) = s.countIn &&
  s.ratio ? s.repeatCountIn : 0` and `runPlanFor(s)` returning the `SegmentStart` plan fields.
  Turning the section off keeps `loop2`.
- **Rationale**: FR-006 (repeat plays only if Count In on, Repeat > 0 and section on), FR-012,
  US2-4. Flat fields match 033's style and the later persistence slice (005).
- **Alternatives considered**: `loops: Subdivision[]` — speculative generality (scope is exactly
  two loops) and renames `subdivision`, which FR-012 keeps as Loop 1.

## R-08 — Store state and Resume rules

- **Decision**: The store keeps `position: SlotPosition | null` (last sounded) instead of
  `stage`/`countInClick`/`countInTotal`, plus the plan's *k* for the "before anything sounded"
  view. Getters derive `beat`, `countIn` (`{ click, total }` during a count-in phase), `sub`
  (the playing loop's clicks per beat; Loop 1 before the first beat) and `dots`. Pause stores
  the `HaltedAt` position; Resume starts at `(position?.slot ?? −1) + 1`. Pause on the last beat
  of a loop resumes with repeat click 1 (or the next loop's beat 1 when *r* = 0); pause on the
  last repeat click resumes with the next loop's beat 1, both within 50 ms.
- **Rationale**: FR-009, US4, Clarification "Pause on the last beat". One number to resume
  from; the view is a pure function of the last position.
- **Alternatives considered**: Keeping `stage` and adding `loop` and `repeat` fields — more
  state that can disagree with the engine.

## R-09 — Settings UI

- **Decision**: New `RatioSettings.svelte` between `CountInSettings` and Start: a header row
  with `<h3 id="metronome-ratio-heading">` (text "Subdivision ratio", `font-variant-caps:
  all-small-caps`, so it reads SUBDIVISION RATIO) and on its right the global `.switch` button
  (`role="switch"`, `aria-checked`, `aria-labelledby` the heading, visible On/Off word reusing
  `metronome_switch_on/off`); below, the Loop 1 select and, only when on, the Loop 2 select.
  `SubdivisionSelect` gains `id` and `label` props (its second real use, so the abstraction is
  allowed by X).
- **Rationale**: FR-001–FR-003, FR-011, FR-014; same pattern as the Count In switch (033).
  `aria-labelledby` gives the switch exactly the translated header as its name without a
  duplicate message key. Removing the Loop 2 row with `{#if}` keeps it out of the tab order
  and the accessibility tree, and the value lives in the store.
- **Alternatives considered**: `<fieldset>`/`<legend>` — a legend cannot host the switch on its
  right in a stable cross-browser layout. A disabled Loop 2 select — rejected by the
  clarification (hidden).

## R-10 — Messages and announcements

- **Decision**: New keys in `messages/{en,pt-BR,es}.json`:
  | Key | en | pt-BR | es |
  |---|---|---|---|
  | `metronome_ratio_heading` | Subdivision ratio | Proporção de subdivisão | Proporción de subdivisión |
  | `metronome_loop2_label` | Loop 2 | Loop 2 | Bucle 2 |
  | `metronome_announce_started_ratio` | Started, {bpm} BPM, {beats} beats, {loop1} then {loop2} | Iniciado, {bpm} BPM, {beats} tempos, {loop1} e depois {loop2} | Iniciado, {bpm} BPM, {beats} tiempos, {loop1} y luego {loop2} |
  | `metronome_announce_started_ratio_count_in` | … then {loop2}, count in {count} | … e depois {loop2}, contagem {count} | … y luego {loop2}, cuenta {count} |
  | `metronome_announce_paused_loop` | Paused on beat {beat} of {beats}, {subdivision} | Pausado no tempo {beat} de {beats}, {subdivision} | En pausa en el tiempo {beat} de {beats}, {subdivision} |
  The pt-BR/es prefixes ("Iniciado", "tempos"/"tiempos", the count-in wording) copy the
  existing `metronome_announce_started*` translations verbatim, so only the "then" part is new.
  With the section off every announcement uses the 033 keys unchanged (FR-015). Pause during
  a repeat count-in reuses `metronome_announce_paused_count_in` with `count = r`. Glossary
  rows (draft) for "Subdivision ratio" and "Loop 2".
- **Rationale**: FR-013, Constitution VIII; separate keys keep the section-off texts
  byte-identical (same reasoning as 033 R-10).
- **Alternatives considered**: One key with an optional suffix — needs Paraglide variants for
  one case.

## R-11 — Existing tests under the new default

- **Decision**: With the section on by default, a 031/032/033 test that runs past beat *N*
  would now hear Loop 2. Add an e2e helper `ratioOff(page)` (beside `countInOff`) and use it in
  the 031/032/033 specs whose assertions span more than one loop; unit store/panel tests pass
  `ratio: false` to `resetMetronomeForTests` where they assert wrap-around. Engine unit tests
  are migrated to `startSlot`/`initialCountIn` (R-03); the 033 assertion `loop.slot === 0` in
  `e2e/metronome-count-in.spec.ts` becomes `slot === k`. The "metronome views" screenshot is
  re-baselined in CI via `update-snapshots.yml` (the settings view gains the header and Loop 2).
- **Rationale**: Keeps existing tests about what they test (FR-015) without a test-only product
  switch.
- **Alternatives considered**: A URL flag to disable alternation in tests — product surface
  used only by tests.

## R-12 — ADR

- **Decision**: Add "Revision (034 alternating ratios)" to
  `docs/adr/0030-metronome-click-scheduler.md`: cyclic plan, run-global slots, `startSlot`
  resume. No new ADR.
- **Rationale**: Same architecture (one look-ahead scheduler, integer grid, one anchor), extended.
- **Alternatives considered**: New ADR — the decision is a revision of 0030, as 032 and 033 were.

## Best-practice notes

- Web Audio look-ahead (25 ms tick, 1.5 s horizon) unchanged; at 300 BPM with 32nd notes the
  horizon holds ≤ 60 pending sources, the same bound as 032.
- Floating point: slot differences are integers ≤ 2^31 within any realistic run; `(s − s0) × T`
  keeps the error below 1e-9 s after 100 cycles at 30 BPM (verified by property test, SC-002).
