# Research: Digital Time Display and More Metronome Sounds (042)

All Technical Context unknowns are resolved below. Each entry: Decision, Rationale, Alternatives.

## R-0 Branch baseline

- **Decision**: merge `origin/main` (PR #65, feature 041 timer link, `b18d24c`) into this branch
  before planning. Done in this session (merge commit `f96c5ce`). `TimerCard.svelte` now has the
  `Start and stop with metronome` switch with its `<span class="state">`.
- **Rationale**: the spec's clarify session requires it; the plan must target files that exist.
- **Alternatives**: rebase (rewrites the speckit checkpoint commits; rejected).

## R-1 Digit typeface and source

- **Decision**: DSEG7 Classic **Bold** (keshikan, SIL OFL 1.1), subset to `0123456789:` and
  committed as `static/fonts/fm-timer-digits.woff2`, with the OFL text as
  `static/fonts/OFL-DSEG.txt`. Source comes from the dev-only npm package `dseg` (which ships
  `fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2`), subset by a new script
  `scripts/subset-timer-digits-font.mjs` using the existing dev dependency `subset-font`,
  exposed as `pnpm fonts:timer-digits`. Bold matches the readout's current
  `--font-weight-bold`.
- **Rationale**: same licence family and same build path as ADR 0006 (accidentals); nothing new
  ships at runtime; the file is small (expected < 3 KB for 11 glyphs).
- **Fallback if `dseg` cannot be installed** (offline sandbox): vendor the upstream
  `DSEG7Classic-Bold.ttf` under `scripts/font-sources/` (dev-only, not under `static/`) and point
  the script at it. Either way the committed artefact is the same subset.
- **Alternatives**: DS-Digital (dafont; licence forbids free redistribution — rejected);
  drawing segments in inline SVG (more code, harder to keep accessible text identical — rejected);
  CSS-only look-alike with the system font (not a digital face — rejected).

## R-2 Where `@font-face` lives and who downloads it

- **Decision**: declare `'FM Timer Digits'` in `src/lib/styles/global.css` next to
  `'FM Accidentals'`, with `font-display: swap` and `unicode-range: U+0030-003A`. Add a token
  `--font-family-timer: 'FM Timer Digits', var(--font-family-ui);` in `tokens.css`, used only by
  `.readout` in `TimerCard.svelte`. Browsers fetch a declared face only when a rendered element
  uses it, so only the Metronome page (the only page with `TimerCard`) requests the file during render.
  The service worker (040) still fetches it in the background when it installs, from whichever
  page is opened first, as it does every `static/` file; FR-003 exempts that precache fetch.
- **Rationale**: one place for faces (ADR 0006 precedent); tokens rule (Principle VII).
- **Alternatives**: `@font-face` inside the component `<style>` (Svelte leaves `@font-face`
  global anyway, and splits font declarations across files — rejected).

## R-3 First paint, CLS and offline

- **Decision**: `TimerCard.svelte` adds `<svelte:head><link rel="preload" as="font"
  type="font/woff2" href="/fonts/fm-timer-digits.woff2" crossorigin></svelte:head>`, so the
  prerendered `/metronome` HTML starts the request early. The readout layout is kept as in 039
  (ghost absolutely positioned over the in-flow `.time`): DSEG digits are fixed width and the
  fallback keeps `tabular-nums`, so the box width depends only on the face, never on the digits
  (FR-002); an e2e check asserts the box width is equal at `10:00`, `01:11` and `00:00`. `static/`
  files are already in the service-worker precache list (`files` from `$service-worker`), so
  the font is offline after one visit (SC-002); `static/_headers` already serves `/fonts/*`
  immutable.
- **Rationale**: CLS ≤ 0.1 (Principle VI) on a cold load; with swap the only change is the face
  of one inline-block whose neighbours sit at fixed flex positions. Preload limits the swap
  window. No other route preloads the file.
- **Alternatives**: `font-display: block` (risks an invisible readout for up to 3 s, conflicts
  with "never blank" — rejected); `optional` (cold load might never show the face — rejected).

## R-4 Ghost and digits alignment

- **Decision**: both the ghost and `.time` use `--font-family-timer`; DSEG digits are fixed
  width and `8` lights every segment, so `88:88` behind `MM:SS` aligns exactly. Keep
  `font-variant-numeric: tabular-nums` for the fallback face. No animation is added; the 039
  finished flash and its reduced-motion underline are unchanged.
- **Rationale**: spec clarification "ghost segments and digit widths".

## R-5 Contrast and themes

- **Decision**: keep the existing colour tokens (`--color-text`, finished
  `--color-accent-secondary`, ghost `--timer-ghost-opacity`). DSEG Bold has thinner strokes than
  the system bold, so the readout size token stays at `3.5rem` (glyphs ≥ 24 px count as large
  text; AA needs 3:1, the tokens already pass 4.5:1). The ghost is decorative (`aria-hidden`,
  exempt). Print theme uses the same tokens; the timer card is `data-print="omit"` already, so
  print is unaffected.
- **Rationale**: FR-004 with no new colours.

## R-6 Removing switch state text

- **Decision**: delete the `<span class="state" aria-hidden="true">` from all five switches
  (`TimerCard`, `CountInSettings`, `RatioSettings`, `CagedTool` connections, `CagedLayerList`),
  any now-orphaned `.state` CSS rules, and the messages `metronome_switch_on/off`,
  `caged_switch_on/off` from `messages/{en,es,pt-BR}.json`. State remains perceivable via the
  thumb position and the bold label (`.switch[aria-checked='true']` in `controls.css`) and is
  exposed by `aria-checked`. Tests that read the state text (unit and e2e) switch to
  `aria-checked`.
- **Rationale**: spec clarification; one consistent switch family (ADR 0028). The span was
  already `aria-hidden`, so screen-reader output does not change.
- **Alternatives**: remove only from the timer switch (inconsistent family — rejected).

## R-7 Click sound synthesis

- **Decision**: extend pure `src/lib/audio/click.ts` with `CLICK_SOUNDS = ['click', 'wood',
  'beep', 'rim', 'cowbell']` and `renderClick(kind, sampleRate, sound = 'click')`. Lengths stay
  per kind (`CLICK_LENGTH_S`: 0.03 / 0.03 / 0.018 s) for every sound, so `CLICK_S` and halt
  timing are unchanged. Every render is peak-normalised to the kind's existing peak
  (accent 0.9, normal 0.55, sub 0.25), which guarantees FR-007's ordering by construction.
  Noise uses `mulberry32` from `prng.ts` with a fixed seed per (sound, kind).

  | Sound | Accent | Normal | Sub | Envelope |
  |---|---|---|---|---|
  | `click` | 1600 Hz sine | 1000 Hz sine | 2400 Hz sine | unchanged (byte-for-byte) |
  | `wood` | 1200 Hz + 2.76× partial (0.5) | 800 Hz + 2.76× (0.5) | 1600 Hz + 2.76× (0.4) | 0.5 ms attack, exp. decay reaching 0.5 % at 60 % of length, then silence |
  | `beep` | 1760 Hz sine + 3rd harmonic (0.2) | 880 Hz + 3rd (0.2) | 1320 Hz + 3rd (0.2) | 2 ms attack, flat, 4 ms linear release |
  | `rim` | seeded white noise, first-difference high-passed (0.7) + 2000 Hz sine (0.3) | same at 1700 Hz | same at 2600 Hz | 0.3 ms attack, exp. decay reaching 0.5 % at 40 % of length |
  | `cowbell` | two squares softened by 3-harmonic sums at 587 + 870 Hz | 540 + 800 Hz | 800 + 1185 Hz | 1 ms attack, exp. decay to 0.5 % at end |

- **Rationale**: conventional metronome palette; distinct pitch per kind keeps accent / normal /
  sub apart even at the same loudness; pure and deterministic for Vitest (Principle IV).
  Final timbre tuning is a listening step (SC-005, "Manual checks").
- **Alternatives**: audio samples (constitution: synthesized on device, no files — rejected);
  per-mode sounds (spec: one global choice — rejected).

## R-8 Applying a sound change mid-run

- **Decision**: the scheduler gains `setSound(sound: unknown): void` and `SegmentStart.sound?`.
  `schedule()` picks `buffersFor(sink, sound)[kind]` at schedule time, so only clicks not yet
  scheduled change; already-scheduled sources (≤ `HORIZON_S`) play out. No grid, anchor, `next`
  or `pending` change, so beat times are untouched (FR-010). Buffers are cached per sink per
  sound (`WeakMap<ClickSink, Map<ClickSound, Buffers>>`), rendered lazily on first use. The
  `click` log entry gains `sound`, so e2e can assert which sound each click used.
- **Rationale**: mirrors 038 `retime` without cancelling sources; the simplest change that
  satisfies "no restart, no dropped or doubled beat".
- **Alternatives**: cancel and reschedule pending clicks with the new sound (needs the retime
  cancel path, risks a doubled click at the boundary, gains < 1.5 s — rejected); a `sound`
  getter in `SchedulerDeps` (hidden coupling to the store; harder to log — rejected).

## R-9 Preview

- **Decision**: new `playClickPreview(sink, sound): boolean` in
  `src/lib/audio/click-preview.ts`, modelled on `playChime`: renders the accent buffer, plays it
  now through `sink.destination` (the volume → mute chain), never throws, logs
  `{ type: 'click-preview', sound, when, contextTime }`. `metronome.setSound` calls it only when
  `phase === 'settings'`, obtaining the sink with `playback.clickSink()` inside the select's
  `change` gesture. Mute silences it because the mute gain sits after volume.
- **Rationale**: FR-006 / US3 scenario 3; same shape as the 039 chime.

## R-10 Placement of the control

- **Decision**: a new `ClickSoundSelect.svelte` (same field markup and CSS as
  `SubdivisionSelect`) rendered once in `MetronomePanel.svelte` inside the mode tabpanel,
  **after** the `{#if phase === 'settings'} … {:else} … {/if}` block, so it is visible in every
  mode and in every phase (settings, starting, running, paused). Id `metronome-sound`, label
  `m.metronome_sound_label()`.
- **Rationale**: settings fields are hidden while running, but FR-010 / US3-6 need the change
  while running. `matchMetronomeKey` already treats `SELECT` as editable, so Space / arrows in
  the open select do not trigger metronome shortcuts.
- **Alternatives**: generalise `SubdivisionSelect` into a generic select (only two real uses of
  the same shape with different option types; would be a speculative abstraction across value
  types — revisit at a third use, Principle X); putting it in the shared bar (not a metronome
  setting there — rejected).

## R-11 Storage

- **Decision**: `metronome.sound` in the preferences record, parsed with
  `v.fallback(v.picklist(CLICK_SOUNDS), 'click')` after an `isPlainObject` guard, serialized
  last in the `metronome` entry, only when not `click`. Prefs imports `CLICK_SOUNDS` from
  `$lib/audio/click` (pure module; not restricted by the prefs lint rule, only
  `$lib/audio/engine` is). `PREFS_VERSION` stays 1; the field is covered by the existing
  `metronome` privacy category (whole `metronome` key). Erase → `restore('click')`. Not part of
  share links.
- **Alternatives**: a mirror constant with a parity test as for the settings defaults (adds a
  test for no benefit when the source module is already importable — rejected).

## R-12 Bundle size

- **Decision**: expected growth < 2 KB gzip (four small synth functions, one component,
  messages). Initial JS is ~160–165 KB against the 180 KB budget; no amendment to Principle VI.
  `pnpm verify` runs `check-bundle-size.mjs`.

## R-13 Governance artefacts

- **Decision**: ADR `docs/adr/0032-timer-readout-digit-font.md` (the next free number after
  0031; spec names 0032) and constitution **2.2.0 → 2.3.0** (MINOR) amending the "Fonts" row:
  "Self-hosted accidentals subset … (ADR 0006), and a self-hosted digit subset (DSEG7 Classic,
  OFL 1.1) used only by the practice-timer readout (ADR 0032); all other letters and digits use
  the system UI stack …", with a Sync Impact Report. Both in the same PR (FR-003).
