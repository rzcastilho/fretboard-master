# Implementation Plan: Practice Timer

**Branch**: `039-practice-timer` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/039-practice-timer/spec.md`

## Summary

This slice adds a countdown **Timer card** above the metronome card on the Metronome page. It
has a stopwatch icon, the heading "Timer", preset pills `1m`–`10m`, a seven-segment-style
`MM:SS` readout and a round play/pause button. At zero it flashes and plays a short chime. The
timer is fully independent of the metronome.

**Approach**:
- **State**: a new module-level runes store, `src/lib/state/timer.svelte.ts`, backed by the
  pure `src/lib/state/timer-model.ts`.
  - It survives mode-tab switches and in-app navigation, because it is a module singleton.
  - It never imports the metronome store, and the metronome store never imports it. That makes
    FR-009 structural (R-01).
- **Timing**: the countdown is anchored to an absolute end time (`Date.now()` + remaining), so
  readings never drift and stay right after the page was hidden or the device slept (R-02).
  - A chained display tick fires just after each whole-second boundary.
  - A separate one-shot end timer is armed from the play gesture. Being unchained, it escapes
    Chrome's intensive throttling, so zero is detected within about 1 s even in a hidden tab
    (R-03).
- **Chime**: a synthesized 0.8 s two-partial tone in the new framework-free module
  `src/lib/audio/chime.ts`. It is played on the shared `AudioSink` (volume → mute chain) that
  the play gesture obtains through `playback.clickSink()`, so mute and volume apply and the
  metronome scheduler is untouched (R-04).
  - The chime plays only if zero is detected ≤ 2 s after the real end, and only on a running
    context. Otherwise the timer finishes silently (R-05).
- **Preset storage**: the preset persists as `metronome.timer` (1–10, written only when it is
  not 2) in the existing `version: 1` record, parsed with a Valibot fallback. The session's
  `remember` merges `metronome` one level deep, so the two stores never overwrite each other
  (R-06). Erase restores `2m` and stops any countdown (R-07).
- **UI**:
  - The pills are native toggle buttons (`aria-pressed`), so re-tapping the selected preset
    resets the countdown, and Space never toggles the metronome (R-08).
  - The readout is text over an `aria-hidden` `88:88` ghost layer (R-09).
  - The flash is store-driven (5 s), with a static highlight under reduced motion (R-10).
  - A polite region inside the card announces 10…1 and "Timer finished" (R-11).
  - The card has its own error boundary (R-12).

**Key assumptions and rejected alternatives**: every product question was settled by the
specify and clarify sessions. The remaining engineering choices are recorded in
[research.md](research.md) (R-01–R-12), each with its rejected alternatives. The two that
interpret the spec:
1. **Erase during a countdown**: Erase preferences stops a running countdown and resets it to
   `02:00` (R-07). Keeping it running was rejected, because the pill and the readout would
   disagree (FR-003).
2. **Preset button names**: each pill's accessible name is its visible text (`5m`), inside a
   group named "Timer length", rather than "5 minutes". This satisfies WCAG 2.5.3 (label in
   name). The expanded name was rejected because it does not contain the visible label (R-08).

Details: [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/),
[quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), Svelte 5 (runes), SvelteKit 2 with
`adapter-static`

**Primary Dependencies**:
- Paraglide JS (9 new catalog keys) and Valibot 1 (the `metronome.timer` field), both
  existing.
- Web Audio through the existing `playback.clickSink()` / `AudioSink`.
- There is no new runtime dependency.

**Storage**: `localStorage` through `src/lib/prefs`, in the record `fretboard-master:prefs` at
`version: 1`. The `metronome` entry gains an optional `timer` integer 1–10.

**Testing**:
- Vitest + fast-check:
  - the pure model (tables and properties: formatting, rounding, tick delay);
  - the store, under an injected fake clock, sink and chime;
  - chime synthesis and routing, with the existing fake `AudioPort`;
  - the prefs codec and fixtures, and the session's one-level merge;
  - the `TimerCard` component under jsdom.
- Playwright + @axe-core/playwright, on the desktop project locally. Time is made
  deterministic with `page.clock`, and the chime and clicks are observed through the
  test-build `__fmAudioLog`.

**Target Platform**: Evergreen desktop browsers in windows 1024–2560 CSS px. The page reflows
down to 320 px, and phones are not blocked.

**Project Type**: Static web app (a single SvelteKit project).

**Performance Goals**:
- At most one O(1) state update per second while running, and no work when idle.
- Zero is detected within about 1 s of the real end, visible or hidden (SC-002, SC-003).
- No cumulative drift over 10 minutes (FR-012).
- The metronome's click scheduling path is untouched.

**Constraints**:
- Initial JS ≤ 160 KB gzip, with about +2 KB estimated (R-12).
- Tokens only. There are 6 new tokens (data-model §6). The secondary accent must not reuse the
  fifth marker colour.
- Every string in en, pt-BR and es.
- `src/lib/audio` stays framework-free.
- With the default `2m`, the stored bytes are identical to 038.
- Works offline, with no network use.

**Scale/Scope**:
- **New modules (4)**: `timer-model.ts`, `timer.svelte.ts`, `chime.ts` and
  `TimerCard.svelte`.
- **Edits**:
  - `MetronomeLayout.svelte`;
  - `prefs/schema.ts` and `prefs/session.ts`;
  - `state/preferences.svelte.ts`;
  - `audio/types.ts` (the log entry);
  - `styles/tokens.css`;
  - the 3 catalogs.
- **Tests**: one new e2e spec, `e2e/metronome-timer.spec.ts`, plus refreshed Metronome
  screenshot baselines (from CI).

## Constitution Check

*GATE: must pass before Phase 0 research, and re-checked after Phase 1 design. Result: PASS.
There is no new violation. The 036 deviation (the first visit opens on Ratios) is carried
forward unchanged and is not widened.*

- [x] **I. Musical Correctness**: N/A for theory. The feature shows and plays no notes,
  intervals or shapes, and `src/lib/theory` is untouched. The chime is a signal tone, not a
  musical note the product teaches. Its partials are fixed constants checked by unit test (A3).
- [x] **II. On-Device, Static, Private**:
  - Everything runs in the browser and works offline (quickstart scenario 28).
  - Only the preset is stored, locally, and Erase clears it (C34).
  - There is no share-link field (C35), no measurement event and no device permission.
  - The existing privacy text already covers "metronome settings".
- [x] **III. Pure Core, Thin Shell**:
  - The arithmetic is in the pure `timer-model.ts`.
  - The state is in a runes store in `src/lib/state`, outside the component.
  - The chime synthesis and playback are in framework-free `src/lib/audio/chime.ts`.
  - `TimerCard.svelte` only renders and calls `toggle()` and `selectPreset()`.
  - `src/lib/theory` is untouched.
- [x] **IV. Test-First**:
  - The model, store, chime and prefs codec are written test-first against the contract
    guarantees (M1–M6, S1–S15, A1–A9, C27–C35).
  - Every acceptance scenario maps to a quickstart row with an automated test.
  - Timing is tested only through an injected fake clock (unit) and `page.clock` (e2e). Audio
    is tested through the fake `AudioPort` and the test-build audio log.
- [x] **V. Accessible**:
  - **Controls**: native buttons, with visible focus and logical DOM order. Pills are at least
    24 px and the play button is at least 44 px (2.5.8).
  - **Selection**: shown by `aria-pressed` plus weight and border width, not colour alone.
  - **Readout**: `role="timer"`, not live.
  - **Announcements**: a polite region announces only 10…1 and zero (FR-013).
  - **Reduced motion**: a static finished state with no animation. The flash runs at 2 state
    changes per second, under the 2.3.1 threshold.
  - **Sound**: not the only carrier of the end, because the visual finished state is always
    shown.
  - **Checks**: zero axe violations and 320 px / 200 % reflow are tested (U8–U11).
- [x] **VI. Performance Budgets**:
  - There is no dependency, and about +2 KB gzip is gated by the bundle-size check.
  - There is no work at load beyond rendering the card, and no AudioContext before a gesture.
  - The one-second tick is O(1).
  - Tap-to-sound and click scheduling are unchanged.
  - The card has a fixed size from first paint (tabular digits, fixed button size), so it adds
    no layout shift (CLS ≤ 0.1).
- [x] **VII. Design System Fidelity**:
  - Tokens only, with 6 new tokens (data-model §6). The secondary accent is a new role token,
    distinct from the reserved root, third and fifth colours (`reserved-colors.test.ts`).
  - No error red.
  - The card opens in its simplest state (`2m`, stopped).
  - No reward mechanics or confetti: the finished flash is a plain state change.
  - Checked at 1024 px, 2560 px, 320 px and 200 % text zoom.
  - The fretboard is not involved (Metronome page).
- [x] **VIII. International**:
  - 9 new keys in all three catalogs (data-model §5), including the accessible names and
    announcements.
  - Digits use tabular numerals from the system stack.
  - No note names.
- [x] **IX. Untrusted Input, Versioned Formats**:
  - `metronome.timer` is parsed with `v.fallback(intIn([1, 10]), 2)`. Invalid values fall back
    without touching other fields, and parsing never throws (C29).
  - `version: 1` is kept, because the field is additive and optional.
  - Three fixtures are added and none are changed.
  - Share links are untouched.
- [x] **X. Simplicity**:
  - One store, one pure model, one audio helper and one component.
  - The existing `AudioSink`, `FailureView` and token sheet are reused.
  - No speculative abstraction: there are no custom durations and no shared "countdown"
    utility.
  - "Never blank": invalid storage falls back to `2m`, audio failure still shows the visual
    end, and the card has its own error boundary.

**Post-design re-check** (after Phase 1):
- The artifacts add no dependency and no new directory. Every new file goes in an existing
  directory (see Structure Decision).
- The theory, instrument, fretboard and link modules are untouched.
- `metronome.svelte.ts` and `src/lib/audio/metronome.ts` are not edited, so FR-009 cannot
  regress through them. Independence is still asserted by S13, S15 and e2e scenarios 8–11.
- The one shared-code change, the one-level `metronome` merge in `session.remember`, is
  backward compatible: existing callers pass the whole object (C32).

The gate still passes.

## Project Structure

### Documentation (this feature)

```text
specs/039-practice-timer/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01 … R-12
├── data-model.md        # Phase 1: preset, countdown state machine, stored record, chime, catalog, tokens
├── quickstart.md        # Phase 1: commands, validation scenarios 1–28, manual checks
├── contracts/
│   ├── timer-store-api.md       # pure model M1–M6 and store S1–S15
│   ├── chime-api.md             # renderChime / playChime A1–A9
│   ├── preferences-record.md    # metronome.timer codec C27–C35, fixtures
│   └── timer-card-ui.md         # card structure, a11y, layout U1–U13
├── checklists/          # from /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib/state/
├── timer-model.ts             # NEW: pure — presets, secondsLeft, formatReadout, nextTickDelay, shouldChime, announcementFor
├── timer.svelte.ts            # NEW: runes store `timer` + resetTimerForTests (injectable clock/sink/chime)
└── preferences.svelte.ts      # start(): timer.restore(p.metronome.timer); erase(): timer.restore(2)

src/lib/audio/
├── chime.ts                   # NEW: renderChime(sampleRate), playChime(sink, lateMs)
└── types.ts                   # AudioLogEntry gains { type: 'chime', when, contextTime, lateMs }

src/lib/prefs/
├── schema.ts                  # Preferences.metronome.timer; METRONOME_TIMER_DEFAULT; METRONOME_LIMITS.timer; parse/serialize
└── session.ts                 # PreferencesPatch.metronome partial; one-level merge in remember()

src/lib/tools/metronome/
├── TimerCard.svelte           # NEW: heading + icon, preset group, readout, play/pause, polite region
└── MetronomeLayout.svelte     # renders <TimerCard /> in its own boundary before the panel

src/lib/styles/
└── tokens.css                 # --color-accent-secondary (+contrast/forced variants), --timer-* tokens

messages/
├── en.json                    # 9 timer_* keys
├── pt-BR.json
└── es.json

tests/unit/
├── metronome/timer-model.test.ts    # NEW: M1–M6 (tables + fast-check)
├── metronome/timer-store.test.ts    # NEW: S1–S15 (fake clock, fake sink/chime)
├── metronome/timer-card.test.ts     # NEW (jsdom): U1–U5, U7, U12
├── audio/chime.test.ts              # NEW: A1–A9 (fake AudioPort)
├── prefs/schema.test.ts             # C27–C31, C33 + fixtures
├── prefs/fixtures/metronome-timer*.txt  # NEW fixtures (3)
├── prefs/session.test.ts            # C32
└── state/preferences-store.test.ts  # C34

e2e/
├── metronome-timer.spec.ts          # NEW: quickstart scenarios 1–6, 8–25, 27, 28
└── metronome.spec.ts-snapshots/     # baselines refreshed via update-snapshots.yml (card now above panel)
```

**Structure Decision**: this is a single SvelteKit project, and the feature uses only
directories that already exist:
- `src/lib/state`, `src/lib/audio`, `src/lib/prefs`, `src/lib/tools/metronome` and
  `src/lib/styles`;
- `messages/`;
- `tests/unit/{metronome,audio,prefs,state}` and `e2e/`.

No new directory or route is created. The route `src/routes/metronome/+page.svelte` is
unchanged, because it already renders `MetronomeLayout`.

## Complexity Tracking

There is no constitution violation to justify.

The pre-existing 036 deviation (the first visit opens on Ratios Training) is carried forward
unchanged. The decisions that interpret the spec are recorded in the Summary ("Key
assumptions") and in [research.md](research.md), each with its rejected alternative.
