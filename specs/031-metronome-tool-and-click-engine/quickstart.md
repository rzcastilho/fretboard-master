# Quickstart: validate the Metronome slice

**Feature**: 031-metronome-tool-and-click-engine. Contracts: [click engine](./contracts/click-engine-api.md),
[store](./contracts/metronome-store-api.md), [UI](./contracts/metronome-ui.md). Data:
[data-model.md](./data-model.md).

## Prerequisites

```bash
mise install          # Node + pnpm pinned in mise.toml
pnpm install
```

## 1. Unit tests (per task, targeted)

```bash
pnpm vitest run tests/unit/audio/click.test.ts tests/unit/audio/metronome.test.ts
pnpm vitest run tests/unit/metronome          # settings, view, keys, store (jsdom where components render)
pnpm vitest run tests/unit/prefs/schema.test.ts tests/unit/tools.test.ts tests/unit/screens.test.ts \
  tests/unit/reserved-colors.test.ts tests/unit/playback-host.test.ts tests/unit/shortcut-list.test.ts
```

Expected:
- Grid property (SC-001): for every BPM 30–300 and *k* ≤ 3000, `when = anchor + k·60/bpm`
  within 1e-9 s. At 300 BPM, the 3000th click is exact (SC-002).
- Throttled wakes (SC-004): fake timers firing every 1000 ms for 60 s schedule every index once,
  each with `when ≥ currentTime` at scheduling.
- Pause on beat 3 of 4 → resume → beat 4, then accented beat 1 (SC-006).
- `playback.stop('hidden')` leaves the metronome `running` (FR-016). Every other tool still
  stops.
- `lastTool: 'metronome'` round-trips. An unknown value → `null` (FR-022).
- `--color-danger` is used only in `RunControls.svelte`, contrast ≥ 3:1, ΔE from root ≥ 10
  (FR-021).

## 2. E2E (per task, desktop project only)

```bash
pnpm build:test
pnpm test:e2e:fast e2e/metronome.spec.ts e2e/metronome-a11y.spec.ts e2e/home.spec.ts e2e/navigation.spec.ts e2e/about.spec.ts
```

Scenarios covered by `e2e/metronome.spec.ts` (each reads `window.__fmAudioLog` in the test build):

| Scenario | Steps | Expected |
|----------|-------|----------|
| US1-1 | Home → Metronome card → Start Training | 4 dots. Status steps `BEAT 1/4`…`4/4`. Log clicks with `accent` on beat 1 only. Path `/metronome` reached in 2 clicks (SC-005) |
| US1-2 | Set beats to 2 → Start | 2 dots, `BEAT n/2` |
| US1-4 | Start | The first `click` entry carries `pressedAtMs` and has `when ≥ contextTime` (log shape only; the ≤ 50 ms latency is a Vitest fake-clock case, SC-003) |
| US1-5 | Start → set `document.visibilityState = 'hidden'` and dispatch `visibilitychange` → poll the log (no fixed wait) | At least 4 more `click` entries arrive, consecutive `index`. No `stop` entry with reason `hidden` affects the run. Phase still `running` |
| US2-1/2 | Start → wait until `BEAT 3/4` → Pause → Resume | No `click` with `when` after the pause instant, before Resume. The first click after Resume has beat 4. Then beat 1, accented. (Resume latency is a Vitest fake-clock case, M5) |
| US2-3 | Running → Reset | Settings view, values kept |
| US2-4 | Space toggles start/pause/resume (also with the main button focused: exactly one toggle). Esc resets. Esc in settings does nothing |
| US3-1/2 | First open → 85/4. + at 300 is disabled. Slider and pill stay in sync. Home/End go to the limits |
| US3-3 | Viewport 1024 and 2560, and zoom-reflow 320 | Pill ≥ 96 px wide. No horizontal page scroll |
| FR-017 | Start → nav to Notes → back | Settings at 85/4. Log `click-cancel` with reason `leave` |
| C X fallback | Arm `__fmFault = { metronome: 1 }` → open `/metronome` | `FailureView` in `main`, nav operable, failure logged; its Reset shows settings at 85/4 |
| FR-018 | Start → mute | The run continues. The status still steps |
| FR-023/024 | On `/metronome` | No Share, TuningBadge, Stop button or instrument button. P/L/N do nothing |
| FR-027 | `__fmAudioFault = 'context'` → Start | Dots step. The one-line notice is shown and dismissible |
| FR-028 | 10 rapid Space presses | No duplicate `(run, index)`. At most one run live |

`e2e/metronome-a11y.spec.ts`: axe has zero violations in the settings, running and paused views,
in light and dark (SC-008). The whole flow is done by keyboard only (SC-007), and the live region
holds only run-state announcements. A language switch to pt-BR and es shows translated labels
(US4-2).

New screenshot baselines, desktop only:

```bash
pnpm playwright test e2e/metronome.spec.ts -g "metronome views" --project=desktop --update-snapshots
```

## 3. Manual listening check (one time, real browsers)

`pnpm build && node scripts/serve-build.mjs build 4174`, then open `http://localhost:4174/metronome`
in Chrome, Firefox and Safari:
1. 85 BPM / 4: the accent is clearly higher and louder on every 4th click. There is no
   stutter over 1 minute.
2. Switch to another tab for 30 s: the click keeps going with no gaps.
3. 300 BPM for 10 min next to a hardware metronome or phone app at 300: no audible phase drift.

## 4. End of slice (once)

```bash
pnpm verify      # check, lint, format, full Vitest + coverage, build, bundle-size (≤ 150 KB), full desktop Playwright
```

CI adds `/metronome` to Lighthouse (`lighthouserc.cjs`: tool-screen `interactive ≤ 3500`,
score ≥ 0.9, CLS ≤ 0.1).
