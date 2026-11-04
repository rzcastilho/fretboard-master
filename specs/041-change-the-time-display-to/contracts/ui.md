# Contract: UI changes (042)

## A. Timer readout (`src/lib/tools/metronome/TimerCard.svelte`)

- `.readout` keeps `role="timer"`, `aria-label={m.timer_readout_label()}`, and its children
  (`.ghost` `88:88` `aria-hidden`, `.time` = `timer.readout`). Text content unchanged.
- `.readout` `font-family: var(--font-family-timer)` (=`'FM Timer Digits', var(--font-family-ui)`),
  `font-variant-numeric: tabular-nums` kept. No other element uses `--font-family-timer`.
- `<svelte:head>` preload link: `rel="preload" as="font" type="font/woff2"
  href="/fonts/fm-timer-digits.woff2" crossorigin`.
- Bounding-box width identical for every readout value (idle, running, paused, finished).
- No new animation; reduced-motion behaviour from 039 unchanged.
- Test hooks: `getComputedStyle(.time).fontFamily` starts with `"FM Timer Digits"`;
  `document.fonts.check('1em "FM Timer Digits"')` is true after load on `/metronome`; on `/`
  and `/notes`, with service workers blocked (the Playwright default), the page makes no request
  to `/fonts/fm-timer-digits.woff2`. The service worker's install-time precache fetch is exempt
  (FR-003) and is covered by the offline checks instead.

## B. Switches (all `role="switch"` buttons)

Markup after 042:

```svelte
<button type="button" class="switch" role="switch" aria-checked={on} onclick={…}>
  <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
  {label}
</button>
```

- No `<span class="state">` and no On/Off text in: `TimerCard`, `CountInSettings`,
  `RatioSettings`, `CagedTool` (connections), `CagedLayerList` (each layer).
- Accessible name = label only; state via `aria-checked`. Visual state: thumb position and bold
  label (`controls.css`), unchanged.
- Test hook: no element matching `.switch .state` exists anywhere; `textContent` of each switch
  equals its label.

## C. Click sound select (`src/lib/tools/metronome/ClickSoundSelect.svelte`)

- Rendered once by `MetronomePanel.svelte` inside `#metronome-mode-panel`, after the
  settings/run block: visible in all three modes and every phase.
- `<label for="metronome-sound">{m.metronome_sound_label()}</label>` + native
  `<select id="metronome-sound">` with five `<option>`s in `CLICK_SOUNDS` order, values the
  sound IDs, text the localized names; `value = metronome.sound`.
- `change` → `metronome.setSound(e.currentTarget.value)`.
- Styling identical to `SubdivisionSelect` (field, chevron, forced-colors fallback); tokens only.
- Keyboard: native select behaviour; metronome shortcuts are inert while it has focus (existing
  `isEditable` rule for `SELECT`).
- Zero axe violations; target ≥ `--target-min`.
