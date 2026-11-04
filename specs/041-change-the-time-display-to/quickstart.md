# Quickstart: validating 042

Prerequisites: `mise install`, `pnpm install` (adds the dev-only `dseg` source, or the vendored
TTF per research R-1), Google Chrome installed (local Playwright, `pw.local.config.ts`).

## 1. Font asset

```bash
pnpm fonts:timer-digits          # regenerates static/fonts/fm-timer-digits.woff2
ls -l static/fonts/              # fm-timer-digits.woff2 (< 4 KB) and OFL-DSEG.txt present
```

Expected: the script prints the byte count; a second run produces an identical file.

## 2. Unit tests (per checkpoint)

```bash
pnpm vitest run tests/unit/audio/click.test.ts tests/unit/audio/click-preview.test.ts \
  tests/unit/audio/metronome.test.ts tests/unit/prefs/schema.test.ts \
  tests/unit/metronome/store.test.ts tests/unit/metronome/click-sound-select.test.ts \
  tests/unit/metronome/panel.test.ts tests/unit/metronome/timer-card.test.ts \
  tests/unit/metronome/count-in-settings.test.ts tests/unit/metronome/ratio-settings.test.ts \
  tests/unit/caged/caged-tool.test.ts tests/unit/erase-preferences.test.ts
```

Expected outcomes (see [contracts/click-sound-api.md](contracts/click-sound-api.md),
[contracts/preferences-record.md](contracts/preferences-record.md),
[contracts/metronome-sound-store.md](contracts/metronome-sound-store.md)):

- `renderClick` for 5 sounds × 3 kinds: lengths, peak ordering, determinism; `click` identical
  to the pre-042 golden.
- `setSound` mid-run: click times on the fake clock are identical to a run without the change;
  only clicks scheduled after the call carry the new `sound` in the log.
- Prefs: every row of the preferences-record table, including the three new fixtures.
- Switch components: no `.state` element; `aria-checked` toggles.

## 3. E2E (desktop project only)

```bash
pnpm build:test
pnpm test:e2e:fast e2e/metronome-sound.spec.ts e2e/metronome-timer.spec.ts \
  e2e/metronome-timer-link.spec.ts e2e/metronome-count-in.spec.ts \
  e2e/metronome-ratios.spec.ts e2e/caged-layers.spec.ts e2e/offline.spec.ts e2e/a11y-audit.spec.ts
```

Scenarios:

| Story | Check |
|---|---|
| US1-1 | `/metronome`: `.time` and `.ghost` computed `font-family` start with `"FM Timer Digits"`; `document.fonts.check` true |
| US1-2 | readout bounding width equal at `10:00`, after 1 s of running, paused, finished |
| US1-3 | `offline.spec.ts`: after one online visit, go offline, reload `/metronome`: font check true, no non-origin request |
| US1-5 | readout accessible name and `role="timer"` unchanged |
| US1-6 | route `/fonts/fm-timer-digits.woff2` aborted → readout visible with fallback face, non-empty text |
| — | `/` and `/notes` (service workers blocked): no page request for `fm-timer-digits.woff2`; the worker's precache fetch is exempt (FR-003) |
| US2 | every `role=switch` on `/metronome` and `/caged`: no `.state` child, text equals label, `aria-checked` flips |
| US3-1 | `#metronome-sound` lists Click, Wood block, Beep, Rim, Cowbell (en), Click selected; same in es/pt-BR with translated names |
| US3-2/6 | start, select `rim` while running; audio log `click` entries switch to `sound:"rim"` within 1.5 s, `when` values stay on the grid (diff = period) |
| US3-3 | stopped: select `wood` → one `click-preview` log entry; muted → entry still logged but mute gain 0; running → no `click-preview` |
| US3-4 | reload → `wood` still selected |
| US3-5 | seed `localStorage` with `sound:"gong"` → `click` selected, other metronome settings kept |
| US3-7 | change in Ratios, switch to Plain and Speed → same value |
| a11y | axe: zero violations on `/metronome` and `/caged` |

New screenshot (desktop only): `metronome-timer.spec.ts` readout snapshot updated with
`pnpm playwright test e2e/metronome-timer.spec.ts -g "<test name>" --project=desktop --update-snapshots`;
Linux baselines come from `update-snapshots.yml` in CI.

## 4. End of slice

```bash
pnpm verify    # check, lint, format, Vitest + coverage, build, bundle-size, desktop e2e
```

Expected: green; initial JS stays ≤ 180 KB gzip.

## 5. Manual checks (record in tasks.md and the PR)

- Listening (SC-005): for each sound, accent / normal / sub are told apart; no sound is harsh at
  volume 100.
- Visual (SC-001): readout in light, dark and high-contrast themes, all four timer states.
