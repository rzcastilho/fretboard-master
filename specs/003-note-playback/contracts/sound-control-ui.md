# Contract: Sound control, Stop button, unavailable notice, pulse rendering

**Feature**: `003-note-playback` | API: [playback-api.md](./playback-api.md) | Research: R-12, R-13, R-14

## 1. Placement

| Screen | App bar element | Contains |
|---|---|---|
| `/notes`, `/triads` | `ToolLayout` `<header aria-label="Application bar">` | `AppNav` + `SoundControl` (+ `StopButton` while a sequence plays) |
| `/about` | about page `<header aria-label="Application bar">` | same |
| `/` and the not-found home | `HomeScreen` `header.top` | `h1` + About link + `SoundControl` (+ `StopButton`) |

The control never overlays the fretboard (Principle VII). At 320 px the header wraps; only the
fretboard scrolls horizontally.

## 2. `SoundControl.svelte` (`src/lib/shell/`)

DOM and ARIA (all text from the catalog, §5):

```html
<div class="sound" role="group" aria-label="{sound_group_label}">
  <button type="button" class="mute" aria-pressed="false|true"
          aria-disabled="true (only when unavailable)" aria-describedby="…status">
    <svg aria-hidden="true">…icon: on | muted | unavailable…</svg>
    <span class="sr-only">{sound_mute}</span>            <!-- unavailable: {sound_unavailable_label} -->
  </button>
  <button type="button" class="settings" aria-expanded="false|true" aria-controls="sound-panel">
    <svg aria-hidden="true">…sliders icon…</svg><span class="sr-only">{sound_settings}</span>
  </button>
  <div id="sound-panel" hidden?>                         <!-- non-modal, no focus trap -->
    <label for="sound-volume">{sound_volume}</label>
    <input id="sound-volume" type="range" min="0" max="100" step="5"
           value="80" aria-valuetext="{sound_volume_value}" disabled? />
    <p class="help-title">{sound_help_title}</p>
    <ul><li>{sound_help_silent_mode}</li><li>{sound_help_app_volume}</li></ul>
  </div>
  <span id="…status" class="sr-only">{sound_state_on | sound_state_muted | sound_state_unavailable}</span>
  <div class="notice-slot" role="status" aria-live="polite">   <!-- always present -->
    {#if noticeVisible}<Notice message={sound_unavailable_notice} ondismiss=… />{/if}
  </div>
</div>
```

Behavior:

| # | Rule | Spec |
|---|---|---|
| S1 | Mute click/Enter/Space → `playback.setMuted(!muted)` (this also unlocks audio). `aria-pressed` reflects `muted` | FR-009, FR-002 |
| S2 | The range `input` event → `playback.setVolume(value)` (unlocks). Arrow keys move ±5; Home/End go to 0/100 (native) | FR-009, FR-010 |
| S3 | The settings button toggles the panel. Escape inside the panel or on the button closes it and focuses the settings button. `pointerdown` outside the control closes it. Tab moves freely out of the panel | FR-010 |
| S4 | Unavailable: the mute button has `aria-disabled="true"` (still focusable, activation ignored), the icon is the unavailable shape, the label reads unavailable, and the range is `disabled`. The help stays readable | FR-015, FR-010 |
| S5 | The three states use three distinct icon geometries (speaker + arcs / speaker + ✕ / speaker + diagonal slash) plus the status text. There is no color-only difference, which the grayscale screenshot verifies | FR-010, Principle V |
| S6 | Every interactive target is ≥ 44 × 44 CSS px (`--target-min`) and has a visible focus ring (existing focus token) | FR-010 |
| S7 | The first help item is the silent-mode / system-volume check | FR-019, EC-7.2, US3-5 |
| S8 | The notice is rendered once per session (`noticeVisible`). It is non-modal, ≤ 2 lines at 320 px, uses notice tokens (no error red), and its Dismiss returns focus to the mute button | FR-015, US5-3 |

## 3. `StopButton.svelte` (`src/lib/shell/`)

- Rendered beside `SoundControl` **only while** `playback.sequencePlaying`. Text label
  `{playback_stop}` with a square stop icon, ≥ 44 × 44 px.
- Activation → `playback.stop('stop')`. The button disappears. If it had focus, focus moves to the
  mute button (no focus loss to `body`).
- Verified by a component test that drives `playback.sequence(...)` with a fake engine (US4-2).

## 4. Pulse rendering in `Fretboard.svelte` (edit)

- New optional prop `pulses?: readonly Pulse[]` (default `[]`). The marker layer draws
  `applyPulses(model.markers, pulses)`. Names and description use `model` only.
- The marker element is keyed by `pulse?.id ?? positionKey`, so a new pulse restarts the
  animation.
- `class:pulse={!!d.pulse}` and `style:--pulse-duration="{d.pulse.durationMs}ms"` are applied
  only client-side. The directive uses CSSOM, which CSP `style-src 'self'` allows, and no pulse
  exists in prerendered HTML.
- CSS:

```css
.marker.pulse .shape { animation: marker-pulse var(--pulse-duration) var(--ease-standard) 1 both; }
@keyframes marker-pulse { 0%,100% { transform: scale(1); } 15% { transform: scale(var(--pulse-scale)); opacity: var(--pulse-opacity-peak); } }
@media (prefers-reduced-motion: reduce) { .marker.pulse .shape { animation: none; } }
```

- A transient neutral marker uses the existing neutral shape. Emphasis is `highlighted` (existing
  styles), so reduced motion shows a plain state switch for the same interval (FR-008).
- The cell's accessible name and the text description ignore pulses (data-model §6).

## 5. Message catalog keys (`messages/en.json`, new)

| Key | English |
|---|---|
| `sound_group_label` | Sound |
| `sound_mute` | Mute sound |
| `sound_unavailable_label` | Sound unavailable |
| `sound_state_on` | Sound on |
| `sound_state_muted` | Sound muted |
| `sound_state_unavailable` | Sound is not available |
| `sound_settings` | Sound settings |
| `sound_volume` | Volume |
| `sound_volume_value` | {value} % |
| `sound_help_title` | No sound? |
| `sound_help_silent_mode` | Check that silent mode is off and the system volume is up. |
| `sound_help_app_volume` | Check that sound is not muted here and the volume is above 0 %. |
| `sound_unavailable_notice` | Sound is not available on this device right now |
| `playback_stop` | Stop |

`Notice.svelte` keeps `notice_dismiss`. The not-found usage passes `m.notice_not_found()`
(refactor only, no copy change).

## 6. Design tokens (`src/lib/styles/tokens.css`, new)

| Token | Purpose |
|---|---|
| `--pulse-scale` | Peak marker scale during a pulse (e.g. 1.25) |
| `--pulse-opacity-peak` | Peak opacity of the pulse keyframe |
| `--sound-panel-width` | Min inline size of the volume/help panel |
| `--icon-size` | App-bar icon box (reused by mute/settings/stop) |

The `prefers-contrast: more` block adds a stronger panel border, using the existing border token
pattern.
