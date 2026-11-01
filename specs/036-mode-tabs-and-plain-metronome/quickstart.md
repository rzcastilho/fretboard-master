# Quickstart: validating Mode Tabs and Plain Metronome (036)

## Prerequisites

- `mise install`, then `pnpm install`.
- Google Chrome installed (the local Playwright config uses it; see `CLAUDE.md`).

## Unit checks (per task)

```bash
pnpm vitest run tests/unit/metronome tests/unit/prefs/schema.test.ts \
  tests/unit/state/preferences-store.test.ts tests/unit/erase-preferences.test.ts \
  tests/unit/i18n
```

Expected:

- The store guarantees S1–S5 pass ([contracts/metronome-store-api.md](contracts/metronome-store-api.md)).
- The codec guarantees C1, C6 and C9–C14 pass ([contracts/preferences-record.md](contracts/preferences-record.md)).
- `settings.test.ts` covers `plainRunPlan`, the generic `stepSetting` and `toMode`.
- `view.test.ts` covers `statusParams` with `sub === null`.
- The catalog tests pass with the new keys in all three locales, and `metronome_panel_heading`
  is removed.

## E2E checks (per task)

```bash
pnpm build:test
pnpm test:e2e:fast e2e/metronome-modes.spec.ts e2e/metronome.spec.ts \
  e2e/metronome-a11y.spec.ts e2e/metronome-remembered.spec.ts \
  e2e/metronome-subdivisions.spec.ts e2e/metronome-count-in.spec.ts e2e/metronome-ratios.spec.ts
```

The new `e2e/metronome-modes.spec.ts` covers these scenarios:

| # | Scenario | Expected |
|---|---|---|
| 1 | Open `/metronome` with empty storage | Tab bar first in the card; tabs `Metronome`, `Ratios Training` in that order, equal width; `Ratios Training` has `aria-selected="true"`; no Speed Training tab (US2-1, US2-6) |
| 2 | Click `Metronome` | Its settings view shows BPM 85, # of Beats 4, Count In on, Initial Count In 4, button `Start`; no Repeat Count In, no Subdivision ratio, no Loop 1/Loop 2 (US1-3) |
| 3 | Set 100 BPM, 3 beats, Start, with the fake click sink | 4 count-in clicks, then a loop of 3 slots per bar, only slot 1 accented, 1 click per beat; status `COUNT IN n/4`, then `BEAT n/3` with no `SUB`; 3 dots (US1-1, US1-2, SC-001) |
| 4 | Space, Space, Escape during the plain run | Pause, Resume, then Reset to settings with 100/3 kept (US1-4) |
| 5 | Ratios Training running → click the `Metronome` tab | No click is scheduled after the switch; Metronome settings view; switch back → Ratios values as left (US3-1, US3-2, SC-002) |
| 6 | Switch during the count-in, and while paused | Stops; the next Start begins at `COUNT IN –/4` (edge cases) |
| 7 | Click the already active tab while running | Still running (edge case) |
| 8 | Keyboard: Tab into the tablist, ArrowLeft/Right/Home/End while running | Focus moves, `aria-selected` and playback unchanged; Enter selects and stops; Space on a tab selects and does not pause (FR-012) |
| 9 | 120 BPM in Ratios, 100/3 in Metronome, switch back and forth, reload | Each mode keeps its values; the page opens on the last selected tab (US3-3, US3-5) |
| 10 | Stored `metronome.mode: "speed"` and `plain.bpm: 999` | Opens on Ratios; plain BPM is 85; Ratios values intact (FR-013) |
| 11 | Erase preferences on About, then return | Ratios tab selected, both modes at defaults |
| 12 | Viewport 375 px and 320 px, in en/pt-BR/es | Tab icons hidden (`.tab-icon` not visible), labels fully visible, `document.scrollingElement.scrollWidth <= innerWidth`; at 1024 px the icons are visible (US2-5, SC-005) |
| 13 | axe on settings, running and paused in both modes | Zero violations (SC-006) |
| 14 | 1 beat in plain mode | Every loop click accented; the single dot stays lit |

The existing metronome specs keep passing after only the locator change from `region` to
`tabpanel` (SC-007).

## Screenshots

The tab bar changes the existing `e2e/metronome.spec.ts` baselines (settings, running and
paused, in light and dark). New plain-mode baselines are added for the settings and running
views. To generate them locally (desktop only):

```bash
pnpm playwright test e2e/metronome.spec.ts -g "<test name>" --project=desktop --update-snapshots
```

The Linux baselines come only from `.github/workflows/update-snapshots.yml`.

## End of slice

```bash
pnpm verify
```

Expected: check, lint, format, full Vitest with coverage, build, the bundle-size check
(≤ 160 KB gzip) and the full desktop Playwright suite all pass.

## Manual checks (human)

- By ear, in a real browser: plain mode at 100 BPM / 3 beats sounds 4 count-in clicks and
  then an accented beat 1 followed by two regular clicks, with no soft subdivision clicks, and
  stays steady for 5 minutes (SC-004).
- A screen reader (VoiceOver or NVDA) announces "Metronome modes, tab list" and reads the
  selected state, and on Start reads "Started, 100 BPM, 3 beats, count in 4".
