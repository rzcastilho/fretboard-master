# Quickstart: validate Triads Quality Comparison

This guide shows how to prove the feature works from start to finish. The rules it checks are
in [contracts/](./contracts/), and the shapes it uses are in [data-model.md](./data-model.md).

## Prerequisites

```bash
mise install          # pinned Node + pnpm
pnpm install
pnpm check            # paraglide compile + svelte-check (new catalog keys must compile)
```

## 1. Automated gates

```bash
pnpm lint                                   # includes the theory import boundary
pnpm test:unit -- tests/unit/theory/triad-compare.test.ts tests/unit/theory/triad-compare.property.test.ts
pnpm test:unit -- tests/unit/state tests/unit/fretboard tests/unit/triads tests/unit/audio/schedule.test.ts
pnpm test:unit -- --coverage                # theory ≥ 95 % lines/branches, overall ≥ 80 %
pnpm test:e2e -- e2e/triads-compare.spec.ts e2e/triads-tm9.spec.ts e2e/playback.spec.ts e2e/perf.spec.ts
```

Expected result: everything passes and axe reports zero violations on the comparison states.
The TM-9 sample 10 screenshot matches its baseline.

## 2. Manual walkthrough (`pnpm dev`, open `/triads`)

| # | Steps | Expected |
|---|---|---|
| 1 | Isolated, C major, root position, set 3-2-1. Turn **Compare** on | Minor is chosen at once. The list shows *minor, diminished, augmented* (no major). The third (E) is drawn solid and E♭ one fret toward the nut is drawn dashed, with a "1 fret" arrow. C and G appear once |
| 2 | Pick **diminished** | Two arrows: the third −1 and the fifth −1. Only the comparison markers that change slide (≤ 300 ms) |
| 3 | Set the root to G, 2nd inversion, set 4-3-2, comparison minor | Major at 12-12-12 and minor at 12-12-11, with a 1-fret arrow on string 2. The description says "shown one octave up" (TM-9 sample 10) |
| 4 | Change the root to A | Compare stays on: A major vs A minor, recalculated |
| 5 | Change the current quality to **minor** | It swaps to minor compared with major. A one-line notice reads "Now comparing with major". The list now excludes minor |
| 6 | Switch to **Full neck** | Every chain shape has its comparison overlay. G 2nd inversion 4-3-2 vs minor: the 0-0-0 shape has an off-nut arrow labelled B♭, and the 12-12-12 shape has the 1-fret arrow. The tags are unchanged |
| 7 | Switch to **All notes**, then back | In All notes the Compare control and Listen to comparison are hidden and nothing is drawn. Going back restores the same comparison |
| 8 | **Listen to comparison** | One block, a 500 ms pause, then a second block. Pulses follow the displayed markers. Changing any control during playback stops it |
| 9 | **Reset tool**, then turn Compare on | Reset turns Compare off. Turning it on again chooses the one-note partner (the remembered quality was cleared) |
| 10 | OS reduced motion on, change quality | Instant, with no slide or fade |
| 11 | Keyboard only: Tab to Compare, Space, then arrow keys in the list, then Tab to Listen to comparison | Focus is visible everywhere and follows a logical order. Targets are ≥ 44×44 px |
| 12 | 320 px wide, 200 % zoom | The composition columns stack, first above second. No truncation, and only the fretboard scrolls horizontally |

## 3. Limit cases with fixture instruments

These use the test hook `globalThis.__fmInstrument`, as in the existing e2e specs.

| Fixture | Setup | Expected |
|---|---|---|
| `SHORT-7` (7 frets) | G major vs minor, 2nd inversion, set 4-3-2 | No pair fits. Major is shown at 0-0-0, with an off-nut arrow labelled B♭ on string 2. Listen to comparison plays the major block, a rest, then D and G (the shared notes), and the notice says B♭ was not played |
| `AF-1-12` (12 frets) | A major vs augmented, 2nd inversion, set 6-5-4 | Major is at 12-12-11. The augmented fifth E♯ would be at fret 13 on string 6, so an off-end arrow labelled E♯ is shown |
| `AF-8` (Open G) | C major vs minor on any closing set | Exactly one note moves −1 (FR-010 in a non-standard tuning) |
| `NC-UNISON` | Set 4-3-2 with Compare on | The does-not-close guidance shows, with no comparison drawn and Compare still on |

## 4. Playback timing check (unit)

`tests/unit/audio/schedule.test.ts` asserts the timing. `planRequest({ kind: 'sequence', steps: [[a,b,c], [], [d,e,f]], bpm: 120 })`
must return two planned steps with onsets 0 and 1000 and durations of 500, and marks running
0–500 and 1000–1500 ms (R-10).
