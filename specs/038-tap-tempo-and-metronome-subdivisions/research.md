# Research: Tap Tempo and Metronome Subdivisions (038)

Phase 0 of [plan.md](plan.md). Each decision gives the choice, the reason, and the alternatives
that were rejected. Code references are to the tree at commit `96ce153` (037 merged).

Technical Context had no open unknowns. The spec's two clarify sessions settled
the product questions. The open points below are engineering questions that the code raised.

---

## R-01 Where the tap maths lives

**Decision**: A new pure module `src/lib/state/tap-tempo.ts` exports `TapRun` (the timestamps
of the current run, most recent last, at most 8) and `tap(run, atMs)`. `tap` returns
`{ run, bpm }`, where `bpm` is `null` for taps 1–3 and the clamped, rounded tempo from tap 4
on. Algorithm:

1. When the run is empty, or `atMs − last > 2000`, or `atMs < last` (a clock that went
   backwards, which only a test or a broken device can produce), the run becomes `[atMs]` and
   `bpm` is `null`.
2. Otherwise `atMs` is appended and the run is trimmed to its last 8 entries.
3. When the run has fewer than 4 entries, `bpm` is `null`.
4. Otherwise `avg = (last − first) / (n − 1)`, which is the mean of the consecutive gaps (it
   telescopes), and `bpm = clampBpm(60000 / avg)`. `clampBpm` rounds half up for positive
   values (`Math.round`) and limits the result to 30–300. An average gap of 0 gives `Infinity`,
   which clamps to 300 (the spec's "double-activating device" edge case).

**Rationale**: Pure and DOM-free, so it can be table- and property-tested (Principle IV), and it
is reused by the button and by the `T` key (FR-001, FR-005). A gap of exactly 2000 ms continues
the run, because the test is `> 2000` (FR-004). The mean of 7 gaps over 8 taps follows a
drifting tempo (FR-003).

**Alternatives considered**:
- Median of the gaps: more robust to one stray tap, but the spec says "average" and SC-001 is
  written for it.
- Exponential smoothing: tunable, but nothing asks for it, and it is harder to state in a test
  (YAGNI).
- Putting the maths in `metronome-settings.ts`: that module is about settings records, while the
  tap run is transient UI state.

## R-02 The tap timestamp

**Decision**: The store action `metronome.tapTempo()` takes no argument. It reads the time from
the scheduler clock seam that already exists (`overrides.clock?.now() ?? performance.now()`).
Unit tests inject the fake clock. E2E tests use `page.clock.install()` and `page.clock.runFor(500)`
between taps, which Playwright fakes for `performance.now()`.

**Rationale**: The result is deterministic in both test layers (Principle IV, "injectable
clock"). The spec's assumption "tap timing uses the time of the user action" holds within the
same task, so the handler runs microseconds after the event.

**Alternatives considered**:
- `event.timeStamp`: it is closer to the hardware event, but the browser stamps it and
  Playwright's clock cannot fake it, so the e2e checks of SC-001 would become timing-flaky.
- `pointerdown` instead of `click` for lower latency: it adds a separate path for keyboard
  activation, which `click` already covers. A constant offset does not change the gaps.

## R-03 Live tempo change in the click scheduler

**Problem**: `createClickScheduler` has no way to change the tempo while live. `start()` fixes
`period = 60 / bpm`, and `pump()` schedules up to `HORIZON_S = 1.5 s` ahead. At 300 BPM that is
7 beats. If the new tempo only started at the first click not yet scheduled, it could be heard
up to 1.5 s late, which breaks SC-003 ("no later than the second beat after the tap").

**Decision**: Add `ClickScheduler.retime(bpm): boolean`. While a periodic (non-ramp) segment is
live, it does the following:

1. Report the audible slot synchronously, as a frame does, so the store's position is current.
2. `t = now()`. The commit slot `S′` is the smallest slot whose first click, on the current
   grid, starts at or after `t + START_LEAD_S`. That is the next beat, or the one after it when
   the next beat starts less than 20 ms from now.
3. Schedule at once, on the current grid, every click with index from `next` up to
   `slotStart(S′) − 1`. These are the sub-clicks of the beat that is playing. They lie less
   than one beat ahead (at most 2 s at 30 BPM).
4. Stop and disconnect every pending source with `when ≥ time(S′) − 1e-9`. These are all the
   clicks of slots `≥ S′` that were already scheduled. Log
   `click-cancel { reason: 'retime', count }`.
5. Replace the grid: `anchor = time(S′)` (its old time, so there is no phase shift),
   `startSlot = S′`, `startIndex = slotStart(S′)`, `period = 60 / bpm`, and `next = startIndex`.
   The plan (beats, clicks per beat, count-in) is unchanged.

When the segment is live but not yet anchored (the sink's `running` promise is still pending),
the new bpm is kept and used by `anchorAndRun`. When the segment is not live, or is a ramp, the
call returns `false` and does nothing.

**Why this satisfies FR-007 and SC-003**:
- The beat that is playing keeps its old length, and its soft clicks keep the old spacing.
- Beat `S′` sounds at exactly the time it would have sounded before. Its length, and therefore
  its soft clicks and every later beat, use the new period.
- The slot sequence is continuous, so no beat is added or dropped.
- The tempo change is heard no later than the second beat after the tap.

**Re-anchor guard**: `pump()` moves `anchor` forward when `next === seg.startIndex` and the
anchor is in the past. That guard exists for the first click of a segment. After a retime,
`next === startIndex` is true again, but `anchor ≥ now + START_LEAD_S`, so the guard cannot
fire. To make this explicit instead of incidental, the guard is limited to a segment that has
not yet scheduled any click (a `firstScheduled` flag).

**Audible index after a retime**: `indexAt(newGrid, t)` returns −1 while `t < anchor`. The slot
that was playing has already been reported (step 1). So `frameLoop` correctly reports nothing
until `S′`. If a pause lands in that window, `halt()` returns `{ kind: 'none' }`, and the store
keeps its current position (`S′ − 1`). Resume then starts at `S′`.

**Alternatives considered**:
- Apply the change at the first slot not yet scheduled, with no cancellation. This is simpler,
  but it can be up to 7 beats late at 300 BPM, which fails SC-003.
- Shorten `HORIZON_S` to one beat for plain runs. That changes the timing robustness of every
  plain run (ADR 0030 jitter budget) and breaks FR-014 ("identical to before").
- Halt and start a new segment from `S′`. `halt` cancels sources from `now()`, which would drop
  the sub-clicks of the playing beat. A new segment also re-anchors at `now + START_LEAD_S`,
  which shifts the phase and can add a gap.

## R-04 Store integration of tap tempo

**Decision**: `metronome.tapTempo()` works only in plain mode, and in every phase.

- A module-level `tapRun: TapRun` holds the run. It is not reactive, because nothing renders it.
- When `tap()` returns a bpm that differs from `state.plain.bpm`, the store runs
  `commitPlain({ ...state.plain, bpm })`, which also remembers it (FR-011). It sets
  `state.announcement = '{bpm} {m.metronome_bpm_unit()}'`, which is the same composition as the
  BPM slider's `valuetext`, so no new key is needed (FR-015). In `running` or `starting`, it
  also calls `scheduler?.retime(bpm)`.
- While paused, only the record changes. `resume()` already reads `state.plain.bpm` (FR-007).
- A tap that returns `null`, or the same bpm as before, changes nothing and announces nothing.
- The run is cleared by `reset()`, `selectMode()`, `screenChanged()`/`halt()` and `restore()`.
  It is not cleared by Start, Pause or Resume (the edge case "taps while the Start/Pause state
  changes still count").

`commitPlain` is already free of phase checks, and the `phase === 'settings'` guards stay on
the other setters. Only `tapTempo` edits BPM outside the settings phase.

**Readout timing**: the `{bpm} BPM` readout and the pill show the new value at once, while the
audible change comes at `S′`. The difference is at most two beats and matches the spec ("the
readout updates"). This is recorded as an accepted behaviour.

**Alternatives considered**:
- A separate `tempo` store: this would add a second source of truth for plain BPM.
- Announcing through a new `metronome_announce_tempo` key: the existing `valuetext` composition
  already says the same thing.

## R-05 Keyboard `T`

**Decision**: `matchMetronomeKey` gains the action `'tap'`. Its `ctx` gains
`mode: MetronomeMode` and `shortcuts: boolean`. The matcher returns `'tap'` when all of the
following hold:

- the key is a single character whose lower case is `t` (Shift is allowed);
- `ctx.mode === 'plain'`;
- `ctx.shortcuts` is true;
- `!ctx.disclosureOpen`.

The guards that already exist apply first: Ctrl, Meta, Alt or AltGraph held, `repeat`,
`defaultPrevented`, `isComposing`, and an editable target (text inputs, textarea, select,
contenteditable).

A focused button does not block `T`, because `T` never activates a button. `MetronomePanel`
passes `mode: metronome.mode` and `shortcuts: shortcuts.enabled`, then calls
`metronome.tapTempo()` and `preventDefault()`.

**Rationale**: FR-005 and WCAG 2.1.4. The 027 switch turns off `T` only. Space and Escape stay as
they are, because the 027 switch never covered them and the spec does not change them. The
global layout matcher (`SHORTCUTS`: P . , L N) has no `T`, so there is no double dispatch.

**About page**: `ShortcutList.svelte` adds a third row to its metronome list: `<kbd>T</kbd>`
with `shortcuts_metronome_tap` ("Tap tempo (Metronome mode)"). `T` is not added to `SHORTCUTS`,
because that table drives the fretboard tools' dispatcher.

This amends 031 FR-023, for the plain mode only.

**Alternatives considered**:
- Adding `T` to the global `SHORTCUTS` table and `runShortcut`: the metronome store would then
  be wired into the fretboard dispatcher, and `T` would be listed among the fretboard keys.
- Ignoring the 027 switch: this fails WCAG 2.1.4.

## R-06 The tap button in the two views

**Decision**:

- **Settings view**: `ValueRow` gains an optional `tap?: { name: string; title: string;
  ontap: () => void }` prop. When it is given, the `<output>` between − and + becomes
  `<button type="button" class="tap" aria-label={tap.name} title={tap.title}>{value}</button>`.
  Only the plain BPM row passes it.
- **Running and paused views**: `StatusBox` gains optional `tap?: { name; title; ontap }`. When
  it is given, the `.tempo` paragraph content (digits and unit) is wrapped in the same kind of
  button. Ratios Training and Speed Training pass nothing, so their markup stays byte-identical
  (FR-013).
- **Accessible name**: `m.metronome_tap_name({ bpm })` = `{bpm} BPM, tap tempo`. It starts with
  the visible text, per WCAG 2.5.3. The title is `m.metronome_tap_title()` = "Tap tempo".
- **Styling**: there is no new token. The button inherits the font, colour and size and has a
  transparent background. It has `min-block-size: var(--target-min)` and
  `min-inline-size: var(--target-min)` (SC 2.5.8), the shared `:focus-visible` ring, an
  `:active` pressed state (`opacity: var(--emph-dim-opacity)`), `cursor: pointer`, and
  `touch-action: manipulation`, so fast taps on touch are neither delayed nor zoomed.
- **Space on the focused button**: it taps, through the native `click`, and does not toggle
  Start/Pause. The existing `targetActivates` rule already returns `null` for Space on a button.
  Enter also taps through `click`.

**Alternatives considered**:
- A separate "Tap" button next to the value: the spec places the tap on the value itself.
- `role="button"` on the `<output>`: this needs hand-written key handling, and a native button
  is simpler and correct.

## R-07 Subdivision setting and run plan

**Decision**:
- **Type and settings**: `metronome-settings.ts` gains `PlainSubdivision = 1 | 2 | 3 | 4`,
  `PLAIN_SUBDIVISIONS`, and `toPlainSubdivision(v)`. `toPlainSubdivision` accepts the same
  inputs as `toSubdivision`, limited to 1–4.
- **Plain record**: `PlainSettings` gains `subdivision: PlainSubdivision`, with default 1.
- **Run plan**: `plainRunPlan` returns `clicksPerBeat: p.subdivision`.
- **Scheduler**: the cycle code already plays count-in slots as single accented clicks. Loop
  slots play `n` clicks: the first is `accent` on beat 1 and `normal` otherwise, and the rest
  are `sub` (the Ratios soft click) at `period / n` spacing. So FR-009 needs no change in the
  scheduler, and Quarter is exactly the 036 plan (FR-014).
- **Store**: `metronome.setPlainSubdivision(v)` works only in the settings phase and plain
  mode. Values outside 1–4 are ignored.
- **`sub` getter**: in plain mode it returns `subdivision > 1 ? subdivision : null`.
  `statusParams` already puts the count-in first, so the count-in status stays unchanged
  (FR-010).
- **Start announcement**: when the subdivision is not 1, the plain mode reuses the existing
  `metronome_announce_started` / `metronome_announce_started_count_in` strings ("Started,
  {bpm} BPM, {beats} beats, {subdivision}[, count in {count}]"), with
  `subdivision: subdivisionName(n)`. With Quarter it keeps the `_plain` strings. Those strings
  are exactly the old plain text followed by `, {name}`, in all three languages, so no new key
  is needed.

**Alternatives considered**:
- Reusing the 1–8 `Subdivision` type: the spec limits the plain mode to four choices.
- New `_plain_subdivision` announcement keys: their text would duplicate the existing keys
  word for word.

## R-08 Subdivision control

**Decision**: `SubdivisionSelect.svelte` gains an optional `options: readonly Subdivision[]`
prop, defaulting to `SUBDIVISIONS`. The plain settings view renders
`<SubdivisionSelect id="metronome-plain-subdivision" label={m.metronome_plain_subdivision_label()}
options={PLAIN_SUBDIVISIONS} …>` right after the # of Beats row and before Count In. It shows
only in the settings phase.

Option labels come from `subdivisionLabel(n)`: "Quarter notes (1)", "8th notes (2)", "8th
Triplets (3)" and "16th notes (4)". The new key is `metronome_plain_subdivision_label`:
"Subdivision" (en), "Subdivisão" (pt-BR), "Subdivisión" (es).

**Rationale**: FR-008. This is the same control as Ratios Training Loop 1. A `<select>` is
already the established pattern for this exact choice, so Principle VII ("main controls not
behind a menu") is read the way 032 read it.

**Alternatives considered**:
- A radio group: it looks different from the Ratios control, which contradicts the clarify
  answer.
- A new component: the existing one, with an `options` prop, covers both uses.

## R-09 Stored record

**Decision**:
- **Parse**: `plainSchema` gains
  `subdivision: v.fallback(v.picklist([1, 2, 3, 4]), 1)`. It accepts integer numbers only.
  Strings, 2.5 and 5 all read as 1, and the other plain fields keep their values. A missing
  `plain`, or a `plain` without `subdivision`, reads as before plus `subdivision: 1`.
- **Defaults**: `METRONOME_PLAIN_DEFAULTS` gains `subdivision: 1`. The parity test with
  `DEFAULT_PLAIN_SETTINGS` already exists.
- **Serialize**: the `plain` entry is written when the plain record is non-default.
  `subdivision` is written after `initialCountIn`, and only when it is not 1. A record with
  Quarter therefore serializes byte-identically to 036 (FR-014). A record that differs only in
  `subdivision: 3` writes `plain: { bpm, beats, countIn, initialCountIn, subdivision: 3 }`.
- **Version**: it stays at `version: 1`.
- **Fixtures**: two files are added:
  - `metronome-plain-subdivision.txt`: subdivision 3 with the other fields non-default.
  - `metronome-plain-subdivision-invalid.txt`: subdivision `"3"`. An invalid value reads as 1
    and the other fields are kept.
  
  The existing plain fixtures keep their files. Their expected parse gains `subdivision: 1` in
  `fixtures/index.ts`. This is the same treatment 037 gave its fixtures, and fixture files are
  only ever added.
- **Erase preferences**: it restores `DEFAULT_PLAIN_SETTINGS`, which includes `subdivision: 1`,
  through the existing `restore()` path.

**Alternatives considered**:
- Always writing `subdivision`: it changes the bytes of every stored plain record and the 036
  serializer tests for no gain.
- Accepting numeric strings when reading: no released build wrote strings, and the speed record
  is integer-only too.

## R-10 Interaction with Reset, tabs and route changes

**Decision**: `reset()`, `halt()` (used by `selectMode` and `screenChanged`) and `restore()`
clear `tapRun`. A tapped BPM that was already committed stays. Reset keeps values, as it does
today.

## R-11 Bundle and performance

**Decision**: The estimate is about +1.5 KB gzip:
- the pure tap module, about 30 lines;
- `retime`, about 40 lines;
- two optional props;
- one select;
- 4 catalog keys × 3 languages.

The bundle-size check gates it against 160 KB. `retime` is O(clicks in the horizon) per tap, at
most 4 × 8 = 32 pending sources at 300 BPM with 16ths (20 clicks/s × 1.5 s = 30), and it runs
only on a tap. 16ths at 300 BPM is 20 clicks per second, the same order as Ratios with 8
subdivisions at 150 BPM, which 032 already covers.

## R-12 Test strategy

| Layer | What | Where |
|---|---|---|
| Pure, table | SC-001 cases, the exactly-2000 ms gap, the 8-tap window, rounding half up, the 0-gap clamp, a clock going backwards | `tests/unit/metronome/tap-tempo.test.ts` (new) |
| Pure, property (fast-check) | For any gaps in [60000/300, 2000], the bpm is in 30–300. A constant gap g gives `clampBpm(60000/g)`. Taps 1–3 never return a bpm | same file |
| Scheduler | `retime` with the fake clock and port: click times before `S′` are unchanged; the cancelled sources are exactly those with slot ≥ `S′`; times after are `time(S′) + k × newPeriod (+ sub × newPeriod / n)`; one beat per slot; the count-in continues; ramp segments ignore it; retime before the anchor uses the new bpm. Property: for a random tap time, old bpm, new bpm and n, the sounded beat times are strictly increasing with no gap and no duplicate | `tests/unit/audio/metronome.test.ts` |
| Store | taps per phase; announcements; remember; a retime call while running; Reset/tab clearing the run; `setPlainSubdivision` guards; `sub` getter; Start announcement | `tests/unit/metronome/store.test.ts` |
| Keys | `'tap'` matrix: mode, shortcuts off, repeat, modifiers, select focused, disclosure open, Shift+T | `tests/unit/metronome/keys.test.ts` |
| Codec | parse and serialize of `subdivision`, fixtures | `tests/unit/prefs/schema.test.ts`, `fixtures/index.ts` |
| Components | ValueRow and StatusBox with and without `tap`; SubdivisionSelect `options`; panel wiring; About row | `value-row.test.ts`, `panel.test.ts`, new `status-box.test.ts`, `tests/unit/shortcut-list.test.ts` |
| E2E | US1 1–5 and 7 with `page.clock`; US1 6 running (the beat number keeps rising and the readout changes); US2 1–5 via the status line and `__fmAudioLog` click kinds and times; 320 px; axe | `e2e/metronome-tap-subdivision.spec.ts` (new) |
