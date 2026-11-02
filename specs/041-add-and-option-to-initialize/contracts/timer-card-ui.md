# Contract: Timer card switch (041)

Extends [039 timer-card-ui](../../039-practice-timer/contracts/timer-card-ui.md).

- Placement: last row of `src/lib/tools/metronome/TimerCard.svelte`, after the preset group and
  before the polite status region.
- Element: `<button type="button" class="switch" role="switch" aria-checked={timerLink.enabled}>`,
  same markup as `CountInSettings.svelte`: `.switch-track` / `.switch-thumb` (aria-hidden), the label
  `m.timer_link_label()`, and an aria-hidden state word (`m.metronome_switch_on()` /
  `m.metronome_switch_off()`).
- Accessible name: "Start and stop with metronome" (en), "Iniciar e parar com o metrônomo" (pt-BR),
  "Iniciar y detener con el metrónomo" (es). Role `switch`, state from `aria-checked`.
- Activation: click, Enter or Space toggles via `timerLink.setEnabled(!timerLink.enabled)`. Space on
  the switch toggles the switch, not the metronome: the metronome's key handler already treats a
  focused `button` / `[role="switch"]` as the activation target (`targetActivates`).
- Never disabled: it can be toggled in any metronome phase or timer status (FR-016).
- Target ≥ `--target-min`, visible focus ring from `controls.css`, wraps at 320 px and 200 % text zoom,
  no new colour tokens.
- Test hooks: located by role and name (`getByRole('switch', { name: … })`); no `data-*` needed.
