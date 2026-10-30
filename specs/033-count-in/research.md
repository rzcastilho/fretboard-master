# Research: Count In (033)

Phase 0 output for [plan.md](./plan.md). Each entry records the decision, why it was chosen and
what else was weighed. Every Technical Context item was resolved from the spec, its
Clarifications, the constitution and the 031/032 code; nothing is left as NEEDS CLARIFICATION.

Sources: spec 033 (S), constitution 2.1.0 (C), 031/032 code and specs (X), macro-spec
`specs/autonomous/metronome-trainer-spec.md` (M).

---

## R-01 One combined grid: count-in clicks first, loop clicks after

**Decision**: Extend the 032 scheduler's integer-index grid with a count-in prefix. A segment
with *r* remaining count-in clicks (r = total − already played) and *n* clicks per beat uses one
monotonically increasing index *c*:

- *c* < *r*: count-in click, `when = anchor + c × T` (T = 60 / BPM), kind `accent`.
- *c* ≥ *r*: loop grid click *j* = *c* − *r*, `when = anchor + r × T + j × T / n`, kind as in 032
  (`accent` on beat 1, `normal` on other beats, `sub` between beats).

The *slot* becomes `c − r` for count-in clicks (negative: −r … −1) and `floor(j / n)` for loop
clicks, so slots stay strictly increasing across the boundary and every 032 rule written in
terms of slots (one report per slot, halt freezes on the slot) keeps working unchanged. With
r = 0 every formula collapses to 032's, sample for sample.

**Rationale**: S FR-007/FR-014 and the Clarification fix the formula exactly (anchor + i × T,
then anchor + k × T + j × T / n). Computing each time from one anchor and an integer index is
the 031/032 drift-free rule (ADR 0030). A single grid means one pump loop, one pending list and
one halt path, so Pause cancels count-in and loop clicks the same way and the boundary has no
gap or overlap by construction.

**Alternatives considered**:
- *Two segments chained (a count-in segment that starts a loop segment on its end)*: the second
  anchor would be taken from a timer or `onended`, adding jitter at exactly the boundary the
  spec measures to 2 ms (SC-002); also two code paths for Pause.
- *Treating the count-in as extra loop beats with `perBeat = 1`*: would need a per-slot
  subdivision and would report `onBeat`, moving the dot row; the count-in is not a loop beat (S
  Assumptions).

## R-02 Skip-forward on the combined grid

**Decision**: `skipTo(seg, now)` inverts the piecewise grid. With target `t = now + START_LEAD_S`:
if `t ≤ anchor + r × T`, return `max(0, ceil((t − anchor) / T))`; otherwise return
`r + ceil((t − anchor − r × T) × n / T)`. Missed count-in clicks are never replayed; if the
next due click is already in the loop, scheduling continues there and the first report is a
loop beat, which switches the view to the dot row (S FR-019, Clarification "background
suspension").

**Rationale**: Same "skip forward, never a burst" rule as 031/032 (contract E6), extended to two
regions without a special case in the pump.

**Alternatives considered**: restarting the count-in after a stall (would play an unexpected
second count-in, violating SC-004); replaying missed clicks (a burst, forbidden since 031).

## R-03 Reporting the count-in position: a second event, not a second meaning of `onBeat`

**Decision**: Add `onCountIn(click: number)` to `SchedulerEvents`. The frame loop computes the
slot of the latest audible click; when the slot increases it calls `onCountIn(from + c + 1)`
for a count-in slot (1-based, in the run's original numbering) or `onBeat(beat)` for a loop
slot, as today. `halt()` returns a `HaltedAt` value instead of a bare beat number:
`{ kind: 'count-in', click }`, `{ kind: 'beat', beat }` or `{ kind: 'none' }`.

**Rationale**: The store needs to distinguish the two stages to choose the status text, the
dot view and the Resume rule (S FR-009–FR-011). Overloading `onBeat` with a sentinel (e.g.
negative beats) would leak the slot encoding into the store. The return type change of `halt`
is small: one caller (`metronome.svelte.ts`) plus unit tests.

**Alternatives considered**: keeping `halt(): number` and letting the store rely on the last
event (the frame loop can lag the audio clock by up to one frame, which is why 031 made `halt`
return the audible beat in the first place); a generic `onPosition` replacing `onBeat`
(rewrites every 031/032 test for no behavioural gain).

## R-04 Segment input: an optional `countIn` field

**Decision**: `SegmentStart` gains `countIn?: { readonly from: number; readonly total: number }`.
Absent, or invalid (non-integers, `total` outside 0–8, `from` outside 0–total), means no
count-in. The engine plays clicks `from + 1 … total`, then the loop at `startBeat`.

**Rationale**: Start passes `{ from: 0, total: k }`; Resume during a count-in passes
`{ from: n, total: k }` so the status continues at `COUNT IN n+1/k`; Resume after the count-in
omits it (S FR-011: never a new count-in). Optional keeps the 031/032 call sites and tests valid
unchanged, which is also the "k = 0 is exactly 032" guarantee (Clarification).

**Alternatives considered**: two required numeric fields (forces edits to every existing test
call for no gain); passing the remaining count only (the engine could not number the clicks,
so the store would have to translate every event).

## R-05 Count-in click sound and level

**Decision**: Count-in clicks use the existing `accent` buffer (1600 Hz, peak 0.9, 30 ms). No
new `ClickKind`. The click log entry gains `countIn: number | null` (1-based click number for
count-in clicks, `null` for loop clicks) so tests can tell them apart from beat-1 accents.

**Rationale**: S FR-006 and Assumptions ("existing accent sound and level; no new sound").
Each click is its own source on `sink.destination`, so mute and volume apply (FR-015) exactly
as for 031 clicks.

**Alternatives considered**: a distinct count-in timbre (not asked for; M says "accented
clicks"); identifying count-in clicks by negative slot only in tests (works, but an explicit
field reads better in e2e assertions and costs nothing outside test builds).

## R-06 Store model for a run with a count-in

**Decision**: `metronome.svelte.ts` keeps three new run fields: `countInTotal` (k for this run,
fixed at Start), `countInClick` (0…k, last count-in click that sounded) and `stage`
(`'count-in' | 'loop'`). Start sets `stage = k > 0 ? 'count-in' : 'loop'`. `onCountIn` updates
`countInClick`; the first `onBeat` sets `stage = 'loop'`. Either event moves `starting →
running`. Pause takes the `HaltedAt` from `halt('pause')` to freeze precisely. Resume passes
`countIn: { from: countInClick, total: countInTotal }` while `stage === 'count-in'`, else
nothing and `startBeat` as in 031. Reset and `screenChanged()` clear the run fields; Reset keeps
the settings, `screenChanged()` restores defaults (S FR-012).

Edge: paused after the last count-in click (n = k) but before loop beat 1 → Resume passes
`{ from: k, total: k }`, so loop beat 1 plays within 50 ms (the 031 Resume rule: the next due
item plays at once).

**Rationale**: Mirrors the 031 store, where `beat` and `phase` change only through scheduler
events. Settings cannot change during a run (S FR-005), so caching k at Start is safe and keeps
the run independent of later settings edits.

**Alternatives considered**: deriving the stage from `beat === 0` (cannot distinguish "before
count-in click 1" from "between count-in and loop", and breaks after skip-forward).

## R-07 Settings fields and clamping

**Decision**: `MetronomeSettings` gains `countIn: boolean` (default `true`),
`initialCountIn: number` (0–8, default 4) and `repeatCountIn: number` (0–8, default 2). A new
`clampCount(v, fallback)` rounds and clamps to 0–8 and returns the field's default for NaN
(Clarification; note this differs from `clampBpm`/`clampBeats`, which give the minimum for NaN,
and the difference is pinned by a unit test). `SettingField` widens to
`'bpm' | 'beats' | 'initialCountIn' | 'repeatCountIn'`, so `atLimit`/`stepSetting` serve the new
rows. The effective count-in for a run is `countIn ? initialCountIn : 0`
(`effectiveCountIn(settings)`). `repeatCountIn` is stored and never read by playback (FR-013,
US4).

**Rationale**: Same shape as `beats`, ready for slice 005 (remembered settings) and slice 004
(repeat count-in) without a settings change.

**Alternatives considered**: a nested `countIn: { on, initial, repeat }` object (diverges from
the flat settings and makes `stepSetting` generic over paths); dropping `repeatCountIn` until
004 (S US4 requires it now).

## R-08 Count In switch and rows (UI)

**Decision**: New `CountInSettings.svelte` in `src/lib/tools/metronome/`, mounted in
`MetronomePanel` between the # of Beats row and `SubdivisionSelect`. It renders:

- a `<button type="button" class="switch" role="switch" aria-checked>` using the existing
  global `.switch`, `.switch-track`, `.switch-thumb` family in `src/lib/styles/controls.css`
  (ADR 0028), with the visible text "Count In" as its accessible name and a visible, aria-hidden
  On/Off state word (as in `CagedTool`), so the state is not conveyed by colour alone (thumb
  position + word);
- `{#if countIn}` two `ValueRow`s (ids `metronome-initial-count-in`,
  `metronome-repeat-count-in`, min 0, max 8). Removing them from the DOM satisfies "not reachable
  by keyboard or assistive technology" (FR-003); values live in the store, so they return when
  the switch is turned back on.

Space on the switch toggles it and never starts training: `MetronomePanel` already marks
`[role="switch"]` as `targetActivates`, so `matchMetronomeKey` returns null.

**Rationale**: Reuses the app's switch family and the 031 `ValueRow` (slider + −/value/+ pill,
`disabled` at limits, PageUp/PageDown, 320 px reflow) — no new control and no new tokens for
them. `--target-min` is 44 px, above the 24 px minimum.

**Alternatives considered**: a checkbox styled as a switch (the Clarification and the app
precedent pick `role="switch"`); hiding rows with `hidden`/CSS (works, but `{#if}` is the
pattern the panel already uses for its two views).

## R-09 Single pulsing dot

**Decision**: During the count-in stage `StatusBox` renders one `.dot` (same size and tokens as
the beat dots) instead of the dot row, inside the same `aria-hidden` `<ol>`. It is `upcoming`
before click 1 and `lit` from click 1 on. The pulse is a CSS keyframe (scale to
`--metronome-pulse-scale`, new token 1.25, and back) with `animation-duration:
var(--duration-base)` (200 ms, the spec's maximum) and `--ease-standard`. The dot element is
wrapped in `{#key countInClick}` so each click remounts it and the animation replays.
Under `prefers-reduced-motion: reduce` the dot gets `animation: none` (the tokens already
collapse durations to 0 s; the explicit rule also covers browsers that would still run a 0 s
keyframe). Forced colours reuse the 031 dot rules (Highlight fill for lit).

**Rationale**: S FR-009 and the Clarification ("lit accent state plus a token-timed pulse of at
most 200 ms"); C VII (every visual value from tokens, motion within documented durations).
Remounting a 1.5 rem element once per beat is negligible.

**Alternatives considered**: Web Animations API from script (needs a reduced-motion check in JS
and a DOM ref; CSS is simpler); toggling a class off and on (requires a forced reflow hack).

## R-10 Status line, announcements and messages

**Decision**: `statusParams` gains two kinds: `{ kind: 'count-in', click, total }` and
`{ kind: 'count-in-none', total }`. `StatusBox` renders `COUNT IN n/k` / `COUNT IN –/k` with no
`· SUB n` part (Clarification). The live region adds: a separate start message with the count-in
(`metronome_announce_started_count_in`), and two pause messages
(`metronome_announce_paused_count_in`, `metronome_announce_paused_count_in_none`). Clicks are
never announced.

New keys (en / pt-BR / es), from the spec's Clarifications:

| Key | en | pt-BR | es |
|---|---|---|---|
| `metronome_count_in_label` | Count In | Contagem | Cuenta previa |
| `metronome_switch_on` | On | Ligado | Activado |
| `metronome_switch_off` | Off | Desligado | Desactivado |
| `metronome_initial_count_in_label` | Initial Count In | Contagem inicial | Cuenta inicial |
| `metronome_repeat_count_in_label` | Repeat Count In | Contagem de repetição | Cuenta de repetición |
| `metronome_initial_count_in_decrease` | Fewer initial count-in clicks | Menos cliques na contagem inicial | Menos clics en la cuenta inicial |
| `metronome_initial_count_in_increase` | More initial count-in clicks | Mais cliques na contagem inicial | Más clics en la cuenta inicial |
| `metronome_repeat_count_in_decrease` | Fewer repeat count-in clicks | Menos cliques na contagem de repetição | Menos clics en la cuenta de repetición |
| `metronome_repeat_count_in_increase` | More repeat count-in clicks | Mais cliques na contagem de repetição | Más clics en la cuenta de repetición |
| `metronome_status_count_in` | COUNT IN {click}/{count} | CONTAGEM {click}/{count} | CUENTA {click}/{count} |
| `metronome_status_count_in_none` | COUNT IN –/{count} | CONTAGEM –/{count} | CUENTA –/{count} |
| `metronome_announce_started_count_in` | Started, {bpm} BPM, {beats} beats, {subdivision}, count in {count} | Iniciado, {bpm} BPM, {beats} tempos, {subdivision}, contagem {count} | Iniciado, {bpm} BPM, {beats} tiempos, {subdivision}, cuenta {count} |
| `metronome_announce_paused_count_in` | Paused on count-in click {click} of {count} | Pausado na contagem {click} de {count} | En pausa en la cuenta {click} de {count} |
| `metronome_announce_paused_count_in_none` | Paused before the count-in | Pausado antes da contagem | En pausa antes de la cuenta |

None is identical to English, so `identical-allowlist.ts` needs no change. Glossary rows go in
`docs/i18n/glossary.md` (draft, for the pre-launch native-speaker review).

**Rationale**: A separate start key (rather than an optional placeholder) keeps the
no-count-in announcement byte-identical to 032 (FR-016 "Start without one is unchanged").
`metronome_switch_on/off` duplicate the CAGED values on purpose: messages stay per tool, so a
later wording change in one tool does not leak into the other.

**Alternatives considered**: reusing `caged_switch_on/off` (cross-tool coupling); a
pluralised/conditional single start message (Paraglide variants add complexity for one case).

## R-11 Impact on the existing 031/032 tests

**Decision**: Because Count In defaults to on, every existing test that asserts the first click
is a loop beat within 50 ms, or reads `BEAT –/4` before the first click, would now see the
count-in first. Unit tests are unaffected (the engine's `countIn` is optional, and store tests
using `resetMetronomeForTests()` get the new defaults → they are updated to switch the count-in
off in the helper where they test loop behaviour). Existing e2e specs (`metronome.spec.ts`,
`metronome-subdivisions.spec.ts`, `metronome-a11y.spec.ts`) gain a `countInOff(page)` helper in
`e2e/support/` used where the test is about the loop; tests about the first click/announcement
are updated to the new expected behaviour. The "metronome views" screenshot changes (new
settings rows) and is re-baselined through `update-snapshots.yml` (Linux baselines come only
from CI, C verification tiers).

**Rationale**: Keeps each existing test about what it was written for, and adds the count-in
behaviour in a dedicated `e2e/metronome-count-in.spec.ts`.

**Alternatives considered**: changing the default to off for tests via a URL flag (a test-only
product switch; not needed since the UI toggle is one click).

## R-12 ADR, bundle and performance

**Decision**: No new ADR. Add a "Revision (033 count-in)" section to
`docs/adr/0030-metronome-click-scheduler.md`: the count-in prefix on the integer grid, signed
slots, `onCountIn`, `HaltedAt`. Expected bundle growth < 2 KB gzip (one component, ~14 messages ×
3 locales are tree-shaken per locale at build, a few engine lines) against 151.2 KB measured
after 032 and a 160 KB budget; checked by `pnpm verify`'s bundle-size step. Pending sources at
most 8 more within the 1.5 s horizon (count-in is one click per beat).

**Rationale**: The decision recorded by ADR 0030 (one anchor, integer index, scheduled ahead)
is unchanged; this is a refinement like 032's.

**Alternatives considered**: a new ADR (no new architectural choice to record).
