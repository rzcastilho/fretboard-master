# Contract: CAGED Listen and Links — Observable UI, Accessibility, Persistence

**Feature**: 019-caged-listen-and-links. What a user, assistive technology and the e2e suite can
observe. Test hooks are the existing ones (`window.__fmAudioLog`, `__fmAudioFault`); none added.

## 1. CAGED: Listen block (`src/lib/tools/caged/CagedListen.svelte`, new)

Placed with the focus controls, outside the fretboard (never covers it), visible in every CAGED
state.

| Element | Role / attributes | Text (catalog key) |
|---|---|---|
| Listen button | `button`; `aria-disabled="true"` + `aria-describedby` → reason when no occurrence is drawn; stays focusable | `caged_listen` "Listen" |
| Disabled reason | visible `<span id>` | `caged_listen_reason_no_shapes` / `caged_listen_reason_no_fit` |
| Tempo | `ChoiceGroup` → `radiogroup` labelled `caged_tempo_label` "Tempo"; arrow keys move | `caged_tempo_slow` / `_medium` / `_fast` |
| Status | `role="status"` (polite), visible text while a CAGED Listen sequence plays, empty otherwise | `caged_listen_playing_layer` "Playing: {layer}, {shape} shape" / `caged_listen_playing_all` "Playing every shape" |

- Stop: the existing app-bar `StopButton` (`playback_stop`) appears while the sequence plays and
  disappears at its end; activating it ends sound and pulses within 100 ms and moves focus to the
  mute control.
- Pulses: each sounding position is drawn `highlighted` + pulse animation (size/opacity, not colour
  alone), also when muted; reduced motion keeps the highlight without animation (existing).
- All targets ≥ 44×44 px; layout wraps at 320 px and 200 % zoom.

## 2. Notes: position card

New button **CAGED in this key** (`notes_card_caged`) after "Triads from this note". Activation:
one navigation to `/caged` (one history entry); CAGED key = card's pitch class (spelling default
for the key), quality unchanged; Notes selection and focus unchanged.

## 3. Triads: View in CAGED

New button **View in CAGED** (`triads_view_in_caged`) after Listen in the secondary row.

- Major/minor: activation opens `/caged` (one history entry) with root, spelling and quality, the
  Triad layer on with CAGED's default set, and a shape in focus.
- Diminished/augmented: `aria-disabled="true"`, focusable, activation does nothing, a visible note
  `triads_view_in_caged_unavailable` "CAGED covers major and minor chords" is referenced by
  `aria-describedby`; styled with the `--color-disabled-*` tokens, the new `--disabled-opacity` token and the visible note (not colour alone).

## 4. Navigation carry (persistent nav)

| From → To | Observable result |
|---|---|
| Notes (1 note) → CAGED | key = that note, quality = CAGED's last (major if never used) |
| Notes (0 or 2+ notes) → CAGED | CAGED as last left |
| CAGED → Notes | selection = chord's three notes |
| Triads (maj/min) → CAGED | root, spelling, quality |
| Triads (dim/aug) → CAGED | root only, major |
| CAGED → Triads | root, spelling, quality; inversion, set, view, Compare unchanged |

Carry happens only on a plain primary click of a nav link to another tool; reload, Back/Forward and
deep links never carry.

## 5. Audio log (e2e observable)

A CAGED Listen produces `__fmAudioLog` `step` entries:

- Chord only: `kind: 'timeline'`; `scheduledAtMs` deltas 250 ms between strum notes, 500 ms to the
  block; block entry has all chord pitches.
- Arpeggio/Pentatonic/Scale: `kind: 'sequence'`; deltas 750 / 500 / ≈333 ms for slow/medium/fast.
- Triad: `kind: 'sequence'`, 500 ms deltas, last step 3 pitches.
- Every stop in the R-09 matrix logs `{type:'stop', reason}`; label type and connections log none.

## 6. Persistence

- `localStorage` record gains `"tempo"` only when slow or fast; Medium writes nothing new (existing
  records stay byte-identical). Reload restores the tempo; "Erase preferences" returns it to Medium.
- No carried context, Listen state or layer is stored or put in a URL.

## 7. Accessibility checks

`@axe-core/playwright` reports zero violations on CAGED (Listen idle, playing, disabled), Notes
position card, Triads with View in CAGED enabled and disabled — phone and desktop, light and dark.
Keyboard: Tab reaches Listen, Tempo, Stop, CAGED in this key and View in CAGED (also when
disabled); Enter/Space activate.
