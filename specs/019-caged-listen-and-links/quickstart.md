# Quickstart: CAGED Listen and Links to Other Tools

**Feature**: 019-caged-listen-and-links | Validation guide for implementers and reviewers.

## 1. Setup

```bash
mise install && pnpm install
git switch 019-caged-listen-and-links
```

## 2. Targeted checks while implementing (constitution "Verification tiers")

```bash
# units touched by this slice
pnpm vitest run tests/unit/audio/schedule.test.ts tests/unit/audio/engine.test.ts \
  tests/unit/state/caged-listen.test.ts tests/unit/state/caged-store.test.ts \
  tests/unit/state/links.test.ts tests/unit/state/links-store.test.ts \
  tests/unit/prefs/schema.test.ts tests/unit/caged/caged-tool.test.ts tests/unit/no-raw-text.test.ts

# e2e (desktop only, installed Chrome); rebuild only after src/ changes
pnpm build:test
pnpm test:e2e:fast e2e/caged-listen.spec.ts e2e/linked-tools.spec.ts

# end of slice, once
pnpm verify
```

Do not run `pnpm test:e2e` (full matrix) or `pnpm lhci` locally.

## 3. Manual walkthrough (`pnpm dev`, standard tuning, 22 frets)

1. **Chord strum** — CAGED, C major, focus **E** (tag). Only Chord on. Listen → six notes low→high
   about 250 ms apart, ringing, then the block ½ s later; each position pulses as it sounds.
2. **Triad** — turn on Triad (set 3-2-1). Listen → three notes then the block, 120 BPM.
3. **Arpeggio** — turn on Arpeggio. Listen → each arpeggio pitch of the E-shape region once, up then
   down, top note once; a note at string 2 fret 5 and string 1 open (unison) sounds on string 2.
4. **Scale** — turn on Scale. Listen → starts on the region's lowest C, up to the top, back to that C.
5. **Widest wins** — Pentatonic + Scale on → Scale plays.
6. **No focus** — See all. Listen → every occurrence's strum + block, nut → body, 1.5 s apart.
7. **Tempo** — pick Slow, Listen (Scale) → 750 ms per note; change to Fast mid-run → stops; Listen
   → ≈333 ms. Reload → Fast is kept. Erase preferences → Medium.
8. **Stop** — during a sequence press Stop (app bar) → silence at once, pulses gone, focus on mute.
9. **Stopping matrix** — during a sequence change each of: key, quality, spelling, tag, Next,
   layer, Triad set, tempo, tuning, tool → stops. Label type, Show connections → keeps playing.
   Tap a single fret, then change focus → that single note keeps ringing.
10. **Mute** — mute, Listen → pulses identical, no sound.
11. **Hidden** — Listen, switch browser tab, return → stopped, no resume.
12. **Unavailable** — choose a non-compatible custom tuning → Listen disabled with the visible
    reason; "View in standard tuning" → Listen plays standard-tuning pitches.
13. **Carry** — Notes: select only B♭ → nav CAGED → key B♭, quality as before. CAGED A minor → nav
    Notes → A, C, E selected. Triads B dim → nav CAGED → B major. CAGED D major → nav Triads → D
    major, inversion/set unchanged. Notes with two notes → nav CAGED → unchanged.
14. **Shortcuts** — Notes position card on a G → **CAGED in this key** → CAGED in G (Back returns to
    Notes in one step). Triads B♭ minor → **View in CAGED** → CAGED B♭ minor, Triad layer on, a shape
    focused. Triads C augmented → View in CAGED is focusable, does nothing, note "CAGED covers major
    and minor chords" visible.
15. **Spelling** — Triads A♯ major (spelling override ♯) → View in CAGED → A♯ major with 𝄪 where
    needed and "Switch to B♭" offered.

## 4. Acceptance scenario → test map

| Scenario | Vitest | Playwright (`e2e/caged-listen.spec.ts` unless noted) |
|---|---|---|
| US1-1 chord strum | `caged-listen` strum table | log `timeline` deltas 250/500 |
| US1-2 triad | `caged-listen` triad steps | log 4 steps, last 3 pitches |
| US1-3 arpeggio | `caged-listen` arpeggio table, P-1, P-3 | log pitches up/down |
| US1-4 scale/pentatonic | `caged-listen` scale table, P-4 | log starts/ends on root |
| US1-5 widest wins | `listenSource` table | Pentatonic+Scale → scale count |
| US1-6 no focus | `caged-listen` all-chords | log shape order nut→body |
| US1-7 pulses / muted | engine pulse tests | `[data-pulse]` while muted |
| US2-1 Stop | engine stop | Stop button, log `stop` |
| US2-2 stop matrix | `caged-store` R-09 matrix | key, layer, tool, label-type (no stop) |
| US2-3 tempo + remembered | `schema` tempo, store | deltas per tempo, reload |
| US2-4 interrupt | engine interrupt | Listen twice → restart |
| US2-5 hidden | PlaybackHost (existing) | `visibilitychange` → stop `hidden` |
| US3-1…7 carry | `links` 12 roots × 2 qualities + dim/aug | `linked-tools.spec.ts` nav carries |
| US4-1 CAGED in this key | `links-store` | `linked-tools.spec.ts` card → CAGED |
| US4-2 View in CAGED | `links-store`, `caged-store showTriadLayer` | `linked-tools.spec.ts` B♭ minor |
| US4-3 disabled | Triads secondary component | `aria-disabled`, describedby, axe |
| SC-007 a11y | — | axe phone + desktop, both themes |
