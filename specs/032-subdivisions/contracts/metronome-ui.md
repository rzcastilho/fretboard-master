# Contract: Subdivision UI (DOM, ARIA, tokens, messages)

Delta against `specs/031-metronome-tool-and-click-engine/contracts/metronome-ui.md`.

## 1. Settings view (`phase === 'settings'`)

Order inside `section.panel`: heading, BPM row, # of Beats row, **Loop 1 row (new)**, Start
Training. (Slices 003/004 will insert Count In rows between # of Beats and Loop 1.)

`SubdivisionSelect.svelte` (new, `src/lib/tools/metronome/`):

```html
<div class="field">
  <label for="metronome-subdivision">Loop 1</label>
  <div class="control">
    <select id="metronome-subdivision">
      <option value="1">Quarter notes (1)</option>
      <option value="2">8th notes (2)</option>
      <option value="3" selected>8th Triplets (3)</option>
      <option value="4">16th notes (4)</option>
      <option value="5">Quintuplets (5)</option>
      <option value="6">Sextuplets (6)</option>
      <option value="7">Septuplets (7)</option>
      <option value="8">32nd notes (8)</option>
    </select>
    <svg class="chevron" aria-hidden="true" focusable="false"><!-- chevron path --></svg>
  </div>
</div>
```

Props: `value: Subdivision`, `onchange: (v: unknown) => void` (the panel passes
`metronome.setSubdivision`). Labels come from `subdivisionLabel(n)`.

| # | Rule | Spec |
|---|---|---|
| U1 | Accessible name of the combobox is the visible label ("Loop 1" / "Bucle 1"), via `for`/`id`. `getByRole('combobox', { name: 'Loop 1' })` finds it. | FR-003 |
| U2 | Options in the order 1…8, text `{name} ({n})`; default selected `3`. | FR-002 |
| U3 | Closed control shows the selected option's label (native behaviour). | FR-002 |
| U4 | `inline-size: 100%` of the panel; `min-block-size: var(--target-min)` (≥ 24 px). | FR-001, FR-003 |
| U5 | Colours only from tokens: background `--color-surface-raised`, text `--color-text`, border `--color-border`, radius `--radius-md`, padding `--space-*`; the chevron uses `currentColor` with `--bar-icon-size`. No literals (style lint). | FR-014, C VII |
| U6 | Focus ring: the global `:focus-visible` rule; the scoped style never removes `outline`. | FR-003 |
| U7 | `@media (forced-colors: active)`: `appearance: auto` on the select, `.chevron { display: none }`. | FR-014 |
| U8 | The select is not rendered in `starting`, `running` or `paused` phases (the whole settings block is replaced by the running view). | US2-5 |
| U9 | Space/Enter/Arrow keys on the focused select never start the run (`metronome-keys` treats `SELECT` as editable). | US2-4 |
| U10 | At 320 CSS px, the select shrinks with the column (`min-inline-size: 0`), the text may ellipsize inside the native control but the control itself is never clipped; no horizontal page scroll. | FR-014 |

## 2. Running view status line

```html
<p class="position">
  <span class="part">BEAT 2/4</span><span class="sep"> · </span><span class="part">SUB 3</span>
</p>
```

| # | Rule | Spec |
|---|---|---|
| R1 | Text is `{beat message}{summary_separator}{metronome_status_sub}`, so `textContent` reads `BEAT 2/4 · SUB 3` (`TEMPO …` pt-BR, `TIEMPO …` es). | FR-006 |
| R2 | Before the first click: `BEAT –/4 · SUB 3`. Paused: frozen beat with the suffix. | FR-006 |
| R3 | `.part { white-space: nowrap }`: the line can wrap only at the separator; never truncated, no horizontal scroll. | FR-014 |
| R4 | Dots: one per beat, unchanged; soft clicks never change dots or text. | FR-007 |

## 3. Live region

`metronome_announce_started` adds the subdivision name:

| Locale | Value |
|---|---|
| en | `Started, {bpm} BPM, {beats} beats, {subdivision}` |
| pt-BR | `Iniciado, {bpm} BPM, {beats} tempos, {subdivision}` |
| es | `Iniciado, {bpm} BPM, {beats} tiempos, {subdivision}` |

Other announcements unchanged.

## 4. Messages (new keys)

| Key | en | pt-BR | es |
|---|---|---|---|
| `metronome_subdivision_label` | Loop 1 | Loop 1 | Bucle 1 |
| `metronome_subdivision_option` | {name} ({count}) | {name} ({count}) | {name} ({count}) |
| `metronome_status_sub` | SUB {count} | SUB {count} | SUB {count} |
| `metronome_subdivision_1` | Quarter notes | Semínimas | Negras |
| `metronome_subdivision_2` | 8th notes | Colcheias | Corcheas |
| `metronome_subdivision_3` | 8th Triplets | Tercinas de colcheia | Tresillos de corchea |
| `metronome_subdivision_4` | 16th notes | Semicolcheias | Semicorcheas |
| `metronome_subdivision_5` | Quintuplets | Quintinas | Quintillos |
| `metronome_subdivision_6` | Sextuplets | Sextinas | Seisillos |
| `metronome_subdivision_7` | Septuplets | Septinas | Septillos |
| `metronome_subdivision_8` | 32nd notes | Fusas | Fusas |

Identical-value allowlist (`tests/unit/i18n/identical-allowlist.ts`): `SHARED` gains
`metronome_subdivision_option` and `metronome_status_sub`; `pt-BR` gains
`metronome_subdivision_label`.

## 5. Tokens

No new token is expected. If the chevron needs its own size, add
`--metronome-chevron-size` to `src/lib/styles/tokens.css` aliasing `--bar-icon-size`.

## 6. Test hooks

`__fmAudioLog` `click` entries carry `kind` and `slot` (engine contract §3). No other hook.
