# Contract: CAGED UI delta (slice 015)

This contract extends `specs/014-caged-shapes/contracts/caged-ui.md`. It is binding for the
components and the E2E specs.

## §1 States of zone C (`CagedTool.svelte`)

| Effective class | Zone C content | Fit note | Header badge |
|---|---|---|---|
| `compatible`, preferred tuning | Tag strip + fretboard (Standard drawing, real notes) | as 014 | FR-2.10 badge iff non-standard (e.g. "Half step down") |
| `altered-string` | Tag strip + fretboard; string 6 label column shows "altered" | as 014 (fit on 5→1) | FR-2.10 badge ("Drop D") |
| `non-compatible` | Notice paragraph + two buttons; **no** fretboard, tags or fit note | none | FR-2.10 badge (e.g. "Open G") |
| `compatible` via temporary tuning | Tag strip + fretboard in Standard / 7-string standard | as 014 | **Temporary badge** replaces FR-2.10 badge |

Zone B (key selector, quality, Switch to {root}, key name) and zone D (Reset tool) are present
in every state and keep their values.

## §2 Non-compatible notice

```html
<div class="unsupported">
  <p role="status">CAGED depends on the standard relationship between the strings, so its
     shapes don't exist in Open G.</p>
  <div class="actions">
    <button type="button">View in standard tuning</button>
    <button type="button">Go to Triads</button>
  </div>
</div>
```

- The two buttons appear in this order and are native buttons with targets ≥
  `--target-min`. They wrap on narrow widths and never truncate at 200 % zoom.
- The text uses neutral colour (`--color-text`), not error red. The notice is not dismissible,
  because it is the fallback view (plan Complexity Tracking).
- **View in standard tuning** calls `caged.viewInStandard()`. Focus then moves to the zone C
  heading (`#caged-zone-c`), because the button disappears.
- **Go to Triads** calls `openTriadsFromCaged()`. The layout's `afterNavigate` focuses the new
  `h1`.

## §3 Temporary badge (`TuningBadge.svelte`)

- **When shown**: while `caged.temporaryName !== null`, in place of the FR-2.10 badge.
- **Visible text**: `Temporary tuning: Standard` (or `Temporary tuning: 7-string standard`).
- **Accessible name**: `Temporary tuning: Standard. Open instrument panel`.
- **Activation**: same as today (`rememberOpener`, `instrument.open()`). The panel shows the
  **preferred** instrument selected.
  - **Confirm** ends the temporary tuning and applies the chosen instrument.
  - **Cancel** or Back keeps the temporary view; focus returns to the badge.
- **Lifetime**: visible at 320–2560 px (the header wraps), with no time-out or auto-dismiss.

## §4 Altered mark

- **Where**: visible SVG text "altered" in the label column of string 6, below "6 D", whenever
  the effective class is `altered-string`. That includes G/E occurrences with no string-6
  marker, and C/A/D-only boards on short necks.
- **Mirroring**: mirrored with the label column for left-handed and lowest-top layouts.
- **Never shown** in compatible tunings, in non-compatible tunings, or in the temporary view.
- **Not focusable**: the description carries it.

## §5 Catalog keys (`messages/en.json`)

| Key | English |
|---|---|
| `caged_tuning_unsupported` | `CAGED depends on the standard relationship between the strings, so its shapes don't exist in {tuning}.` |
| `caged_view_in_standard` | `View in standard tuning` |
| `caged_go_to_triads` | `Go to Triads` |
| `caged_temporary_badge` | `Temporary tuning: {name}` |
| `caged_temporary_badge_label` | `Temporary tuning: {name}. Open instrument panel` |
| `caged_altered_mark` | `altered` |
| `caged_description_tuning` | `Tuning: {tuning}.` |
| `caged_description_temporary` | `Temporary tuning: {tuning}.` |
| `caged_description_altered` | `String {string} is altered: it shows only the chord notes inside each shape.` |

Removed: `caged_tuning_unavailable` (the slice-014 interim text). `no-raw-text` covers all the
new markup.

## §6 Keyboard and screen readers

- **Tab order in the non-compatible state**: zone B controls → **View in standard tuning** →
  **Go to Triads** → Reset tool. The header (including the badge) comes before them, as today.
- **Announcements**:
  - The notice is `role="status"`, so it is announced politely when the class changes while
    open (FR-011).
  - The fretboard's polite live description announces the tuning sentence and the altered
    sentence when the board updates.
- **Nothing relies on colour alone**: the badge, the mark and the notice are all text.

## §7 E2E coverage (`e2e/caged-tunings.spec.ts`, new)

Instrument preferences are seeded through `localStorage['fretboard-master:prefs']` (v1 record)
before `goto`, so the *stored* preference can be asserted unchanged (SC-005). Fixtures
(`__fmInstrument`) are used only where storage is irrelevant.

| Test | Scenario |
|---|---|
| E1 | US1-1: Open G → notice text, both buttons, 0 markers, 0 tags, no fit note |
| E2 | US1-2: View in standard tuning, C major → 5 tags as Standard, badge "Temporary tuning: Standard", prefs record still AF-8 |
| E3 | US1-3: Go to Notes and back to CAGED → notice again |
| E4 | US1-4: Go to Triads → `/triads`, FR-2.10 badge "Open G" |
| E5 | US1-5: Standard CAGED, panel → DADGAD → Confirm → notice, key/quality kept |
| E6 | US1-6: 7-string non-compatible → badge "Temporary tuning: 7-string standard", 7 string rows |
| E7 | US1-7: change key/quality keeps the badge; reload → notice |
| E8 | US1-8: badge opens panel with Open G selected; Cancel keeps temporary; Confirm ends it |
| E9 | US2-1/2: Half step down, E♭ major / G♭ major → tag text and marker names |
| E10 | US2-3: AF-3, AF-21, AF-22, AF-23 → shapes drawn, no "altered" mark, no temporary badge |
| E11 | US3-1/3: Drop D, D major → "altered" visible; string 6 markers only at frets 7 and 12 in the E/G regions; tags omit 6 |
| E12 | US3-4/5: Drop D with a C/A/D-only window or an empty region → mark present |
| E13 | US3-6: Drop C occurrence tags start where Whole step down's do |
| E14 | SC-001 sweep: each of the 14 presets → expected class UI (shapes / mark / notice) |
| A1–A4 | axe: notice state, temporary view, Drop D, left-handed + lowest-top Drop D (mark mirrored), 320 px |

The interim-message cases in `e2e/caged.spec.ts` (Q18 list, "axe: Drop D shows the message")
change expectation:

- AF-4 now draws shapes;
- the non-compatible ids show the new notice.

They are edited, not deleted.

`e2e/perf.spec.ts` gains "CAGED instrument change to DADGAD ≤ 300 ms" (SC-006).

Screenshot fixtures (phone, phone-touch, desktop), new in `e2e/caged-tm9.spec.ts`:

- "Drop D, D major" (altered mark, TM-8.3);
- "Open G notice".

The TM-9 views that need focus or layers stay out of scope.
