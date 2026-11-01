# Implementation Plan: Tap Tempo and Metronome Subdivisions

**Branch**: `038-tap-tempo-and-metronome-subdivisions` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/038-tap-tempo-and-metronome-subdivisions/spec.md`

## Summary

This slice adds two optional extras to the plain **♩ Metronome** mode only.

**Tap tempo**:
- **Where you tap**: the BPM value in the settings pill, and the large `{bpm} BPM` readout
  while running or paused, both become a button named `{bpm} BPM, tap tempo`. The `T` key also
  taps. It obeys the 027 shortcuts switch and the usual guards.
- **The maths**: a pure module, `src/lib/state/tap-tempo.ts`, turns a run of taps into a BPM.
  Taps 1–3 change nothing. From tap 4 on, the BPM is 60000 divided by the mean gap of the last 8
  taps, rounded half up and clamped to 30–300. A gap over 2 s starts a new run (R-01).
- **Live change**: while running, the click scheduler gains `retime(bpm)`. It cancels
  already-scheduled clicks from the first beat that starts at least `START_LEAD_S` ahead, then
  re-anchors the grid at that beat's unchanged time with the new period. The loop never
  restarts, its phase and position are kept, and the new tempo is heard by the second beat at
  the latest (R-03, SC-003).

**Subdivision**:
- **The control**: a "Subdivision" drop-down after # of Beats. It reuses Ratios Training's
  `SubdivisionSelect`, limited to Quarter, 8ths, Triplets and 16ths.
- **Playback**: the choice feeds `clicksPerBeat` of the plain run plan. The existing cycle
  engine already plays the beat click, then the Ratios soft clicks evenly spaced, with a
  one-click-per-beat count-in (R-07).
- **Status**: the line gains `· SUB k`.

**Storage**: the subdivision persists as an optional `metronome.plain.subdivision` at
`version: 1`. It is written only when it is not 1, so a Quarter record serializes exactly as
before (R-09).

**Unchanged**: Ratios Training and Speed Training.

Details: [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/),
[quickstart.md](quickstart.md).

**Key assumptions**: every spec question was settled by the specify and clarify sessions. The
remaining engineering choices, each with its rejected alternative, are listed under
"Assumptions and rejected alternatives" below.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), Svelte 5 (runes), SvelteKit 2 with
`adapter-static`

**Primary Dependencies**: Paraglide JS (catalog) and Valibot 1 (preferences schema). There is no
new runtime dependency.

**Storage**: `localStorage` through `src/lib/prefs`, in the record `fretboard-master:prefs` at
`version: 1`. The `metronome.plain` entry gains an optional `subdivision`.

**Testing**:
- Vitest + fast-check: the tap maths (table and property), scheduler retime (fake clock and
  port, property), keys, store, codec and fixtures, and components under jsdom.
- Playwright + @axe-core/playwright, on the desktop project locally. Taps are made
  deterministic with `page.clock`.

**Target Platform**: Evergreen desktop browsers in windows 1024–2560 CSS px. The page reflows
down to 320 px, and phones are not blocked.

**Project Type**: Static web app (a single SvelteKit project).

**Performance Goals**:
- Click timing stays exact across a retime: clicks before `S′` keep their times, and clicks
  from `S′` on are `T(S′) + k × T_new`. The new tempo is audible by the second beat after a tap.
- Soft clicks are within 10 ms of an even split (SC-004). The grid is exact.
- 16ths at 300 BPM give 20 clicks/s with no drift.
- A tap does O(pending) work, at most about 30 sources.

**Constraints**:
- Initial JS ≤ 160 KB gzip, with about +1.5 KB estimated (R-11).
- Design tokens only, and no new token.
- Every string in en, pt-BR and es: 4 new keys.
- `src/lib/audio` stays framework-free.
- With Quarter and no tapping, plain behaviour and the stored bytes are identical to 037
  (FR-014).

**Scale/Scope**:
- One new source module: `tap-tempo.ts`.
- Edits to:
  - 1 audio module: `metronome.ts`, plus the `click-cancel` reason in `types.ts`;
  - 3 state modules: `metronome-settings.ts`, `metronome-keys.ts`, `metronome.svelte.ts`;
  - the prefs schema;
  - 4 components: `ValueRow`, `StatusBox`, `SubdivisionSelect`, `MetronomePanel`;
  - `ShortcutList`;
  - 3 catalogs.
- One new e2e spec, plus updates to the plain-mode screenshots and `metronome-remembered.spec.ts`.

## Constitution Check

*GATE: must pass before Phase 0 research, and re-checked after Phase 1 design. Result: PASS.
There is no new violation. The 036 deviation (the first visit opens on Ratios) is carried
forward unchanged.*

- [x] **I. Musical Correctness**: N/A for theory. The feature shows and plays no notes,
  intervals or shapes, and `src/lib/theory` is untouched. Its correctness is tempo and grid
  arithmetic, which is covered by table and property tests (T1–T11, E11–E20).
- [x] **II. On-Device, Static, Private**:
  - Everything runs in the browser, and tap timing uses the local clock.
  - The subdivision and tapped BPM live only in the local preferences record, and Erase clears
    them (C26).
  - There is no share-link field, no measurement event and no privacy-text change (FR-012).
  - There are no device permissions.
- [x] **III. Pure Core, Thin Shell**:
  - The tap maths is a pure module, and the settings helpers stay pure.
  - `retime` lives in the framework-free audio module.
  - State lives in the store, and components only call `tapTempo()` and
    `setPlainSubdivision()`.
  - The key matcher stays pure and DOM-free.
- [x] **IV. Test-First**:
  - The tap module, scheduler retime, codec and store are built test-first from the contract
    guarantees.
  - Every acceptance scenario maps to a quickstart row with a unit or e2e test.
  - Timing is tested only through the injectable fake clock and port, and `page.clock` in e2e.
- [x] **V. Accessible**:
  - **Tap button**: a native button that works with pointer, Enter and Space. Its name begins
    with the visible text (2.5.3), its target is `--target-min` (2.5.8), and it has the visible
    focus ring.
  - **`T` key**: it can be turned off with the 027 switch (2.1.4).
  - **Announcements**: tap changes go to the existing polite status region, once per change.
    Sound is not the only carrier, because the status shows `· SUB k`.
  - **Checks**: zero axe violations and 320 px reflow (contracts/tap-subdivision-ui.md §6).
- [x] **VI. Performance Budgets**:
  - There is no dependency, and about +1.5 KB gzip is gated by the bundle-size check.
  - The lookahead, horizon and tap-to-sound path are unchanged when the user does not tap.
  - `retime` runs only on a tap.
- [x] **VII. Design System Fidelity**:
  - Tokens only, with no new token.
  - The tool still opens in its simplest state: Quarter is the default, and tap tempo is
    invisible until used.
  - No overlay tutorial or tap counter.
  - The Subdivision control is the same select pattern as Ratios Training (032).
  - 1024 px, 2560 px, 320 px and 200 % text zoom are checked in three languages.
  - The 036 Complexity Tracking entry still applies and is not widened.
- [x] **VIII. International**:
  - 4 new keys in all three catalogs (data-model §6).
  - The subdivision names, `SUB {count}`, the separator, the BPM unit and the Start strings
    are reused.
  - No note names are involved.
- [x] **IX. Untrusted Input, Versioned Formats**:
  - `plain.subdivision` is parsed with a Valibot picklist fallback, so invalid values read as
    Quarter, the other fields are kept, and parsing never throws (C19–C21).
  - `version: 1` is kept.
  - Two fixtures are added. Existing fixture files are unchanged, and only their expected
    parse gains the default field.
  - Share links are untouched.
- [x] **X. Simplicity**:
  - The existing scheduler, store, select and value row are extended rather than duplicated.
  - `SubdivisionSelect`'s new `options` prop has two real uses (Ratios with 1–8, plain with
    1–4).
  - `retime` exists for one feature but is the minimal primitive. Halting and restarting
    fails FR-007 (R-03).
  - Nothing speculative is added: no live subdivision changes, no tap in other modes.
  - "Never blank": invalid stored values fall back.

Post-design re-check:
- The Phase 1 artifacts add no dependency, no new directory and no design token.
- The theory, instrument, fretboard and link modules are untouched.
- The periodic scheduler path is byte-identical when `retime` is never called (E20).
- The 031 FR-023 rule ("no character-key shortcuts on the Metronome") is amended by this
  spec's FR-005, for the plain mode only. This is a spec-level change, not a constitutional
  one, and it is listed in the PR.

The gate still passes.

## Project Structure

### Documentation (this feature)

```text
specs/038-tap-tempo-and-metronome-subdivisions/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01 … R-12
├── data-model.md        # Phase 1: tap run, plain settings, grid retime, store, record, catalog
├── quickstart.md        # Phase 1: commands, validation scenarios 1–24, manual checks
├── contracts/
│   ├── tap-tempo-api.md         # pure tap(): guarantees T1–T11
│   ├── click-engine-api.md      # ClickScheduler.retime: algorithm, guarantees E11–E20
│   ├── metronome-store-api.md   # tapTempo, setPlainSubdivision, sub: guarantees S15–S25
│   ├── preferences-record.md    # plain.subdivision codec: C19–C26, fixtures
│   └── tap-subdivision-ui.md    # tap buttons, T key, Subdivision row, announcements, About
├── checklists/          # from /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib/audio/
├── metronome.ts               # ClickScheduler.retime(bpm); pendingBpm; firstScheduled guard
└── types.ts                   # click-cancel reason gains 'retime' (test-build log only)

src/lib/state/
├── tap-tempo.ts               # NEW: TapRun, tap(), TAP_WINDOW / TAP_MIN_TAPS / TAP_MAX_GAP_MS
├── metronome-settings.ts      # PlainSubdivision, PLAIN_SUBDIVISIONS, toPlainSubdivision;
│                              #   PlainSettings.subdivision; plainRunPlan uses it
├── metronome-keys.ts          # 'tap' action; ctx { mode, shortcuts }
└── metronome.svelte.ts        # tapTempo(), setPlainSubdivision(), sub for plain, tap run
                               #   cleared on reset/halt/restore; Start announcement

src/lib/prefs/
└── schema.ts                  # METRONOME_PLAIN_DEFAULTS.subdivision; plainSchema picklist;
                               #   serialize subdivision when ≠ 1

src/lib/tools/metronome/
├── ValueRow.svelte            # optional `tap` prop: the value becomes a button
├── StatusBox.svelte           # optional `tap` prop: the tempo becomes a button
├── SubdivisionSelect.svelte   # optional `options` prop
└── MetronomePanel.svelte      # plain Subdivision row; tap props in plain mode; T dispatch

src/lib/shell/
└── ShortcutList.svelte        # Metronome list: T "Tap tempo (Metronome mode)"

messages/{en,pt-BR,es}.json    # 4 new keys (data-model §6)

tests/unit/metronome/          # NEW tap-tempo.test.ts, status-box.test.ts; keys, store,
                               #   panel, value-row, settings tests extended
tests/unit/audio/metronome.test.ts   # retime cases and property
tests/unit/prefs/              # schema.test.ts; fixtures/index.ts + 2 new fixture files
tests/unit/shortcut-list.test.ts     # T row
e2e/metronome-tap-subdivision.spec.ts  # NEW: quickstart rows 1–4, 6–8, 10, 12–15, 22–23
e2e/metronome-remembered.spec.ts       # subdivision survives reload; Ratios unaffected
e2e/metronome-modes.spec.ts            # no tap button / no T in Ratios and Speed
e2e/metronome.spec.ts                  # plain-mode baselines regenerated (Subdivision row)
```

**Structure Decision**: This is a single SvelteKit project, and it uses existing directories
only:

- `src/lib/audio`, `src/lib/state`, `src/lib/prefs`, `src/lib/tools/metronome`,
  `src/lib/shell` and `messages`;
- `tests/unit/metronome`, `tests/unit/audio` and `tests/unit/prefs`;
- `e2e`.

No new directory is created. The link codec (`src/lib/link`), theory, instrument, fretboard,
the route `src/routes/metronome`, `metronome-cycle.ts`, `metronome-ramp.ts` and the Ratios and
Speed components are not modified.

## Implementation notes

1. **Order** (test-first):
   1. `tap-tempo.ts`.
   2. The settings types and `plainRunPlan`.
   3. The codec and fixtures.
   4. `retime` in the scheduler.
   5. The key matcher.
   6. The store (`tapTempo`, `setPlainSubdivision`, `sub`, announcements, clearing).
   7. The catalogs.
   8. `SubdivisionSelect` options, `ValueRow` and `StatusBox` tap props.
   9. `MetronomePanel` wiring.
   10. `ShortcutList`.
   11. The e2e spec.
   12. Screenshots.
2. **Retime test harness**: build on the existing fake audio port. Record the start and stop
   calls of each source, and assert the set of sources that were started and never stopped.
   That set is what is heard. A fast-check property drives random sequences of
   (advance clock, retime bpm) and checks E14.
3. **Tap button markup**: `ValueRow` and `StatusBox` render the button only when `tap` is
   passed, so Ratios and Speed markup and their baselines stay unchanged. The button's
   `aria-label` is reactive (`{bpm} BPM, tap tempo`). The pill `<output>` is replaced only in
   plain mode.
4. **`T` dispatch** lives in `MetronomePanel.onKeydown`, next to Space and Escape, reading
   `shortcuts.enabled` from `$lib/state/shortcuts.svelte`.
5. **E2E timing**: every tap scenario, including the running one, installs `page.clock`
   before navigation and advances it with `runFor(500)` between taps, so no e2e check depends
   on wall-clock time. The tap time comes from `performance.now()`, which `page.clock` fakes,
   so the readout is exactly the tapped value (120 for four taps 500 ms apart). The running
   scenario starts at 100, advances the fake clock to BEAT 2, taps, and asserts continuity:
   the beat never returns to 1, and `__fmAudioLog` has a `click-cancel` entry with
   `reason: 'retime'`. The exact retimed click times are checked only in the unit tests
   (E11–E15, S18) on the fake clock and port.
6. **Snapshots**: the plain settings baselines change (new Subdivision row) and are
   regenerated through `update-snapshots.yml`. The desktop baseline is regenerated locally only
   with `-g "metronome plain-mode views"`.

## Assumptions and rejected alternatives

| Assumption / decision | Rejected alternative | Why rejected |
|---|---|---|
| A live tempo change cancels the scheduled clicks from `S′` on and re-anchors at `T(S′)` (R-03) | Apply the change at the first click not yet scheduled | The 1.5 s horizon would delay the change by up to 7 beats at 300 BPM, which fails SC-003 |
| Same as above | Halt and restart the segment | Re-anchoring shifts the phase, can add a gap, and drops the sub-clicks of the playing beat (FR-007) |
| The tap time comes from the store's injectable clock (R-02) | `event.timeStamp` | It cannot be faked in Playwright, so SC-001 e2e checks would be flaky |
| `subdivision` is written only when ≠ 1 (R-09) | Always writing it | It changes the stored bytes of every plain record and the 036/037 serializer expectations, against FR-014 |
| Stored `subdivision` must be an integer; strings read as Quarter | Accepting numeric strings | No build ever wrote strings, and the Speed record is integer-only too (C21) |
| The tap announcement reuses `{bpm} {metronome_bpm_unit}`, and Start reuses the existing `metronome_announce_started[_count_in]` strings (R-04, R-07) | New announcement keys | The existing strings say exactly the required text in all three languages |
| `T` respects the 027 switch, while Space and Escape do not (R-05) | Putting Space and Escape under the switch too | Out of scope. The spec changes only `T`, and Space and Escape are not character-key shortcuts under WCAG 2.1.4 |
| The readout shows the tapped value at once, and the sound follows at `S′` (R-04) | Delaying the readout until `S′` | It adds state for a gap of under two beats. The spec says each tap "updates the visible readout" |

## Complexity Tracking

There is no new violation. One deviation is carried forward from 036 without change:

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| VII "Each tool opens in its simplest state": with nothing remembered, the tool still opens on Ratios Training (inherited from 036 FR-014) | It was approved in 036. This slice does not widen it: the new extras default to their simplest state (Quarter, no tap) and are confined to the plain mode | Switching the default mode is out of scope and would break "a stored record written before this feature MUST read as before" (FR-011). It is listed again in the PR description for reviewer visibility |
