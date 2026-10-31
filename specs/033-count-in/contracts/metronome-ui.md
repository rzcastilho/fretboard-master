# Contract: Count In UI (DOM, ARIA, tokens, messages)

Delta against `specs/032-subdivisions/contracts/metronome-ui.md`.

## 1. Settings view (`phase === 'settings'`)

Order inside `section.panel`: heading, BPM row, # of Beats row, **Count In switch (new)**,
**Initial Count In row (new, when on)**, **Repeat Count In row (new, when on)**, Loop 1 select,
Start Training.

`CountInSettings.svelte` (new, `src/lib/tools/metronome/`):

```html
<div class="count-in">
  <button type="button" class="switch" role="switch" aria-checked="true">
    <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
    Count In
    <span class="state" aria-hidden="true">On</span>
  </button>
  <!-- only when aria-checked="true" -->
  <ValueRow id="metronome-initial-count-in" label="Initial Count In" min=0 max=8 … />
  <ValueRow id="metronome-repeat-count-in"  label="Repeat Count In"  min=0 max=8 … />
</div>
```

Props: `settings: MetronomeSettings` (reads `countIn`, `initialCountIn`, `repeatCountIn`) and
callbacks wired by the panel to the store setters.

| # | Rule | Spec |
|---|---|---|
| U1 | `getByRole('switch', { name: 'Count In' })` finds the switch; `aria-checked` mirrors `settings.countIn`; click, Enter and Space toggle it (native button activation). The visible state word is aria-hidden so the name stays "Count In". | FR-001, FR-005 |
| U2 | Styling only from the global `.switch` family (`controls.css`, ADR 0028); `min-block-size`/`min-inline-size: var(--target-min)` (44 px ≥ 24 px). Focus ring from the global `:focus-visible` rule. | FR-004, FR-018 |
| U3 | When on: two `ValueRow`s; `getByRole('slider', { name: 'Initial Count In' })` / `'Repeat Count In'`; `aria-valuetext` = the number; pill `output` shows the value; − named "Fewer initial count-in clicks" (etc.), `disabled` at 0; + `disabled` at 8. | FR-002, FR-004 |
| U4 | When off: both rows are not in the DOM (no tab stop, no accessibility node). Turning on again shows the kept values. | FR-003 |
| U5 | Space on the focused switch toggles it and does not start training; Space on a slider or −/+ behaves as in 031. | FR-005 |
| U6 | Not rendered in `starting`, `running` or `paused` (the settings block is replaced by the running view). | FR-005, US2-7 |
| U7 | At 320 CSS px and 200 % text zoom, the switch label + state word may wrap inside the button but are never clipped; rows reflow with the 031 `ValueRow` narrow rule; no horizontal scroll. | FR-018 |

## 2. Running view during the count-in

```html
<p class="position"><span class="part">COUNT IN 2/4</span></p>
<p class="tempo">…</p>
<ol class="dots count-in" aria-hidden="true">
  <li class="dot pulse" data-state="lit"></li>   <!-- {#key click} remounts it per click -->
</ol>
```

| # | Rule | Spec |
|---|---|---|
| R1 | `.position` textContent is exactly `COUNT IN n/k` (pt-BR `CONTAGEM n/k`, es `CUENTA n/k`); before click 1 `COUNT IN –/k`. No `· SUB n` part. Real text, `.part { white-space: nowrap }`. | FR-010 |
| R2 | Exactly one `.dot`; `data-state="upcoming"` before click 1, `"lit"` from click 1 on. | FR-009 |
| R3 | Pulse: `@keyframes` scale 1 → `var(--metronome-pulse-scale)` → 1, `animation-duration: var(--duration-base)` (200 ms), `animation-timing-function: var(--ease-standard)`, once per click (element remounted per click). | FR-009 |
| R4 | `@media (prefers-reduced-motion: reduce)`: `.dot.pulse { animation: none }`; the dot still switches to `lit`. | FR-009, US1-3 |
| R5 | Forced colours: the 031 dot rules apply (lit = `Highlight` fill and border). | FR-018 |
| R6 | When the first loop beat is reported, the dot row (one per beat, 031 rules) and `BEAT n/N · SUB n` replace the single dot and count-in text. | FR-009, US1-5 |
| R7 | Paused during the count-in: single dot and `COUNT IN n/k` (or `–/k`) stay frozen. | FR-011, US3-1 |

## 3. Live region

| Event | en | pt-BR | es |
|---|---|---|---|
| Start, k > 0 | `Started, {bpm} BPM, {beats} beats, {subdivision}, count in {count}` | `Iniciado, {bpm} BPM, {beats} tempos, {subdivision}, contagem {count}` | `Iniciado, {bpm} BPM, {beats} tiempos, {subdivision}, cuenta {count}` |
| Start, k = 0 | unchanged (032) | unchanged | unchanged |
| Pause in count-in | `Paused on count-in click {click} of {count}` | `Pausado na contagem {click} de {count}` | `En pausa en la cuenta {click} de {count}` |
| Pause before click 1 | `Paused before the count-in` | `Pausado antes da contagem` | `En pausa antes de la cuenta` |
| Resume, Reset, Pause in loop | unchanged | unchanged | unchanged |

Individual count-in clicks are never announced.

## 4. Messages (new keys)

See [research.md R-10](../research.md#r-10-status-line-announcements-and-messages) for the full
en / pt-BR / es table (14 keys). No value is identical to English, so
`tests/unit/i18n/identical-allowlist.ts` is unchanged. `docs/i18n/glossary.md` gains rows for
Count In, Initial Count In and Repeat Count In.

## 5. Tokens

One new token in `src/lib/styles/tokens.css`: `--metronome-pulse-scale: 1.25`. Durations reuse
`--duration-base` and `--ease-standard` (already 0 s under reduced motion). Switch tokens
(`--switch-track-inline`, `--switch-track-block`, `--switch-thumb-inset`) already exist.

## 6. Test hooks

`__fmAudioLog` `click` entries carry `countIn` (engine contract §3). No other hook.
