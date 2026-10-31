# Contract: Subdivision Ratio UI (DOM, ARIA, tokens, messages)

Delta against `specs/033-count-in/contracts/metronome-ui.md`.

## 1. Settings view (`phase === 'settings'`)

Order inside `section.panel`: `h2` heading, BPM row, # of Beats row, Count In switch and rows,
**SUBDIVISION RATIO header with switch (new)**, Loop 1 select, **Loop 2 select (new, when on)**,
Start Training.

`RatioSettings.svelte` (new, `src/lib/tools/metronome/`):

```html
<div class="ratio">
  <div class="ratio-header">
    <h3 id="metronome-ratio-heading">Subdivision ratio</h3>   <!-- all-small-caps -->
    <button type="button" class="switch" role="switch" aria-checked="true"
            aria-labelledby="metronome-ratio-heading">
      <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
      <span class="state" aria-hidden="true">On</span>
    </button>
  </div>
  <SubdivisionSelect id="metronome-subdivision" label="Loop 1" … />
  <!-- only when aria-checked="true" -->
  <SubdivisionSelect id="metronome-loop2" label="Loop 2" … />
</div>
```

`SubdivisionSelect.svelte` (edited): new `id` and `label` props; options, chevron and
forced-colours rule unchanged.

| # | Rule | Spec |
|---|---|---|
| U1 | `getByRole('heading', { level: 3, name: 'Subdivision ratio' })` exists; CSS `font-variant-caps: all-small-caps`, size and weight from tokens. | FR-001, FR-014 |
| U2 | `getByRole('switch', { name: 'Subdivision ratio' })`; `aria-checked` mirrors `settings.ratio`; click, Enter, Space toggle it; Space does not start training. The header row is a flex row with the switch on the inline end; it wraps at narrow widths without clipping. | FR-001, FR-011 |
| U3 | Switch styled only by the global `.switch` family (`controls.css`); target ≥ `var(--target-min)` (44 px ≥ 24 px); global focus ring. No new colour token. | FR-011, FR-014 |
| U4 | `getByRole('combobox', { name: 'Loop 2' })` lists the same eight options as Loop 1 in the same order (`subdivisionLabel(n)`), default "Sextuplets (6)". | FR-002 |
| U5 | Section off: the Loop 2 select is not in the DOM; Loop 1 stays. Turning on again shows the kept Loop 2 value. | FR-003 |
| U6 | Not rendered outside the settings phase. | FR-011, US2-6 |
| U7 | 320 CSS px, 200 % text zoom, en/pt-BR/es, every theme incl. high contrast and forced colours: header, switch and both selects visible, no horizontal scroll, axe zero violations. | FR-014, SC-006 |

## 2. Running view

`StatusBox` is unchanged in markup; the panel passes `sub={metronome.sub}` and
`countIn={metronome.countIn}`.

| # | Rule | Spec |
|---|---|---|
| R1 | Loop: `BEAT b/N · SUB s` with `s` the playing loop's clicks per beat; it changes on beat 1 of the next loop. | FR-007, US1-2 |
| R2 | Repeat count-in: `COUNT IN n/r` and the single pulsing dot (033 markup and reduced-motion rule). | FR-006, FR-007, US1-3 |
| R3 | Loop start: full dot row with beat 1 lit, later dots upcoming. | Clarifications |
| R4 | Text updates when each slot's audio time is reached (one frame at most). | FR-007 |
| R5 | `COUNT IN 8/8` and `BEAT 16/16 · SUB 8` fit at 320 CSS px (033 `nowrap` parts). | Edge Cases |

## 3. Messages (`messages/{en,pt-BR,es}.json`)

| Key | en |
|---|---|
| `metronome_ratio_heading` | Subdivision ratio |
| `metronome_loop2_label` | Loop 2 |
| `metronome_announce_started_ratio` | Started, {bpm} BPM, {beats} beats, {loop1} then {loop2} |
| `metronome_announce_started_ratio_count_in` | Started, {bpm} BPM, {beats} beats, {loop1} then {loop2}, count in {count} |
| `metronome_announce_paused_loop` | Paused on beat {beat} of {beats}, {subdivision} |

pt-BR and es texts: research.md R-10. Reused: `metronome_subdivision_label` (Loop 1),
`metronome_switch_on/off`, `metronome_status_*`, `metronome_announce_paused_count_in*`,
`metronome_announce_resumed`, `metronome_announce_reset`.

## 4. Tokens

No new token. Header: `--font-size-md`, `--font-weight-bold`, `--space-*`; switch:
`--switch-*`, `--target-min`; selects: as 032.
