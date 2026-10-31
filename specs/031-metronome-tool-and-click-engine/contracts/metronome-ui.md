# Contract: Metronome UI (route, DOM, ARIA, tokens, messages)

## 1. Route and shell

| Item | Contract |
|------|----------|
| Route | `src/routes/metronome/+page.svelte` renders `<MetronomeLayout />` and is prerendered like the other tools |
| Home | `HomeScreen` lists the 4th `ToolCard` (`TOOLS[3]`), href `/metronome`, name `tool_metronome_name`, question `tool_metronome_question`. It shows the "continue" mark when `preferences.lastTool === 'metronome'` |
| Nav | `AppNav` shows Metronome 4th (after CAGED), with icon `metronome`. Link carry (`linkTools`) is skipped for it, because it is not a `LinkedTool` |
| App bar | `<header class="app-bar">` with `AppNav`, `SoundControl` and `LanguagePanel` only. No `TuningBadge`, `StopButton`, `ShareButton`, `InstrumentButton` or `NotationToggle` (FR-023, FR-024) |
| Title | `<title>` = `title_screen({ screen: tool_metronome_name })` |
| Heading | `<h1 tabindex="-1">` = tool name (focus target after navigation, as on other screens). Panel heading `<h2>` = `metronome_panel_heading` ("Ratios Training"). No mode tabs |
| Failure fallback | `MetronomePanel` sits inside `<svelte:boundary onerror={(e) => recordFailure(null, e)}>` in `MetronomeLayout`. Its `failed` snippet renders the shared `FailureView`, whose reset calls `metronome.screenChanged()` then `boundaryReset()`. The app bar and nav stay operable (C X). Failures attribute to `'shell'` (R-12). Test hook: `__fmFault.metronome` via `maybeFault('metronome')` |
| Not present | Instrument panel, legend, "describe this view", print view (`data-print="omit"` on the panel), share link, address sync |

## 2. Settings view (`phase === 'settings'`)

```text
section[aria-labelledby=panel-heading]
  h2#panel-heading                     "Ratios Training"
  ValueRow  label "BPM"         range 30–300  value 85
  ValueRow  label "# of Beats"  range 1–16    value 4
  button.start (full width, accent)    ▶ "Start Training"
```

**ValueRow** (`src/lib/tools/metronome/ValueRow.svelte`), used twice:
- `<label for=range-id>` on the left.
- `<input type="range" id min max step="1" value aria-valuetext>`: native keyboard (arrows ±1,
  PageUp/PageDown ±10 through a keydown handler that calls the store, Home/End).
- Pill: `button[aria-label={m.metronome_bpm_decrease()}]` (−), `<output aria-live="off" for=range-id>`
  (read-only readout, `tabular-nums`), `button[aria-label={m.metronome_bpm_increase()}]` (+); the beats
  row uses `metronome_beats_decrease` / `_increase`. Every `aria-label` and `title` is a catalog
  binding, never literal text (C VIII). At a limit the
  matching button is `disabled` and uses the disabled tokens (grey, never red).
- Grid: `grid-template-columns: max-content minmax(0, 1fr) minmax(var(--pill-min-inline), max-content)`,
  so the slider shrinks first. The pill is ≥ 96 px at every width from 320 to 2560 CSS px
  (FR-003).

## 3. Running view (`phase ∈ starting | running | paused`)

```text
section
  h2 "Ratios Training"
  div.status (bordered box, --color-border, --radius-md)
    p.position  (small caps)   "BEAT 2/4"            ← real DOM text (FR-011)
    p.tempo     <span class=digits>85</span><span class=unit>BPM</span>   (--color-accent, tabular-nums, large)
    ol.dots[aria-hidden=true]  li.dot[data-state=lit|played|upcoming] × beats
  div.run-controls
    button.main (full width)   "Pause" ‖  |  "Resume" ▶ (accent) when paused
    button.reset[aria-label={m.metronome_reset()}][title={m.metronome_reset()}]  ↺ icon, --color-danger
  div[role=status][aria-live=polite].sr-only   {metronome.announcement}
  Notice (when soundNotice)    metronome_sound_unavailable, dismissible, one line
```

- Dot states map to C VII emphasis levels: `lit` = highlighted (accent), `played` = dimmed,
  `upcoming` = normal (grey). Under `prefers-reduced-motion: reduce`, state changes are instant
  with no transition. Otherwise the transition is `--duration-fast` (opacity only).
- `button.main` keeps its accessible name in sync with its visible label (Pause / Resume /
  Start Training). Focus stays on it across Pause ⇄ Resume. After Reset, focus moves to Start
  Training. After Start, focus moves to Pause.
- The Reset button is a square of at least `--target-min`. Its tooltip is the native `title`,
  plus a CSS `:focus-visible` tooltip that matches the bar's compact-label pattern.
- `--color-danger` appears only in `RunControls.svelte` (enforced by a unit test).

## 4. Keyboard (page-level, while `/metronome` is shown)

See [metronome-store-api.md §2](./metronome-store-api.md). The About page
(`ShortcutList.svelte`) adds a second `<dl>` group titled `shortcuts_metronome_heading` with
`Space` → `shortcuts_metronome_toggle` and `Esc` → `shortcuts_metronome_reset`. The group sits
outside the character-key switch and is labelled as always on.

## 5. Messages (`messages/en.json`, `pt-BR.json`, `es.json`)

| Key | en |
|-----|----|
| `tool_metronome_name` | Metronome |
| `tool_metronome_question` | Can I keep a steady pulse? |
| `metronome_panel_heading` | Ratios Training |
| `metronome_bpm_label` | BPM |
| `metronome_beats_label` | # of Beats |
| `metronome_bpm_decrease` / `_increase` | Decrease BPM / Increase BPM |
| `metronome_beats_decrease` / `_increase` | Fewer beats / More beats |
| `metronome_start` | Start Training |
| `metronome_pause` | Pause |
| `metronome_resume` | Resume |
| `metronome_reset` | Reset |
| `metronome_status_beat` | BEAT {beat}/{beats} |
| `metronome_status_beat_none` | BEAT –/{beats} |
| `metronome_bpm_unit` | BPM |
| `metronome_announce_started` | Started, {bpm} BPM, {beats} beats |
| `metronome_announce_paused` | Paused on beat {beat} of {beats} |
| `metronome_announce_resumed` | Resumed |
| `metronome_announce_reset` | Reset |
| `metronome_sound_unavailable` | Sound is unavailable; the beat is shown visually. |
| `shortcuts_metronome_heading` | Metronome |
| `shortcuts_metronome_toggle` | Start, pause or resume |
| `shortcuts_metronome_reset` | Reset |
| `shortcuts_key_space` / `shortcuts_key_escape` | Space / Esc |

Portuguese and Spanish translations ship in the same commit (FR-012). The `no-raw-text` and i18n
gap unit tests cover the new keys.

## 6. Tokens (`src/lib/styles/tokens.css`)

| Token | Purpose |
|-------|---------|
| `--color-danger`, `--color-danger-text` | Reset only. Light, dark, `prefers-contrast: more` and forced colours ([research R-14](../research.md)) |
| `--pill-min-inline: 96px` | Pill minimum width |
| `--metronome-dot-size`, `--metronome-tempo-size` | Dot diameter and the large BPM digits (type-scale token) |

## 7. Test hooks (test builds only)

- `__fmAudioLog` entries `click` / `click-cancel` ([data-model §8](../data-model.md)).
- `__fmAudioFault = 'context'` (existing) makes the visual-only path observable.
- `data-state` on each dot (also the styling hook) and `data-phase` on the panel `section`,
  used as stable e2e selectors.
