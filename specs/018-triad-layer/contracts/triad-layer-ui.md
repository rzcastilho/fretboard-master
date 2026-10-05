# Contract: CAGED Triad layer — observable UI

What a user, a screen reader and the Playwright suite (`e2e/caged-triad.spec.ts`) observe.
Strings are `messages/en.json` keys (R-14); English values shown.

## 1. Layer row (zone D, `CagedLayerList.svelte`)

| Element | Contract |
|---|---|
| Row order | Chord, Arpeggio, Pentatonic, Scale, **Triad** (FR-001) |
| Triad row | `button[role="switch"]` named "Triad" (`caged_layer_triad`), `aria-checked`, a `MarkerSample` with `layer="triad"` (the same larger, heavier-outlined glyph as the board) |
| Disabled | `aria-disabled="true"` + described reason: `caged_layer_last` (only drawable layer) or `caged_layer_no_shapes` (non-compatible tuning); stays in tab order |
| Target | ≥ 44×44 CSS px (`--target-min`), visible focus ring |
| Announcement | "Triad layer on" / "Triad layer off" through the existing polite description (`caged_layer_now_on/off`) |

## 2. String-set selector (`CagedTriadSets.svelte`)

Shown below the Triad row only while Triad is on **and** a shape is in focus.

| Element | Contract |
|---|---|
| Group | `role="radiogroup"` named "Triad strings" (`caged_triad_sets`); options identical in label and order to the Triads tool's String set control: 6-5-4, 5-4-3, 4-3-2, 3-2-1 (7-6-5 first on 7 strings) |
| Selected | `aria-checked="true"` on the drawn set |
| Unavailable option | `aria-disabled="true"`, `aria-label` "Strings 5-4-3, unavailable" (`caged_triad_set_unavailable`), `aria-describedby` → visible note "In this shape there is no close-position triad on these strings" (`caged_triad_none`); greyed **and** struck/labelled, not color alone |
| Keyboard | Arrow keys / Home / End move focus across **all** options (`reachDisabled`), choosing only available ones; Tab enters on the selected option |
| No set available | every option disabled; note shown; no triad drawn; no Open in Triads |
| Summary line | "C major, root position, strings 3-2-1, frets 5-5-3" (`caged_triad_summary`) |
| Set change announcement | "Strings 3-2-1: C major triad, root position, frets 5-5-3" (`caged_triad_selected`) |
| Moved announcement | "Strings 3-2-1 unavailable in this shape; showing strings 6-5-4" (`caged_triad_moved`) |

## 3. Open in Triads

| Element | Contract |
|---|---|
| Control | `button` "Open in Triads" (`caged_triad_open`) under the selector; ≥ 44×44 px |
| Offered | iff `display.triad.handoff !== null` (layer on, focus, triad drawn, not temporary standard view) |
| Effect | navigates to `/triads` (one history entry) with root/quality/inversion/set/occurrence carried, Isolated view; Back returns to CAGED unchanged (Triad on, same set) |

## 4. Fretboard

| Observable | Contract |
|---|---|
| Triad markers | exactly three `g.marker.layer-triad` with root square / third circle / fifth diamond and the current label |
| Ring | a triad note that is a connection (Connections on) also has the ring |
| One marker per position | no `string:fret` is drawn twice (SC-006) |
| Reveal | on turn-on and on set change the three appear low → high pitch within `--duration-short`; instant under `prefers-reduced-motion` (emulated `reduce`) |
| Description | contains "Triad: C, E, G — root position, strings 3-2-1, frets 5-5-3." (`caged_triad_description`), spoken accidentals ("F sharp") |

## 5. Persistence

| Action | Result |
|---|---|
| CAGED → Triads → CAGED (nav or Back) | Triad on, same set, same focus |
| Reload | Triad off, Chord only |
| Reset tool | Triad off, no set |
| `localStorage` | no new key or field written (assert prefs record byte-identical) |

## 6. Accessibility gate

axe (`@axe-core/playwright`) zero violations on CAGED with Triad on, a disabled set present,
and the Open in Triads button shown — phone, phone-touch and desktop in CI; desktop locally.
