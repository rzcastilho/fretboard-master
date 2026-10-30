# Quickstart: validating Count In (033)

Validation guide only. Interfaces live in [contracts/](./contracts/), types in
[data-model.md](./data-model.md), decisions in [research.md](./research.md).

## Prerequisites

- `mise install` and `pnpm install` done (repository README).
- Google Chrome installed (local Playwright uses it, `pw.local.config.ts`).

## 1. Unit tests (per task)

```bash
pnpm vitest run \
  tests/unit/audio/metronome.test.ts \
  tests/unit/metronome/settings.test.ts \
  tests/unit/metronome/view.test.ts \
  tests/unit/metronome/store.test.ts \
  tests/unit/metronome/keys.test.ts \
  tests/unit/metronome/panel.test.ts \
  tests/unit/metronome/count-in-settings.test.ts \
  tests/unit/i18n
```

Expected:

| Area | Proves |
|---|---|
| `audio/metronome.test.ts` | No `countIn` → identical to 032 (E1). Property test BPM 30–300 × k 0–8 × n 1–8: count-in click *i* at `anchor + i·T`, loop click *j* at `anchor + k·T + j·T/n`, all within 2 ms, gap last-count-in → beat 1 = T ± 2 ms (FR-007, FR-014, SC-002). Count-in clicks are `accent`, no `sub` before the loop (FR-006). `onCountIn` 1…k then `onBeat` (E5). `halt` mid-count-in stops pending sources and returns `{ kind:'count-in', click }` (SC-004). `from = 2, total = 4` plays clicks 3, 4 then the loop. Skip-forward past the whole count-in lands on the next loop click, never replays count-in (E7). Second `start()` ignored (E8). Visual mode (no sink) reports the same events (E9). |
| `settings.test.ts` | Defaults `countIn true / 4 / 2`; `clampCount` table (0–8, rounding, NaN → default); `effectiveCountIn`; `atLimit` at 0 and 8 (FR-002, FR-004, FR-013). |
| `view.test.ts` | `statusParams` count-in variants; null count-in equals 032; `countInDot` (FR-010). |
| `store.test.ts` | Setters only in settings; switch off keeps values; Start with k = 4 → segment `countIn {0,4}`, `dots = []`, `countIn {0,4}`; `onCountIn` → running; `onBeat` → loop stage; Pause mid-count-in freezes and announces; Resume passes `{from:n,total:k}`; Resume after loop started passes none; k = 0 / switch off → 032 path and 032 announcement; Reset keeps settings; `screenChanged` restores defaults; `repeatCountIn` never reaches the segment (FR-003, 006, 008, 011–013, 016). |
| `keys.test.ts` | Space with `targetActivates` (switch) returns `null` (FR-005). |
| `panel.test.ts`, `count-in-settings.test.ts` (jsdom) | Switch named "Count In", `aria-checked="true"`; rows with sliders 4 and 2; toggling removes and restores rows with kept values; − disabled at 0, + at 8; absent while running; status `COUNT IN –/4` → `COUNT IN 1/4`, single dot, then `BEAT 1/4 · SUB 3` and four dots (US1-1/2/5, US2-1/2/4/5/7). |
| `tests/unit/i18n` | 14 new keys present in en, pt-BR, es; no identical-value violations. |

## 2. E2E (per task)

```bash
pnpm build:test
pnpm test:e2e:fast \
  e2e/metronome-count-in.spec.ts \
  e2e/metronome.spec.ts \
  e2e/metronome-subdivisions.spec.ts \
  e2e/metronome-a11y.spec.ts
```

`e2e/metronome-count-in.spec.ts` (new) reads `__fmAudioLog` `click` entries (`countIn`,
`kind`, `when`, `pressedAtMs`):

| # | Scenario | Expected |
|---|---|---|
| 2.1 | Defaults, Start (US1-1, SC-001) | 4 entries with `countIn` 1…4, all `accent`, spaced `60/85` s ± 2 ms; first within 50 ms of the press; next entry `countIn: null`, `slot 0`, `accent`, at `last + 60/85` ± 2 ms (SC-002); status passes `COUNT IN 1/4` … `4/4` then `BEAT 1/4 · SUB 3`. |
| 2.2 | Single dot (US1-2, US1-5) | During count-in exactly one `.dot`; after it, 4 dots. |
| 2.3 | Reduced motion (US1-3) | `emulateMedia({ reducedMotion: 'reduce' })`: the dot's computed `animation-name` is `none`, `data-state` becomes `lit`. |
| 2.4 | Initial Count In 0 (US1-4, SC-003) | First click `countIn: null`, within 50 ms; status never shows `COUNT IN`. |
| 2.5 | Switch off (US2-2/3) | Rows gone (`getByRole('slider', { name: 'Initial Count In' })` count 0, Tab skips them); Start → no `countIn` entries, `BEAT 1/4`. |
| 2.6 | Slider/pill sync and limits (US2-4/6) | Keyboard only: arrows, Home/End, −/+; values stay 0–8, − disabled at 0, + at 8; Space on the switch toggles, never starts. |
| 2.7 | Off and on again (US2-5) | Values set before switching off reappear. |
| 2.8 | Pause/Resume mid-count-in (US3-1/2, SC-004) | Pause after `COUNT IN 2/4`: no entry `when` > pause instant survives (`click-cancel` logged), status frozen; Resume → next entries `countIn` 3, 4 (first within 50 ms of the press), then the loop one beat later; no `countIn` 1 or 2 in the new run segment. |
| 2.9 | Pause in loop, Resume (US3-3) | No `countIn` entries after Resume. |
| 2.10 | Reset mid-count-in (US3-4, FR-012) | Settings view with switch on, 4, 2 (or the changed values); Start plays a full count-in. Leaving and returning shows defaults. |
| 2.11 | Repeat Count In kept (US4-1/2) | Set 6, Start, Reset → slider still 6; no extra `countIn` entries during the run. |
| 2.12 | Announcements (FR-016) | Live region: "Started, 85 BPM, 4 beats, 8th Triplets, count in 4"; Pause mid-count-in "Paused on count-in click 2 of 4"; never a per-click update. |
| 2.13 | Languages (FR-017) | pt-BR: switch "Contagem", status `CONTAGEM 1/4`; es: "Cuenta previa", `CUENTA 1/4`. |
| 2.14 | 320 px and 200 % text zoom, every theme (FR-018, SC-006) | No horizontal scroll on settings and running views; switch, rows and `COUNT IN 8/8` fully visible. |
| 2.15 | BPM 300 × Initial 8 (edge) | 8 count-in clicks 200 ms ± 2 ms apart, then the loop. |

Edited specs: `metronome.spec.ts` and `metronome-subdivisions.spec.ts` turn Count In off (new
`countInOff(page)` helper in `e2e/support/helpers.ts`) where they test the loop's first click or
`BEAT –/4`; `metronome-a11y.spec.ts` adds axe on the settings view with the switch on and off and
on the running view during a count-in (light, dark, more contrast, forced colours).

## 3. Screenshots

The "metronome views" test in `e2e/metronome.spec.ts` changes (new settings rows). Linux
baselines come only from `.github/workflows/update-snapshots.yml`; locally, refresh the desktop
baseline only if needed:

```bash
pnpm playwright test e2e/metronome.spec.ts -g "metronome views" --project=desktop --update-snapshots
```

## 4. End of slice (once)

```bash
pnpm verify
```

Expected: check, lint (style lint: tokens only), format, full Vitest with coverage, build,
bundle-size check (initial JS ≤ 160 KB gzip; expected growth < 2 KB), full desktop Playwright
(screenshots and `perf.spec.ts` skipped locally).

## 5. Manual checks (human, recorded in tasks.md)

- By ear at 85 BPM and 300 BPM: four (eight) accented count-in clicks, then the first loop's
  beat 1 lands exactly one beat later with no audible gap or flam.
- With the app muted, the count-in is silent but the dot and status still run; volume changes
  apply to count-in clicks.
