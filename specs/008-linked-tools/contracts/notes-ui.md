# Contract: Notes UI additions

This contract extends `specs/004-fretboard-notes-tool/contracts/notes-ui.md`.

## 1. `DetectedTriad.svelte` (new, `src/lib/tools/notes/`)

```ts
interface Props {
  detected: DetectedTriad | null; // from notes.display.detected
  onview: () => void;             // viewAsTriad
}
```

- **Placement**: Notes zone B, directly below `NoteSelector`. It is never over the fretboard
  (Principle VII).
- **Rendering**: renders nothing at all when `detected === null`: no placeholder and no
  message (FR-010). Otherwise:
  - `<p id="notes-detected-triad">` with the visible `detected.name` (`aria-hidden`), plus a
    visually hidden `detected.spokenName` ("G sharp augmented"), so accidentals are read in
    full (V, FR-016);
  - `<button type="button" aria-describedby="notes-detected-triad">` with the label **View as
    triad** (`notes_view_as_triad`).
- **Hide names**: the component shows even when `hideNames` is on (Clarification Q7).
- **Styling**: only tokens. The button uses the same style as the other Notes buttons, with a
  44×44 minimum target and visible focus. It reflows at 320 px and 200 % text zoom with no
  truncation.

## 2. `PositionCard.svelte` (changed)

- New prop `ontriads: (pc: PitchClass) => void`.
- A new button **Triads from this note** (`notes_card_triads_from_note`) is placed in
  `.actions`, before **Close**. Activating it calls `ontriads(info.pitchClass)`.

## 3. `AppNav.svelte` (changed)

- Tool links get an `onclick` that calls `linkTools(current, item.id)` under the conditions in
  [links-api.md §3](./links-api.md). The `href` is unchanged, so links work without JS.

## 4. `ToolLayout.svelte` (changed)

- The failure snippet passes
  `reset={() => { resetTool(tool); boundaryReset(); }}` to `FailureView` (EC-1.3).

## 5. Message catalog (`messages/en.json`, new keys)

| Key | English | Params |
|---|---|---|
| `notes_triad_name` | `{root} {quality}` | root: note label from notation; quality: `triads_quality_*` |
| `notes_view_as_triad` | `View as triad` | — |
| `notes_card_triads_from_note` | `Triads from this note` | — |
| `notes_desc_triad` | `The selected notes form {name}.` | name: the spoken name |

Note names always come from `src/lib/notation` (`noteLabel`, `spokenNote`), and accidentals use
♯ ♭ 𝄪 𝄫 (Principle VIII). The quality words reuse the existing `triads_quality_*` keys.

## 6. Accessibility and announcements

- The detected name is appended to the fretboard's polite description, so a screen reader
  hears "The selected notes form G sharp augmented."
- Every new control is a native `<button>`: keyboard-operable, in logical order (selector →
  detected triad → fretboard), with no traps. axe must report zero violations
  (SC-006).
