# Quickstart: validating Alternate Two Ratios

How to prove the feature works end to end. Interfaces are in [contracts/](./contracts/), the
cycle arithmetic in [data-model.md](./data-model.md) §2–§5.

## 0. Prerequisites

- `mise install` then `pnpm install` (repo root).
- Local runs stay targeted (constitution "Verification tiers", `CLAUDE.md`).

## 1. Unit tests (Vitest, `node` unless noted)

```bash
pnpm vitest run tests/unit/audio/metronome-cycle.test.ts tests/unit/audio/metronome.test.ts \
  tests/unit/metronome/settings.test.ts tests/unit/metronome/view.test.ts \
  tests/unit/metronome/store.test.ts tests/unit/metronome/panel.test.ts \
  tests/unit/metronome/ratio-settings.test.ts
```

| # | Scenario | Expected |
|---|---|---|
| 1.1 | `metronome-cycle` table: 85 BPM, N 4, k 4, r 2, n1 3, n2 6 | Slots 0–3 initial count-in; 4–7 Loop 1 (12 clicks); 8–9 repeat; 10–13 Loop 2 (24 clicks); 14–15 repeat; 16 Loop 1 beat 1 (US1-1) |
| 1.2 | Property: BPM 30–300 × N 1–16 × k, r 0–8 × n1, n2 1–8 | Successive slot starts exactly *T* apart (±1e-9 s) across every boundary; strictly increasing times; slot `k + m·S` is Loop 1 beat 1 for m ≤ 100 (FR-008, SC-002) |
| 1.3 | Section off; Count In off; r = 0; n1 = n2; N = 1 | Loop 1 only, no repeat; back-to-back switches; still alternates; alternates every beat (US2-3, US3-1/2, US1-5, Edge Cases) |
| 1.4 | Kinds | Every count-in click accent; beat 1 of each loop accent; others normal/sub (C4) |
| 1.5 | Engine with `FakeAudioPort` / `FakeClock` / `FakeFrames` | `startSlot` resumes at the right click; skip-forward over a switch lands on the right phase, no burst; `halt()` returns the right `SlotPosition` (E1–E3, H1–H2) |
| 1.6 | Migrated 031–033 engine tests (`startSlot`, `initialCountIn`) | All pass unchanged in meaning (FR-015) |
| 1.7 | Settings | Defaults `ratio: true`, `loop2: 6`; `toRatio`; `effectiveRepeatCountIn` table (countIn × ratio × r) (FR-006, FR-012) |
| 1.8 | Store | `sub` follows the playing loop; pause on beat 3 of Loop 2 → resume slot = next beat; pause on repeat click 1/2 → resume on click 2; pause on last loop beat → resume on repeat click 1; reset → slot 0; announcements per data-model §8 (US4, FR-013) |
| 1.9 | `ratio-settings.test.ts` (jsdom) | h3 + switch named "Subdivision ratio"; Loop 2 select with eight options, default 6; off removes Loop 2, on restores the kept value (US2-1/2/4/5) |

## 2. End-to-end (Playwright, desktop project)

```bash
pnpm build:test
pnpm test:e2e:fast e2e/metronome-ratios.spec.ts e2e/metronome.spec.ts \
  e2e/metronome-subdivisions.spec.ts e2e/metronome-count-in.spec.ts e2e/metronome-a11y.spec.ts
```

New `e2e/metronome-ratios.spec.ts` reads the test-build `__fmAudioLog` `click` entries
(`phase`, `slot`, `beat`, `countIn`, `kind`, `when`):

| # | Scenario | Expected |
|---|---|---|
| 2.1 | US1-1/SC-001: 85 BPM, 4 beats, Count In 4/2, Loop 1 8th Triplets, Loop 2 Sextuplets; run 2 full cycles (~4 s initial + ~17 s; the 100-cycle check is 1.2) with `test.setTimeout(60_000)` | Phases `initial×4, loop1×12, repeat×2, loop2×24, repeat×2, loop1…`; status text sampled per slot matches `COUNT IN n/4`, `BEAT n/4 · SUB 3`, `COUNT IN n/2`, `BEAT n/4 · SUB 6` |
| 2.2 | US1-4/SC-002 at 30, 85, 300 BPM, each with Beats 1, Count In off / 1 (4-slot cycle, ≤ 8 s at 30 BPM), one cycle per tempo, `test.setTimeout(60_000)` | Gap between last click of a phase and first click of the next = 60/BPM ± 2 ms |
| 2.3 | US1-3 | During a repeat count-in, one dot (`.dots.count-in`), status `COUNT IN n/2` |
| 2.4 | US2-1/2/4/5/6 | Defaults visible; Loop 2 options = Loop 1 options; switch off removes Loop 2; keyboard toggles the switch; controls absent while running/paused |
| 2.5 | US2-3/SC-003 | Section off: only `loop1` and `initial` phases in the log, `SUB 3` throughout |
| 2.6 | US3-1/2/3 | Count In off → no count-in at all, loop1 → loop2 back to back; Repeat 0 → initial plays, no repeat; Repeat 6 → six accented repeat clicks |
| 2.7 | US4-1/2/3/SC-004 | Pause on `BEAT 3/4 · SUB 6` → no clicks after pause, status frozen; resume → next click `loop2` beat 4; pause on `COUNT IN 1/2` → resume plays repeat click 2 then the next loop |
| 2.8 | US4-4 | Reset → settings unchanged; Start begins with `initial` click 1 |
| 2.9 | Edge: rapid Start/Pause/Resume/Space | No overlapping `run` streams, no doubled count-in |
| 2.10 | Edge: 320 CSS px zoom, 200 % text, en/pt-BR/es, themes | No horizontal scroll, no truncation (`expectNoTruncationOrOverlap`), N 16 / r 8 status fits |
| 2.11 | a11y (`metronome-a11y.spec.ts`) | axe zero violations: settings (section on/off), running loop, running repeat count-in |

Existing specs use the new `ratioOff(page)` helper where an assertion spans more than one
loop (research R-11); the 033 `slot` assertion becomes `slot === k`.

## 3. Screenshots

The "metronome views" screenshot changes (header and Loop 2 on the settings view). Generate a
local desktop baseline only for inspection:

```bash
pnpm playwright test e2e/metronome.spec.ts -g "metronome views" --project=desktop --update-snapshots
```

Linux baselines come only from `.github/workflows/update-snapshots.yml`.

## 4. End of slice

```bash
pnpm verify
```

Expected: check, lint, format, full Vitest with coverage, build, bundle-size ≤ 160 KB gzip
(expected growth < 2 KB), desktop Playwright suite (screenshots and perf skipped locally).

## 5. Manual checks (record in `tasks.md`, list in the PR)

- By ear at 85 BPM: 8th Triplets ↔ Sextuplets with a 2-click count-in sounds even, with no
  hiccup at the switch.
- Real-browser check of the switch and Loop 2 select in Firefox and Safari on macOS
  (forced colours on Windows if available).
