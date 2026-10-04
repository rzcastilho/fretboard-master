# Contract: Instrument panel and entry points (UI)

**Feature**: 009-instrument-panel-and-tunings | API: [instrument-config-api.md](./instrument-config-api.md)

The user-facing interface of this slice. Playwright and component tests select elements by
**role and accessible name** (English catalog), never by CSS class.

## 1. Entry points

| Surface | Element | Role / name | Shown when | Action |
|---|---|---|---|---|
| Home, bottom zone | `InstrumentSummary` | `button` "6 strings · standard tuning · right-handed" or "6 strings · {name} · right-handed" | always | open panel |
| Tool app bar (zone A) | `InstrumentButton` | `button` "Instrument" | always (Notes, Triads, placeholders) | open panel |
| Tool app bar (zone A) | `TuningBadge` | `button` "Tuning: {name}. Open instrument panel"; visible text = `{name}` exactly as in the list | `tuningId ≠ AF-1` (any fret count) | open panel |

The element that opened the panel receives focus again when the panel closes by any means.

## 2. Panel

`dialog` named "Instrument" (heading `h2`, `aria-labelledby`), opened modally.

- **Layout**: viewport < 1024 CSS px → bottom sheet (full inline size, anchored to block end,
  max block size 90dvh, internal scroll); ≥ 1024 → side panel at inline end (fixed inline
  size from tokens, full block size). Fretboards of the underlying screen are never covered by
  controls *outside* the panel; the panel itself is the surface (design §5.5).
- **Contents, in tab order**:
  1. `group` "Tuning" — 11 `radio` items in TM-2 order. Accessible name:
     "{name}: {notes spoken}" e.g. "Half step down: E flat, A flat, D flat, G flat, B flat, E
     flat"; visible: name + glyph notes "E♭ A♭ D♭ G♭ B♭ E♭". Checked = pending tuning.
  2. Fret stepper: `button` "Fewer frets", `spinbutton` "Frets" (`aria-valuemin=12`,
     `aria-valuemax=24`, `aria-valuenow`), `button` "More frets". "Fewer frets" disabled at
     12, "More frets" disabled at 24. Keys on spinbutton: ArrowUp/ArrowDown ±1, Home 12,
     End 24.
  3. Preview fretboard — not focusable, `aria-hidden`, labelled visually "Preview".
  4. `button` "Restore default".
  5. `button` "Confirm" (always enabled).
  6. `button` "Close".
- **Initial focus**: the checked radio.
- **Dismissal without applying** (FR-009): Escape, "Close", click on backdrop, browser Back.
  User stays on the same screen; URL unchanged; history length after close equals before
  open.
- **Confirm**: closes, applies per data-model §4.
- All targets ≥ 44 × 44 CSS px; all colors/spacing/durations from tokens; works 320–2560 px
  and at 200 % text zoom without truncation (long Portuguese/Spanish names wrap).

## 3. Tool-side effects visible to the user

| After confirm | Expected |
|---|---|
| Tuning ≠ Standard | badge with preset name in every tool app bar |
| Tuning = Standard | no badge |
| Current tool view adjusted | `status` "We adjusted the view to the new instrument" with "Dismiss" |
| View unchanged | no adjustment status |
| Fretboard scrolled beyond new last fret | scrolls so last fret is at trailing edge (no status) |
| Home | summary text updated, card thumbnails drawn on the active instrument |
| Sound | stops iff instrument changed; next tap plays new pitch (e.g. Drop D string 6 open = D2) |

## 4. Non-goals in this contract

No URL parameter, no storage key, no share-link field (later slices). No custom tuning,
string count, handedness or orientation controls.
