# Quickstart: validating Subdivisions (032)

Validation guide only. Interfaces live in [contracts/](./contracts/), types in
[data-model.md](./data-model.md).

## Prerequisites

- `mise install` and `pnpm install` done (repository README).
- Google Chrome installed (local Playwright uses it, `pw.local.config.ts`).

## 1. Unit tests (per task)

```bash
pnpm vitest run \
  tests/unit/audio/click.test.ts \
  tests/unit/audio/metronome.test.ts \
  tests/unit/metronome/settings.test.ts \
  tests/unit/metronome/view.test.ts \
  tests/unit/metronome/store.test.ts \
  tests/unit/metronome/keys.test.ts \
  tests/unit/metronome/panel.test.ts \
  tests/unit/i18n
```

Expected:

| Area | Proves |
|---|---|
| `click.test.ts` | `sub` peak ≤ half of `normal`, length ≤ 20 ms, pitch ≠ 1000/1600 Hz; accent/normal unchanged (FR-005). |
| `audio/metronome.test.ts` | `clickAt` times from integer `j`; property test BPM 30–300 × n 1–8 within 2 ms over 10 min; `n = 1` equals 031; `onBeat` once per slot; Pause stops pending soft clicks and returns the slot's beat; skip-forward lands on the next grid click; 300 BPM × 8 gives 2400 starts in 60 s (FR-004, 007–010, 015; SC-002, 003, 005). |
| `settings.test.ts` | `toSubdivision` accepts 1–8 (number or numeric string) only; default 3. |
| `view.test.ts` | `statusParams` carries `sub` in both variants. |
| `store.test.ts` | `setSubdivision` only in settings; segment gets `clicksPerBeat`; Reset keeps it; `screenChanged` restores 3; start announcement names it (FR-003, 012, 015). |
| `keys.test.ts` | Space on a `SELECT` target returns `null`. |
| `panel.test.ts` (jsdom) | Combobox named "Loop 1" with eight options in order, "8th Triplets (3)" selected; absent while running; status text `BEAT –/4 · SUB 3` then `BEAT 1/4 · SUB 3` (US2-1/2/5, FR-006). |
| `tests/unit/i18n` | All new keys in three catalogs; allowlist updated. |

## 2. E2E (per task)

```bash
pnpm build:test
pnpm test:e2e:fast e2e/metronome-subdivisions.spec.ts e2e/metronome.spec.ts e2e/metronome-a11y.spec.ts
```

Scenarios in `e2e/metronome-subdivisions.spec.ts`, all read from `__fmAudioLog` (`kind`, `slot`,
`when`):

1. **US1-1**: default → per slot one `accent`/`normal` then two `sub` at +⅓ and +⅔ of
   `60/85` s (±2 ms); status `BEAT n/4 · SUB 3`.
2. **US1-2**: Quarter notes → no `sub` entries; status `… · SUB 1`.
3. **US1-3**: 2 beats → `BEAT 2/2 · SUB 3`, two dots.
4. **US1-4**: lit dot index changes once per slot, not per `sub` click.
5. **US2-2/3**: each of the eight options → `SUB n` and `n − 1` `sub` entries per slot.
6. **US2-4**: keyboard only: Tab to the select, ArrowDown, Enter/Space; Start not triggered.
7. **US3-2**: 300 BPM × 32nds for 2 s → consecutive `when` deltas 25 ms ± 2 ms, no duplicate
   `(run, index)`.
8. **US3-3/4**: Pause between soft clicks → a `click-cancel` entry with `count > 0`, no entry
   with `when` after the pause instant sounds; Resume → first entry `kind: 'normal'` of the next
   beat ≤ 50 ms after the press, followed by its `sub` clicks.
9. Reset keeps the chosen subdivision; navigating away and back shows 8th Triplets.
10. pt-BR and es: label "Loop 1" / "Bucle 1", status `TEMPO 2/4 · SUB 3` / `TIEMPO 2/4 · SUB 3`.
11. 320 px viewport (zoom reflow) in pt-BR: no horizontal scroll, select and status fully inside
    the panel.

`e2e/metronome-a11y.spec.ts`: axe zero violations on the settings view with the select, and on
the running view, in light, dark, high-contrast and forced colours.

## 3. Screenshots

Only the settings view changes (new row) and the running/paused status line (suffix):

```bash
pnpm playwright test e2e/metronome.spec.ts -g "metronome views" --project=desktop --update-snapshots
```

## 4. Manual listen (optional)

`pnpm dev`, open `/metronome`, pick each option at 85 BPM and at 300 BPM with 32nd notes: the
beat click stays clearly louder and lower than the soft ticks; nothing smears at 300 × 8.

## 5. End of slice

```bash
pnpm verify
```

Passes typecheck, lint (import boundaries, style lint), format, full Vitest with coverage,
build, bundle-size (≤ 150 KB gzip) and the full desktop Playwright suite.
