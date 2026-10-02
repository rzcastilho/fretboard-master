# Quickstart: Triads Full Neck and All Notes Views

**Feature**: `006-full-neck-and-all-notes` | Contracts: [contracts/](./contracts/) | Data model: [data-model.md](./data-model.md)

Validation guide proving the feature end to end. Implementation detail lives in `tasks.md`.

## Prerequisites

```bash
mise install          # Node + pnpm pinned in mise.toml
pnpm install
```

## Automated gates

```bash
pnpm check            # paraglide compile + svelte-check (new message keys compile)
pnpm lint             # incl. theory import boundary (triad-shape.ts stays pure)
pnpm format:check
pnpm test:unit        # Vitest: chain table + property tests, view/model/store, fretboard tags
pnpm build:test && pnpm test:e2e   # Playwright phone + desktop, axe, TM-9 screenshots, perf
```

Expected: all green; `src/lib/theory` coverage ≥ 95 % lines/branches; zero axe violations.

Focused runs:

```bash
pnpm vitest run tests/unit/theory/triad-chain        # C1, C16, C17, SC-002 + property tests
pnpm vitest run tests/unit/state/triads              # view transitions, per-view model, C13 stop matrix
pnpm vitest run tests/unit/fretboard/tags tests/unit/fretboard/interaction
pnpm playwright test e2e/triads-full-neck.spec.ts e2e/triads-all-notes.spec.ts e2e/triads-tm9.spec.ts
```

## Manual walkthrough (`pnpm dev`, open `/triads`)

| # | Steps | Expected |
|---|---|---|
| 1 | Root A, major, set 3-2-1, View **Full neck** | Six shapes 2-2-0, 6-5-5, 9-10-9, 14-14-12, 18-17-17, 21-22-21; tags "Root position", "1st", "2nd", "Root position", "1st", "2nd" above them; both root-position shapes highlighted |
| 2 | Tap a **2nd** tag | Both 2nd shapes highlighted, others normal; inversion control shows 2nd; board does not scroll |
| 3 | Tab through tags | Focus in chain order, visible ring, Enter/Space selects; screen reader reads "2nd inversion, frets 9-10-9, pressed" |
| 4 | **Listen** | 24 steps: each shape low→mid→high then chord, lowest to highest; positions pulse (also with sound muted) |
| 5 | View **All notes** | Inversion + String set greyed, hint "Not used in All notes"; every A (square), C♯ (circle), E (diamond); no tags; panel name "A major", no low-to-high line |
| 6 | **Listen** in All notes | A2 (s5 f0), C♯3 (s5 f4), E3 (s4 f2), single notes |
| 7 | Back to **Isolated** | Controls enabled with previous values; Octave up/down work again |
| 8 | Root C, augmented, 3-2-1, Full neck | 1-1-0, 5-5-4, 9-9-8, 13-13-12, 17-17-16, 21-21-20; tags 2nd, Root position, 1st, … |
| 9 | Root D♯ (Switch to D♯), major, All notes, Note names | F𝄪 markers, not G |
| 10 | **Reset tool** | Back to C major, root position, 3-2-1, Isolated |

Fixture instruments (dev/test builds; set before load, e.g. in the browser console then reload,
or via Playwright `addInitScript`):

| `globalThis.__fmInstrument` | Check |
|---|---|
| `'AF-1-12'` | Isolated, C diminished, root position, 5-4-3 (15-13-11) → "This shape lies beyond fret 12" + **See all notes** → All notes; inversion/set/occurrence unchanged. Same selection in Full neck shows the 1st/2nd shapes that fit, no message (EC-5.3) |
| `'NC-UNISON'` | Set 3-2-1 → does-not-close guidance with **Another set** (→ 5-4-3, view kept) and **See all notes**; same guidance in Full neck, no tags row |
| `'SHORT-7'` | A major 3-2-1, Full neck → only 2-2-0 and 6-5-5, no message |
| `'AF-8'` | G major, All notes (TM-9 view 14) |

## Responsive and accessibility spot checks

- 320 px and 2560 px wide, and 200 % browser zoom: no page horizontal scroll; only the fretboard
  (with its tag strip) scrolls; tags never overlap (second row when needed); tags ≥ 44×44 px.
- `prefers-reduced-motion: reduce`: entering Full neck jumps (no animated scroll).
- Screen reader: switching view announces the C18 description once; scrolling announces nothing.
