# Contract: Timer card UI

**Component**: `src/lib/tools/metronome/TimerCard.svelte`, rendered by
`src/lib/tools/metronome/MetronomeLayout.svelte`. See [research.md](../research.md) R-08–R-12
and [data-model.md](../data-model.md) §5–§6.

## 1. Placement

- In `MetronomeLayout.svelte`, inside `<main>`, after the `<h1>` and **before** the metronome
  panel. It is wrapped in its own `<svelte:boundary>`, whose fallback is `FailureView` with
  `reset = () => timer.restore(timer.preset)`.
- It is outside `#metronome-mode-panel`, so it is the same in the Metronome, Speed Training and
  Ratios Training modes (FR-001, FR-010).
- `max-inline-size: var(--metronome-panel-max)`, aligned with the panel. The card has
  `data-print="omit"`.

## 2. Structure (DOM order = reading and focus order)

```html
<section class="timer" aria-labelledby="timer-heading"
         data-status="{status}" data-flash?>                      <!-- data-flash only while flashing -->
  <h2 id="timer-heading"><svg aria-hidden="true">stopwatch</svg>{m.timer_heading()}</h2>
  <div role="group" aria-label={m.timer_presets_label()} class="presets">
    <!-- ×10, n = 1…10 -->
    <button type="button" aria-pressed={n === preset} onclick={() => timer.selectPreset(n)}>{m.timer_preset({ minutes: n })}</button>
  </div>
  <div class="face">
    <div class="readout" role="timer" aria-label={m.timer_readout_label()}>
      <span class="ghost" aria-hidden="true">88:88</span><span class="digits">{readout}</span>
    </div>
    <button type="button" class="play" aria-label={running ? m.timer_pause() : m.timer_start()} onclick={timer.toggle}>
      <svg aria-hidden="true">play | pause</svg>
    </button>
  </div>
  <div class="sr-only" role="status" aria-live="polite">{timer.announcement}</div>
</section>
```

## 3. Guarantees

| # | Guarantee |
|---|---|
| U1 | There are exactly ten preset buttons, labelled `1m`…`10m` from the catalog. Exactly one has `aria-pressed="true"`, and it matches `timer.preset` (FR-003) |
| U2 | The selected pill has a `--color-accent-secondary` outline, `--font-weight-bold` and a 2 × `--border-width` border. Unselected pills have `--color-border`. Selection is visible without colour |
| U3 | The play button's name is "Start timer" in `stopped`, `paused` and `finished`, and "Pause timer" in `running`. The icon swaps play ↔ pause (FR-002) |
| U4 | The readout shows `timer.readout`. It has `role="timer"` and no `aria-live` other than the implicit `off`. The ghost layer is `aria-hidden` (FR-013) |
| U5 | The polite status region exists only inside the card, so nothing is announced off the Metronome page (FR-013) |
| U6 | `data-status="finished"` gives a static finished style. While `data-flash` is set, the readout animates with `steps(2)` over `--timer-flash-period`. Under `prefers-reduced-motion: reduce` there is no animation, and a static highlight is shown while `data-flash` is set (FR-007) |
| U7 | Space or Enter on any timer button activates only that button. The metronome does not toggle, because native buttons satisfy `targetActivates` in `MetronomePanel.onKeydown`, and no new key handler is added (FR-017) |
| U8 | Every button meets WCAG 2.5.8: pills are at least 24 × 24 CSS px, and the play button is `--timer-play-size` (≥ `--target-min`). Focus uses the shared focus ring |
| U9 | At 320 CSS px and at 200 % text zoom, the pills wrap (`flex-wrap`), the face row wraps under the readout if needed, nothing overlaps, and there is no horizontal page scroll. This holds in en, pt-BR and es (FR-015, SC-006) |
| U10 | Only tokens are used: no literal colours, sizes or durations (`style-tokens.test.ts`). Root, third and fifth colours are not referenced (`reserved-colors.test.ts`) |
| U11 | Zero axe violations on `/metronome` in light, dark and `prefers-contrast: more`. The pill outline and the play button reach ≥ 3:1 non-text contrast and the digits ≥ 4.5:1 |
| U12 | The card adds no visible text outside the catalog (`no-raw-text.test.ts`) |
| U13 | No-JS (prerendered): the card renders with `2m` pressed and `02:00`. The buttons are inert, as are the rest of the metronome's controls |
