# Quickstart: Validate Instrument Panel and Preset Tunings

**Feature**: 009-instrument-panel-and-tunings | Contracts: [contracts/](./contracts/) |
Data: [data-model.md](./data-model.md)

## Prerequisites

```bash
mise install          # pinned Node + pnpm (mise.toml)
pnpm install
```

## Automated gates (must all pass)

```bash
pnpm check            # paraglide compile + svelte-check (strict)
pnpm lint             # incl. import boundaries: instrument/ and *-config.ts stay DOM/Svelte-free
pnpm format:check
pnpm test:unit        # Vitest + coverage (theory ≥ 95 %, overall ≥ 80 %)
pnpm build:test && pnpm test:e2e   # Playwright phone 360 px + desktop, axe zero violations
pnpm lhci             # Lighthouse budgets + bundle size (≤ 80 KB gzip initial JS)
```

Key new suites (names indicative):

| Suite | Proves |
|---|---|
| `tests/unit/instrument/tunings.test.ts` | 66-row TM-2 table (11 presets × 6 strings: letter, accidental, octave, pitch) — SC-002; identity of `presetInstrument`; AF-1/22 is `STANDARD_GUITAR` |
| `tests/unit/state/instrument-config.test.ts` | every transition in data-model §3, clamping 12..24, cancel keeps active (SC-005) |
| `tests/unit/state/instrument-store.test.ts` | confirm orchestration table (contract §3) |
| `tests/unit/state/notes-adapt.test.ts` | whole-neck carry, clip 10–14 → 10–12, both-ends clip, card close |
| `tests/unit/state/triads-store.test.ts` (extended) | `applyInstrument` keeps root/quality/inversion/set; occurrence clamp; Drop D C major 6-5-4 root = 10-7-5 wide stretch (SC-003) |
| `tests/unit/instrument-panel.test.ts` | radio group, spinbutton keys and disabled ends, restore default, labels |
| `e2e/instrument-panel.spec.ts` | user flows below, phone + desktop, axe |

## Manual / E2E scenarios

Run `pnpm dev` and open the printed URL (or rely on the E2E spec, which automates each).

1. **Drop D end-to-end (US1, SC-003)** — Open `/triads`. Activate **Instrument**. Panel opens
   (bottom sheet at 360 px, side panel at ≥ 1024 px). Focus is on the checked "Standard"
   radio. Choose **Drop D**: preview's lowest string reads D, nothing behind changes. Press
   **Confirm**. Expect: badge "Drop D" in the app bar; select C major, root position, set
   6-5-4 → frets 10-7-5 with "wide stretch"; tap string 6 open → plays D2. Under 300 ms from
   Confirm to redraw (`e2e/perf.spec.ts`).
2. **Badge opens panel (US1-5/6)** — Activate the "Drop D" badge → panel opens with Drop D
   checked. Choose Standard, Confirm → badge disappears.
3. **Fret count (US2)** — Open panel, press End on "Frets" → 24; "More frets" disabled. Home
   → 12; "Fewer frets" disabled. Confirm with 12 → every tool's fretboard ends at fret 12.
4. **Cancel paths (US3, SC-005)** — Pick Open G and 16 frets, then dismiss with each of:
   Escape, **Close**, click backdrop, browser Back. Each time: still on the same screen, URL
   unchanged, Standard/22 still active, reopening shows Standard checked and 22.
5. **Restore default (US3-2)** — With Drop D/16 active, open panel, **Restore default** →
   Standard + 22 shown; Confirm → badge gone, fretboard 22 frets.
6. **Adjustment (US4)** — In `/notes` set region 10–14. Panel → 12 frets → Confirm. Region
   reads 10–12; status "We adjusted the view to the new instrument" announced politely, with
   Dismiss. Repeat with a whole-neck region → region 0–12, no status.
7. **Triads clamp (US4-2)** — In `/triads` move to the highest octave occurrence (Octave up
   until disabled), then set 12 frets and Confirm → lower occurrence of the same shape shown
   with the status.
8. **Scroll correction (US4-3)** — At 360 px in `/notes`, scroll the fretboard to fret 22,
   set 12 frets, Confirm → fretboard scrolls so fret 12 is at the trailing edge; no status
   if the view state was unchanged. With `prefers-reduced-motion: reduce` the jump is instant.
9. **Home (US5)** — After confirming Drop D, go Home: summary reads "6 strings · Drop D ·
   right-handed"; card thumbnails show D on string 6. Activate summary → panel opens.
10. **No-op confirm** — Open panel, Confirm without changes: no status, playback continues.
11. **Reload (FR-018)** — With Drop D active, reload → Standard, 22 frets, no badge.
12. **Spelling (FR-005)** — Panel list shows "E♭ A♭ D♭ G♭ B♭ E♭" for Half step down and
    "D A D F♯ A D" for Open D; screen reader reads "E flat…", "F sharp".
13. **Keyboard only (SC-007)** — Complete scenario 1 without a pointer; Tab never leaves the
    panel while open; focus returns to the opener on close.
