# Quickstart: Practice Timer — validation guide

**Feature**: `039-practice-timer` | **Plan**: [plan.md](plan.md)

This guide lists how to prove the feature works. The behaviour itself is defined in
[contracts/](contracts/) and [data-model.md](data-model.md).

## Prerequisites

- `mise install` and then `pnpm install` (the toolchain is pinned in `mise.toml`).
- Google Chrome installed (local Playwright uses `pw.local.config.ts`).

## Commands

| Step | Command |
|---|---|
| Unit (per task) | `pnpm vitest run tests/unit/metronome/timer-model.test.ts tests/unit/metronome/timer-store.test.ts tests/unit/metronome/timer-card.test.ts tests/unit/audio/chime.test.ts tests/unit/prefs/schema.test.ts tests/unit/prefs/session.test.ts tests/unit/state/preferences-store.test.ts` |
| Build for e2e (after `src/` changes) | `pnpm build:test` |
| E2E (per task) | `pnpm test:e2e:fast e2e/metronome-timer.spec.ts` |
| Screenshot (new or changed) | `pnpm playwright test e2e/metronome-timer.spec.ts -g "timer card" --project=desktop --update-snapshots` |
| End of slice, once | `pnpm verify` |

The existing `e2e/metronome.spec.ts` screenshots change, because the card now sits above the
panel. Linux baselines come only from `.github/workflows/update-snapshots.yml`.

## Validation scenarios

E2E uses `page.clock.install()` before navigation and `page.clock.runFor(ms)` to advance time.
The chime is verified through the test-build `__fmAudioLog` (`type: 'chime'`), and metronome
clicks through `type: 'click'` entries.

| # | Spec ref | Steps | Expected | Test |
|---|---|---|---|---|
| 1 | US1-1, FR-001/002 | Open `/metronome`. Check that `2m` is pressed. Press **Start timer** | `02:00`. After 1 s `01:59`. The button is named "Pause timer" | e2e |
| 2 | US1-2, FR-005 | Run 10 s, press pause, run 30 s, press play, run 5 s | Paused at `01:50` and still `01:50` after 30 s, then `01:45` | e2e + S3 |
| 3 | US1-3, FR-007, SC-003 | Select `1m`, play, run 60 s | `00:00`, `data-status="finished"`, `data-flash` present, one `chime` log entry, button "Start timer". After 5 s more, `data-flash` is gone and the finished style stays | e2e + S8, S10 |
| 4 | US1-4, FR-006 | After scenario 3, press play | `01:00`, then counting | e2e + S4 |
| 5 | US2-1, SC-005 | `2m` running, tap `5m` | Stopped, `05:00`, `5m` pressed | e2e + S5 |
| 6 | US2-2 | `5m` running for 20 s, tap `5m` | Stopped, `05:00` | e2e + S5 |
| 7 | US2-3, FR-003 | Inspect the presets | Ten buttons `1m`–`10m`, exactly one `aria-pressed="true"` | unit U1 |
| 8 | US3-1, FR-009 | Start the metronome, then a `1m` timer. Run 61 s | The timer finishes. `click` entries continue after the `chime` entry. Metronome phase `running` | e2e |
| 9 | US3-2 | With the metronome stopped, start the timer | No `click` entry. The metronome Start button is still shown | e2e + S15 |
| 10 | US3-3 | Timer running, metronome running. Press metronome Reset (and Escape) | The timer keeps counting (the reading keeps dropping) | e2e + S13 |
| 11 | US3-4, FR-010 | Timer running. Switch to each mode tab | Same reading continues, and the card is present in every mode | e2e + S13 |
| 12 | FR-010, clarify Q3 | Timer `1m` running. Go to `/notes` via the app nav, run 61 s, come back | Back on Metronome, `00:00` finished. One `chime` entry was logged while on `/notes` | e2e |
| 13 | US4-1, FR-011 | Tap `5m`, reload | `5m` pressed, `05:00`, stopped. Stored `metronome.timer === 5` | e2e + C28, C30 |
| 14 | US4-2 | `5m` running for 10 s, reload | `05:00`, stopped | e2e |
| 15 | US4-3, C34 | `5m`, then About → Erase preferences, return | `2m`, `02:00`. No `timer` key stored | e2e + unit |
| 16 | FR-011, C29 | Seed storage `metronome: { mode: "speed", timer: "7" }`, open | `2m` selected, Speed Training tab active | e2e + fixture |
| 17 | US5-1, FR-008 | Mute via the sound control, then run `1m` to zero | The finished state is shown. Silence comes from the mute chain: the chime is routed only through `sink.destination` (A4), and the existing sound-control tests cover the mute gain. By-ear confirmation is a manual check | e2e + A4 |
| 18 | US5-2 | `page.emulateMedia({ reducedMotion: 'reduce' })`, run to zero | The readout's computed `animation-name` is `none`, and the static highlight is applied while `data-flash` is set | e2e |
| 19 | US5-3, FR-013 | Run `1m`. Sample the polite region inside `.timer` at 49 s, 50 s, 55 s, 59 s and 60 s | `''` (no text before 10 s) → `10 seconds` → `5 seconds` → `1 second` → `Timer finished`. The readout has `role="timer"` and no `aria-live` | e2e + S11 |
| 20 | FR-012, SC-002 | Unit: fake clock with late callbacks (S12). E2E: run `2m` with `page.clock.runFor(120_000)` | Finishes within 1 s of 120 s | unit + e2e |
| 21 | Edge: hidden or slept | Unit: jump the clock 10 s past `endsAt` before any callback | `finished`, no `chime` call | unit S8 |
| 22 | Edge: audio blocked | E2E with `__fmAudioFault = 'context'`: run `1m` | Finished state shown, no page error, no `chime` entry | e2e + S9 |
| 23 | FR-017 | Focus the `3m` pill and press Space. Focus the play button and press Space and Enter | The pill is selected, the timer toggles, and the metronome phase stays `settings` | e2e |
| 24 | FR-015, SC-006 | Viewports 320 px and 1024 px at 200 % text zoom, in en, pt-BR and es | All ten pills are visible and clickable, no horizontal page scroll, no overlap | e2e |
| 25 | FR-015, U11 | axe on `/metronome` in light, dark, and contrast-more, while running and finished | Zero violations | e2e |
| 26 | FR-014 | `no-raw-text` and the catalog-parity unit tests | All 9 keys are present in en, pt-BR and es | unit |
| 27 | SC-001 | From a fresh load, tap `5m`, then play | Running after two taps | e2e |
| 28 | FR-016 | Network offline after load (`context.setOffline(true)`): run `1m` | Works. No requests are issued by the timer | e2e |

## Manual checks (human; recorded in `tasks.md` and the PR)

- **By ear**: the chime is audible, short (under 1 s) and distinct from the metronome clicks.
  It follows the volume slider and is silent when muted.
- **Real hidden tab**: in desktop Chrome, start a `1m` timer, switch to another tab for over
  a minute, and hear the chime within about 2 s of the end.
- **Screen reader** (VoiceOver or NVDA): seconds 10 to 1 and "Timer finished" are spoken
  politely, and nothing earlier.
