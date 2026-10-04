# Quickstart: Validate Custom Tuning (011)

Run guide proving the feature end to end. Behaviour details live in
[contracts/custom-panel-ui.md](./contracts/custom-panel-ui.md),
[contracts/tuning-api.md](./contracts/tuning-api.md),
[contracts/storage-format.md](./contracts/storage-format.md) and
[data-model.md](./data-model.md).

## Prerequisites

```bash
mise install            # Node 24.21.0, pnpm 10.34.6 (mise.toml)
pnpm install
```

## Automated gates (all must pass)

```bash
pnpm check              # paraglide compile + svelte-check (new messages compile)
pnpm lint               # import boundaries: instrument → theory only
pnpm format:check
pnpm test:unit          # Vitest incl. new suites below; coverage ≥ 95 % theory, ≥ 80 % overall
pnpm build && node scripts/check-bundle-size.mjs   # initial JS ≤ 85 KB gzip
pnpm test:e2e           # phone (360 px) + desktop, axe zero violations
```

Expected new/changed test suites:

| Suite | Proves |
|---|---|
| `tests/unit/theory/pitch.test.ts` | `sharpSpelling`, `spellSharp` (12 classes, octave boundaries) |
| `tests/unit/instrument/custom-tuning.test.ts` (+ `.property.test.ts`) | limits table, all 12 positions per string vs theory reference (SC-002), `matchPreset` for all 11 presets (SC-004), canonical round-trip, `invertedStrings` (equal ≠ inverted) |
| `tests/unit/instrument/tunings.test.ts` | `tuningStrings` spelling (Half step down flats; unmatched sharps), memoized `tuningInstrument` |
| `tests/unit/state/instrument-config.test.ts` | `chooseCustom`, `stepString`, refused steps are no-ops, `selectTuning`/`restoreDefault` hide rows, reopen rules |
| `tests/unit/state/instrument-store.test.ts` | confirm writes `customTuning` only for unmatched tunings; cancel discards |
| `tests/unit/prefs/schema.test.ts` + fixtures | six new fixture records; round-trip property |
| `tests/unit/instrument-panel.test.ts` | rows, disabled at limits without error, focus moves to note button, playback calls, order note, name line |
| `tests/unit/tuning-badge.test.ts`, `home-screen.test.ts` | "Custom" badge/summary; matched → preset name |
| `tests/unit/triads/*` | unison 3-2-1 guidance, Another set / See all notes, set not moved on tuning change |
| `e2e/custom-tuning.spec.ts` | user stories 1–5 flows, reload persistence, axe in Custom state at 320 px / 200 % zoom |

## Manual walkthrough (`pnpm dev`, open the printed URL)

1. **Drop D in two presses (SC-001)**: Home → instrument summary → choose **Custom**. Six rows
   read E2 A2 D3 G3 B3 E4 (string 6 first). Press **Lower string 6** twice → row shows D2, you
   hear D2, the name line reads **Drop D**, preview's open string 6 is D.
2. **Back to Custom**: press **Raise string 6** once → D♯2, name line **Custom**.
3. **Limits**: press **Lower string 1** seven times → A3, lower button disabled, no message,
   focus now on the "String 1, A 3" note button.
4. **Order note**: Restore default → Custom → **Lower string 3** six times → C♯3; the note
   "The strings are not in order from low to high" shows in muted text; Confirm enabled.
   Raise string 3 once → D3 (equal to string 4) → note disappears.
5. **Confirm unmatched**: set any unmatched tuning, **Confirm** → badge "Custom", home summary
   "6 strings · Custom · right-handed". Reopen panel → Custom selected, rows show the values.
6. **Persistence**: reload → same tuning. DevTools → Application → Local Storage →
   `fretboard-master:prefs` contains `"tuning":"AF-1","customTuning":[…]`.
7. **Damaged data**: set `customTuning` to `[0,0,0,0,0,9]`, reload → Standard (or the record's
   `tuning`), no error screen.
8. **Triads unison**: Custom → raise string 3 by 4 (B3 = string 2) → Confirm → open Triads on
   set 3-2-1 → empty fretboard, "This triad does not close on this string set with the current
   tuning", **Another set** and **See all notes**.
9. **Erase**: About → erase preferences → reload → Standard, no badge.
