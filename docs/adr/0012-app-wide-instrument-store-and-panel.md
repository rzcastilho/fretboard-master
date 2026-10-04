# ADR 0012: App-wide instrument store and panel

- **Status**: Accepted
- **Source**: spec 009-instrument-panel-and-tunings (plan Complexity Tracking)

## Context

Every tool (Notes, Triads, the home thumbnails) draws the same instrument. A learner changes the
tuning or fret count from any screen, and the change must reach all tools at once, without losing
the tool's own view state where it is still valid (FR-009, FR-014). Earlier specs fixed the
instrument to Standard / 22 frets. Spec 008 also forbids URL state and says only screen changes
add history entries.

## Decision

- **One app-wide store.** `instrument.svelte.ts` is a module singleton that owns the active
  instrument and the panel's pending edits (preset, fret count). It lives above the routes, is
  mounted from `+layout.svelte`, and resets to Standard / 22 on reload (FR-018). Nothing is
  written to the URL or to storage.
- **Edit pending, apply on Confirm.** The panel edits a pending copy. Close, Escape, backdrop and
  Back discard it, so the active instrument never changes until Confirm.
- **Confirm orchestration.** Confirm sets the active instrument, then calls each tool store's
  `applyInstrument` (Notes adapts region and card, Triads clamps the occurrence and keeps root,
  quality, inversion and string set). If a view had to change, one polite status explains it. A
  confirm with no change is a no-op.
- **Temporary shallow-history entry for Back.** Opening the panel pushes one entry so that browser
  Back closes the panel and leaves the learner on the same screen (FR-009). Every other close
  path removes the entry with `history.back()`, so net history is unchanged.
- **Presets are stored, not derived.** Preset spellings (E♭, F♯) come from the stored table and
  are never respelled; the theory modules are unchanged.

## Consequences

- Tools never read the panel's pending state; they react only to the active instrument.
- The shallow entry is a deliberate exception to "only screen changes add history entries". It
  adds no URL state and is balanced on every close path.
- `Fretboard` gains a non-interactive `preview` variant, because `thumbnail` caps at 12 frets.
- New tools must expose an `applyInstrument` and be added to the confirm orchestration.

## Alternatives considered

- **No history entry**: Back would leave the screen while the panel is open.
- **Hash or query URL for the panel**: changes the URL, which spec 008 forbids.
- **Per-tool instrument state**: the tools would drift apart and each would need its own panel.
