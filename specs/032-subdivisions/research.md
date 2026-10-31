# Research: Subdivisions (032)

Phase 0 for `specs/032-subdivisions/spec.md`. The spec's Clarifications session answered every
product question, so Technical Context had no open unknowns. This file records
the technical decisions the plan rests on and the alternatives rejected. Each item follows
Decision / Rationale / Alternatives.

Sources: the 031 code (`src/lib/audio/metronome.ts`, `click.ts`, `src/lib/state/metronome*.ts`,
`src/lib/tools/metronome/*`), ADR 0028 (control families and style lint), ADR 0030 (click
scheduler), the constitution 2.0.0.

---

## R-01 Grid: one integer index per click, period divided by *n*

- **Decision**: Keep a single click index `j` per segment and change the click time to
  `anchor + (j × period) / n`, where `period = 60 / BPM` and `n` is the clicks per beat (1–8).
  The beat a click belongs to is `slot = floor(j / n)`, and it is a beat click when
  `j mod n = 0`. `clickAt(seg, j)` returns `{ index, when, beat, slot, kind }` with
  `kind ∈ 'accent' | 'normal' | 'sub'`. The time is computed from the integer `j` on every call;
  nothing is accumulated (FR-008).
- **Rationale**: This is the 031 formula with `n = 1` as a special case, so Quarter notes behave
  exactly as before (edge case "behaviour matches the metronome before this feature"). One index
  keeps the existing `next`, `skipTo`, `pending` and the (run, index) duplicate check in the e2e
  log unchanged in shape. The floating error of `(j × period) / n` after 10 minutes at 300 BPM ×
  8 (24 000 clicks) is about 10⁻¹² s, far below the 2 ms tolerance.
- **Alternatives**:
  - Two nested schedules (beat grid plus an inner sub-grid per beat): two indices to keep in
    step, more state at Pause and skip-forward, no benefit.
  - Accumulating `when += period / n`: forbidden by FR-008 and drifts.
  - Scheduling a beat's soft clicks as one pre-rendered buffer: Pause could not stop a single
    soft click at the Pause instant (FR-010) and mute/volume would still apply but cancellation
    granularity would be lost.

## R-02 Beat updates follow the beat slot, never a soft click

- **Decision**: The frame loop computes the latest audible grid index `k` as today, maps it to
  `slot = floor(k / n)`, and calls `onBeat(beat)` only when `slot` grows past the last reported
  slot. `halt()` returns the beat of the last audible slot. After skip-forward the next report
  is the slot whose beat click time was last reached (FR-007, FR-010, FR-015).
- **Rationale**: Soft clicks then cannot light a dot or change the status text, and pausing
  between beat 3's soft clicks freezes on beat 3, which the store already turns into
  "resume on beat 4". The store's `resume()` (`startBeat = beat % beats + 1`) needs no change.
- **Alternatives**: Emitting an `onClick` per grid click and filtering in the store: more
  events per second on the main thread (40/s at the extreme) for no use.

## R-03 Soft click sound

- **Decision**: Add a third `ClickKind` `'sub'` to `click.ts`: a sine burst built the same way
  as the others (1 ms attack, exponential decay to 0.5 %), **2400 Hz**, peak **0.25**,
  length **18 ms**. Lengths become per kind (`CLICK_LENGTH_S`: accent 0.03, normal 0.03,
  sub 0.018); `CLICK_S` stays the longest length (0.03) and keeps its role in pruning `pending`.
  `buffersFor(sink)` renders three buffers once per sink.
- **Rationale**: Peak 0.25 ≤ 0.275 (half the normal 0.55); 2400 Hz differs from 1600 Hz and
  1000 Hz and sits above both, so the beat click stays the lower, louder and longer anchor;
  18 ms ≤ 20 ms leaves 7 ms of silence between soft clicks at the 25 ms spacing of 300 BPM 32nds
  (FR-005, FR-009). Every click is its own `AudioBufferSourceNode`, so a beat click's 30 ms tail
  overlapping the first soft click 25 ms later is mixed, never truncated.
- **Alternatives**:
  - Same pitch as the normal click at lower gain: harder to tell beat from subdivision at speed.
  - Noise burst / sample file: sample files are forbidden (C II); noise is harsher and less
    distinct at 40/s.
  - Lowering the pitch below 1000 Hz: low sine bursts of 18 ms are a few cycles long and sound
    like a thump.

## R-04 Horizon and pending sources at 40 clicks/s

- **Decision**: Keep `HORIZON_S = 1.5` and `TICK_MS = 25`. At 300 BPM × 8 the scheduler keeps
  up to about 60 sources pending; `halt()` stops every one whose `when` is after now.
- **Rationale**: 60 tiny buffer sources is trivial for Web Audio. A shorter horizon would weaken
  the "gap-free with main-thread timers at 1 Hz" guarantee from 031 (hidden tab).
- **Alternatives**: Shrinking the horizon for dense subdivisions: added branching, and hidden
  tabs throttle timers to 1 Hz, which needs > 1 s of lookahead.

## R-05 Settings model: subdivision as clicks-per-beat integer

- **Decision**: `MetronomeSettings` gains `subdivision: Subdivision` where
  `type Subdivision = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8`. `SUBDIVISIONS` is the ordered tuple
  `[1, 2, 3, 4, 5, 6, 7, 8]`, `DEFAULT_SETTINGS.subdivision = 3`, and `toSubdivision(v)`
  returns the integer when it is one of the eight, else `null` (the store ignores `null`).
  `SettingField` narrows to `'bpm' | 'beats'` because the stepper maths does not apply.
- **Rationale**: The spec fixes the integer as the stable identifier for slice 005
  (remembered settings). The option order equals the numeric order, so the list is the tuple.
- **Alternatives**: A string enum (`'triplets8'`, …): a second identifier to map to the count
  that the status line and scheduler need anyway.

## R-06 Control: a native `<select>` with scoped styles

- **Decision**: New component `src/lib/tools/metronome/SubdivisionSelect.svelte`:
  `<label for="metronome-subdivision">Loop 1</label>` above a wrapper holding
  `<select id="metronome-subdivision">` and an `aria-hidden` chevron SVG drawn in
  `currentColor`. The select uses `appearance: none`, `inline-size: 100%`,
  `min-block-size: var(--target-min)`, `--color-surface-raised` background, `--color-text`
  text, `--color-border` border, `--radius-md`, and the global `:focus-visible` ring. Under
  `forced-colors: active` it restores `appearance: auto` and hides the SVG so the system arrow
  shows. Each `<option value="n">` reads `{name} ({n})`.
- **Rationale**: Native keyboard and screen-reader support (US2-4), no dependency, the visible
  label is the accessible name via `for`/`id`. ADR 0028 families cover buttons, toggles,
  switches, steppers and link-buttons; there is no select family, and this is the app's only
  select, so a new global family would be a one-use abstraction (C X). The style lint still
  applies: tokens only, no literals.
- **Alternatives**:
  - A custom listbox (button + popup): needs focus management, typeahead and ARIA wiring the
    native control already has.
  - A `.select` family in `controls.css`: rejected until a second select exists.
  - Radio chips (`.chips`): eight options with long Portuguese/Spanish names do not fit a
    36 rem panel at 320 px, and the brief asks for a dropdown.

## R-07 Status line composition and wrapping

- **Decision**: `StatusBox` renders the existing `BEAT` message, then `summary_separator`
  (`" · "`), then a new message `metronome_status_sub` = `"SUB {count}"` (same in all three
  languages). Each half sits in its own `white-space: nowrap` span, so the only break
  opportunity is the space around the separator (FR-006, FR-014). `statusParams` gains
  `sub: number`.
- **Rationale**: Reuses the translated `BEAT`/`TEMPO`/`TIEMPO` messages and the existing
  separator token; the line remains real text.
- **Alternatives**: Changing `metronome_status_beat` to include the suffix: would duplicate the
  `none` variant and the separator in every catalog.

## R-08 Messages

- **Decision**: New keys `metronome_subdivision_label`, `metronome_subdivision_option`
  (`"{name} ({count})"`), `metronome_subdivision_1` … `metronome_subdivision_8`,
  `metronome_status_sub`. `metronome_announce_started` gains `{subdivision}`:
  "Started, {bpm} BPM, {beats} beats, {subdivision}" and translations. The identical-values
  allowlist (`tests/unit/i18n/identical-allowlist.ts`) gains `metronome_status_sub` and
  `metronome_subdivision_option` in `SHARED`, and `metronome_subdivision_label` for pt-BR only
  ("Loop 1"). `metronome_subdivision_8` ("Fusas") differs from English, so no entry.
  Names are mapped from the integer by `subdivisionName(n)` in
  `src/lib/state/metronome-subdivision-names.ts` (a `Record<Subdivision, () => string>` over
  `m.*`), used by the store's announcement and the select.
- **Rationale**: Paraglide compiles each key separately; a record of message functions keeps
  tree-shaking and lets a new language add only catalog files (C VIII).
- **Alternatives**: One message with a `select` on the count: Paraglide's plural/select support
  would put eight names in one string per language, harder to review by native speakers.

## R-09 Logging for e2e

- **Decision**: The test-build `click` log entry gains `kind: ClickKind` and `slot: number`;
  `accent` stays (`kind === 'accent'`) so 031 tests keep passing. Soft clicks log the owning
  `beat`.
- **Rationale**: Playwright verifies per-beat counts, spacing and Pause cancellation from the
  log without real audio (C IV).
- **Alternatives**: Inspecting audio output in the browser: non-deterministic.

## R-10 Bundle and performance

- **Decision**: No new dependency. Expected growth under 1.5 KB gzip (one component, three
  small functions, 11 message keys × 3 languages, of which only the active locale's strings are
  in the initial path per Paraglide's per-locale modules). Measured by `pnpm verify`'s bundle
  check at the end of the slice; budget 150 KB unchanged.
- **Rationale / Alternatives**: none needed beyond the measurement.

## R-11 ADR

- **Decision**: Append a "Revision (032 subdivisions)" section to
  `docs/adr/0030-metronome-click-scheduler.md` recording the `j / n` grid, slot-based beat
  reporting, the third click kind, and the up-to-60-pending consequence. No new ADR.
- **Rationale**: The change refines the existing scheduling decision rather than adding a new
  architectural one.
