# Fretboard Master — Wave Breakdown

## Summary

Fretboard Master is a browser-only, no-account web app of three interactive study tools for guitarists: **Fretboard Notes** (where every note is), **Triads** (major, minor, diminished, and augmented, in every inversion on every adjacent string set), and **CAGED** (the five major and minor shapes, with triad, arpeggio, pentatonic, and scale layers). Every view is calculated on the device from the user's own instrument (6 or 7 strings, preset or custom tunings, left- or right-handed) and can be heard. The app ships in English, Portuguese, and Spanish, keeps preferences on the device, and shares views by link. It has no lessons, accounts, or gamification. Correct theory is non-negotiable.

A fourth tool, **Metronome**, extends the app for speed practice: one drift-free click engine behind three modes (Ratios Training, which alternates two subdivisions at a fixed tempo; a plain Metronome; and Speed Training, which climbs from a start to a target tempo), plus an independent practice timer. Timing accuracy is its product.

## Source documents

| Document | Waves | Covers |
|---|---|---|
| [fretboard-master/](../fretboard-master/00-overview.md) (13-file macro-spec) | 001–007 | Full product spec, version 1.0, 30 September 2026 |
| [metronome-trainer-spec.md](../metronome-trainer-spec.md) | 008–010 | Metronome tool: three modes, count-in, beat indicator, practice timer, 29 October 2026 |

## Wave sequence

### 001 — MVP
The smallest product that does the core job end to end: a guitarist opens a link on a phone or desktop, finds any note on the neck and hears it, then sees what a triad is made of, with correct spelling and function markers. It runs in standard 6-string tuning, right-handed, in English. CAGED, instrument settings, languages, and sharing come later on purpose (decided at calibration). Notes + Triads is the smallest pair that answers the two most basic gaps named in the spec: "where are the notes" and "what is inside the chord".
1. [001 — Walking skeleton: home screen and navigation](001-mvp/001-walking-skeleton.md) — deployed shell, home cards, navigation, error and not-found fallbacks
2. [002 — The interactive fretboard](001-mvp/002-interactive-fretboard.md) — shared fretboard component: drawing, markers, emphasis, touch, keyboard, scroll
3. [003 — Hear any position](001-mvp/003-note-playback.md) — real-pitch playback, gesture unlock, mute and volume, synced pulse
4. [004 — Fretboard Notes tool](001-mvp/004-fretboard-notes-tool.md) — note selector, octaves, string and region filters, position card, hidden mode
5. [005 — Triads: one shape, correctly spelled](001-mvp/005-triads-isolated-view.md) — root, quality, inversion, set, Isolated view, composition panel, listen

### 002 — Triads across the neck
Finishes the triad story while the Triads tool is fresh: inversions linked along the neck, quality understood as a single altered note, and Notes and Triads carrying context between them. It comes before instrument work because it deepens the core loop for every user, while wave 003 mainly serves players who aren't on standard 6-string.
1. [001 — Full neck and All notes views](002-triads-across-the-neck/001-full-neck-and-all-notes.md) — linked inversions with tags; every occurrence of the three notes
2. [002 — Compare two qualities](002-triads-across-the-neck/002-quality-comparison.md) — overlay, dashed outline, fret arrows, comparison playback
3. [003 — Carry context between Notes and Triads](002-triads-across-the-neck/003-linked-tools.md) — carry-over rules, session state per tool, View as triad, reset

### 003 — Your instrument
Makes every view match the player's real instrument and remembers it: presets, custom tunings, 7 strings, left-handed mode, and on-device preferences. It lands before CAGED because CAGED's tuning rules (compatible, altered string, non-compatible) and 7-string behavior depend on it. Preferences land here because this is the first time there's something worth remembering.
1. [001 — Instrument panel and preset tunings](003-your-instrument/001-instrument-panel-and-tunings.md) — panel, 11 six-string presets, fret count, tuning badge, adjust-and-tell
2. [002 — Remembered preferences, no account](003-your-instrument/002-remembered-preferences.md) — on-device store, validation, "Continue" card, erase
3. [003 — Custom tuning](003-your-instrument/003-custom-tuning.md) — per-string −7/+4 semitones, preset matching, unusual set-ups
4. [004 — Seven-string guitars](003-your-instrument/004-seven-strings.md) — 7th string, 7-string presets, set 7-6-5
5. [005 — Left-handed mode and string orientation](003-your-instrument/005-left-handed-and-orientation.md) — full mirroring, lowest-string-on-top

### 004 — CAGED
The third tool, answering "how does the whole neck connect?": five shapes, focus and connections, melodic layers, the Triad layer, sound, and links to the other tools. It comes after the instrument wave so it works correctly on the player's real tuning from the start.
1. [001 — The five CAGED shapes along the neck](004-caged/001-caged-shapes.md) — major and minor shapes, cyclic order, tags, home card
2. [002 — CAGED across tunings](004-caged/002-caged-in-any-tuning.md) — compatibility classes, altered string, standard-tuning fallback
3. [003 — Shape focus and connections](004-caged/003-shape-focus-and-connections.md) — focus, next and previous, shared anchor notes
4. [004 — Arpeggio, pentatonic, and scale layers](004-caged/004-caged-layers.md) — layer hierarchy, priority, 7-string layers
5. [005 — Triad layer inside a shape](004-caged/005-triad-layer.md) — close triads per set inside the shape, Open in Triads
6. [006 — Hear CAGED and link it to the other tools](004-caged/006-caged-listen-and-links.md) — layer-aware playback, tempo, CAGED carry-over rules

### 005 — Languages and notation
Brings the complete product to Portuguese and Spanish speakers, plus solfège and accidental choices. The spec requires all three languages at public launch (C-5), so this wave is the launch gate for language. It comes after the tools are finished so every string gets translated once.
1. [001 — English, Portuguese, and Spanish](005-languages-and-notation/001-three-languages.md) — full translation, device detection, instant switch, glossary
2. [002 — Letters or solfège, sharps or flats](005-languages-and-notation/002-note-notation-and-accidentals.md) — notation, accidental preference, real accidental symbols

### 006 — Sharing
The teacher's workflow: send exactly the view shown in class, and have it open correctly for the student. It comes late because it serves the secondary persona and carries the state of every tool, so it's easiest to build once all the tools and settings exist.
1. [001 — Share the current view](006-sharing/001-share-a-view.md) — Share command, link contents, address bar sync
2. [002 — Open a shared view](006-sharing/002-open-a-shared-view.md) — direct open, instrument-mismatch notice, validation and fallbacks

### 007 — Comfort and launch readiness
Accessibility audit, small-screen comfort, themes and motion, the About and privacy page, and optional measurement. Baseline keyboard support and 44×44 touch targets already ship in the MVP. This wave adds the polish and the compliance work needed before a public launch.
1. [001 — Screen-reader descriptions, legend, and accessibility audit](007-comfort-and-launch-readiness/001-describe-this-view-and-legend.md) — Describe this view, legend, AA audit
2. [002 — Minimap, fit to screen, and landscape](007-comfort-and-launch-readiness/002-minimap-fit-and-landscape.md) — minimap, two zoom modes, responsive layouts
3. [003 — Themes, motion, and print](007-comfort-and-launch-readiness/003-themes-motion-and-print.md) — light and dark themes, contrast variant, motion system, print
4. [004 — About page, privacy, and keyboard shortcuts](007-comfort-and-launch-readiness/004-about-privacy-and-shortcuts.md) — full About page, privacy posture, shortcuts
5. [005 — Anonymous usage measurement and error reporting](007-comfort-and-launch-readiness/005-anonymous-measurement.md) — conditional on Q-1

### 008 — Ratios training
The Metronome tool arrives as the app's fourth tool, starting with Ratios Training, the only mode the source observed on camera and the focus of its acceptance criteria. The wave builds that mode up one audible layer at a time: a drift-free click with run controls, then subdivisions, the count-in, alternation between two ratios, and remembered settings. It comes first among the metronome waves because the engine it builds is shared by every later mode, and because Ratios Training alone is a complete practice tool (decided at calibration).
1. [001 — Metronome tool and steady click](008-ratios-training/001-metronome-tool-and-click-engine.md) — home card, BPM and beats, running view, dots, Pause/Resume/Reset, timing guarantees, background clicks
2. [002 — Subdivisions](008-ratios-training/002-subdivisions.md) — Loop 1 dropdown, eight subdivisions, soft click, `SUB n`
3. [003 — Count-in](008-ratios-training/003-count-in.md) — toggle, initial and repeat count-in, single pulsing dot
4. [004 — Alternate two ratios](008-ratios-training/004-alternating-ratios.md) — Subdivision ratio section, Loop 2, repeat count-in at every switch
5. [005 — Remembered metronome settings](008-ratios-training/005-remembered-metronome-settings.md) — per-mode settings in the existing preferences store

### 009 — More modes
Adds the two modes the source shows only as tab labels, with behaviour inferred from the source's stated defaults: a plain click for everyday playing along, and Speed Training for gradual tempo building. They follow Ratios Training because they reuse its engine, count-in and run controls almost unchanged. Tap tempo and plain-mode subdivisions close the wave because the source marks them nice-to-have.
1. [001 — Mode tabs and plain Metronome](009-more-modes/001-mode-tabs-and-plain-metronome.md) — tab bar, tab switch stops playback, plain click mode
2. [002 — Speed Training](009-more-modes/002-speed-training.md) — start, target, increment, loops per step, hold or stop at target
3. [003 — Tap tempo and subdivisions in plain Metronome](009-more-modes/003-tap-tempo-and-metronome-subdivisions.md) — optional extras, confirm before building

### 010 — Practice sessions
Surrounds the metronome with what a real practice session needs: a countdown to time-box each exercise, and the whole app working with no signal. It comes last because both are independent of the click itself, and offline use benefits every tool, so it is easiest to build once every tool exists.
1. [001 — Practice timer](010-practice-sessions/001-practice-timer.md) — 1–10 minute presets, seven-segment readout, chime, independent of the metronome
2. [002 — Practise offline](010-practice-sessions/002-offline-practice.md) — whole app usable offline after first load, installable, updates on next launch

## How to use this folder

Work through the waves in order, and through the files in order within each wave. Open a file, copy the block under **Prompt**, and paste it after `/speckit.specify`. Each wave ships on its own, so finish one before starting the next.

## Coverage map

### fretboard-master/ (macro-spec folder)

#### 00-overview.md

| Source section | Covered by |
|---|---|
| § 1 Vision | Not sliced: background, reflected in every prompt's user-value opening |
| § 2 Problem | Not sliced: background. The three gaps set the MVP (001) and CAGED (004) boundaries |
| § 3 Target users | Not sliced: background. See 01-personas-and-jobs.md |
| § 4 Teaching principle | Not sliced: cross-cutting design rule, folded into 001-mvp/002, 001-mvp/005, 002-triads-across-the-neck/002 |
| § 5 Scope | Not sliced: scope container, see 5.1 and 5.2 |
| § 5.1 In scope (version 1) | Distributed across waves 001–007 (see the rows below) |
| § 5.2 Out of scope (version 1) | Not sliced: exclusions. Honored in each file's scope boundary |
| § 6 Success metrics | 007-comfort-and-launch-readiness/005-anonymous-measurement.md (M-5 to M-7). M-1 to M-4 are usability and teacher-review gates, not features |
| § 7 Constraints | Cross-cutting: C-1/C-2/C-3/C-7 in 001-mvp/001, C-4 in 001-mvp/002 and 007-comfort-and-launch-readiness/002, C-5 in 005-languages-and-notation/001, C-6 in 001-mvp/005 and wave 003 |
| § 8 Specification map | Not sliced: navigation aid |

#### 01-personas-and-jobs.md

| Source section | Covered by |
|---|---|
| § 1 Primary personas (P-1 Lia, P-2 Caio, P-3 Bruna) | Not sliced: context. Cited in prompts for wave ordering (P-1 → 001, P-2 → 002/003, P-3 → 003/004) |
| § 2 Secondary persona (P-4 Marcos) | Not sliced: context. Drives 002-triads-across-the-neck/002 and wave 006 |
| § 3 Edge users | 007-comfort-and-launch-readiness/001-describe-this-view-and-legend.md (E-1 to E-3), 007-comfort-and-launch-readiness/003 (E-4), 007-comfort-and-launch-readiness/002 (E-5), 001-mvp/003 (E-6, E-7), 003-your-instrument/002 (E-8) |
| § 4 Jobs-to-be-done | J-1 to J-3 → 001-mvp/004. J-4 → 001-mvp/005. J-5, J-6 → 002-triads-across-the-neck/001–002. J-7 to J-9 → 004-caged/001–005. J-10 → wave 003. J-11 → 001-mvp/003. J-12 → wave 006. J-13 → 003-your-instrument/002. J-14 → 001-mvp/001. J-15 → 005-languages-and-notation/002 |

#### 02-user-journeys.md

| Source section | Covered by |
|---|---|
| § Overall navigation map | 001-mvp/001-walking-skeleton.md, 002-triads-across-the-neck/003-linked-tools.md |
| § UJ-1 First visit and choice of study | 001-mvp/001-walking-skeleton.md (instrument summary in 003-your-instrument/001, language in 005-languages-and-notation/001) |
| § UJ-2 Locate a note on the fretboard | 001-mvp/004-fretboard-notes-tool.md |
| § UJ-3 Explore a triad and its inversions | 001-mvp/005-triads-isolated-view.md, 002-triads-across-the-neck/001-full-neck-and-all-notes.md, 002-triads-across-the-neck/002-quality-comparison.md |
| § UJ-4 Travel the neck with CAGED | 004-caged/001 through 004-caged/005 |
| § UJ-5 Configure the instrument | 003-your-instrument/001 through 003-your-instrument/005 |
| § UJ-6 Adjust language and notation | 005-languages-and-notation/001-three-languages.md, 005-languages-and-notation/002-note-notation-and-accidentals.md |
| § UJ-7 Hear what is on screen | 001-mvp/003-note-playback.md |
| § UJ-8 Share a view | 006-sharing/001-share-a-view.md, 006-sharing/002-open-a-shared-view.md |

#### 03-functional-requirements.md

| Source section | Covered by |
|---|---|
| § Area 1 — Structure and navigation | 001-mvp/001 (FR-1.1–1.3, 1.5, 1.8), 002-triads-across-the-neck/003 and 004-caged/006 (FR-1.6, 1.7, 1.11), 003-your-instrument/002 (FR-1.4), 007-comfort-and-launch-readiness/003 (FR-1.9), 007-comfort-and-launch-readiness/004 (FR-1.10) |
| § Area 2 — Instrument configuration | 003-your-instrument/001 (FR-2.1, 2.2, 2.4, 2.8–2.11), 003-your-instrument/003 (FR-2.5), 003-your-instrument/004 (FR-2.3), 003-your-instrument/005 (FR-2.6, 2.7), 004-caged/002 (FR-2.12) |
| § Area 3 — Interactive fretboard | See subsections |
| § Area 3 › Drawing | 001-mvp/002-interactive-fretboard.md |
| § Area 3 › Markers and labels | 001-mvp/002-interactive-fretboard.md (FR-3.7–3.9), 007-comfort-and-launch-readiness/001 (FR-3.10 legend) |
| § Area 3 › Interaction | 001-mvp/002 (FR-3.11, 3.12, 3.15–3.17), 007-comfort-and-launch-readiness/002 (FR-3.13, 3.14, 3.19 landscape), 004-caged/003 (FR-3.19 rotate hint), 007-comfort-and-launch-readiness/001 (FR-3.18) |
| § Area 4 — Fretboard Notes tool | 001-mvp/004 (FR-4.1–4.9, 4.11, 4.13), 002-triads-across-the-neck/003 (FR-4.10, 4.7 Triads shortcut), 004-caged/006 (FR-4.7 CAGED shortcut), 005-languages-and-notation/002 (FR-4.12) |
| § Area 5 — Triads tool | See subsections |
| § Area 5 › Selection | 001-mvp/005-triads-isolated-view.md, 003-your-instrument/004 (set 7-6-5) |
| § Area 5 › Views | 001-mvp/005 (FR-5.7, 5.8), 002-triads-across-the-neck/001 (FR-5.9, 5.10), 002-triads-across-the-neck/002 (FR-5.11) |
| § Area 5 › Specific musical cases | 001-mvp/005-triads-isolated-view.md |
| § Area 5 › Shortcuts and sound | 001-mvp/005 and 002-triads-across-the-neck/001 (FR-5.17), 004-caged/006 (FR-5.16) |
| § Area 6 — CAGED tool | See subsections |
| § Area 6 › Shapes | 004-caged/001 (FR-6.1–6.4), 004-caged/003 (FR-6.5–6.7) |
| § Area 6 › Layers | 004-caged/004 (FR-6.8–6.10, 6.12), 004-caged/005 (FR-6.11) |
| § Area 6 › Instrument | 004-caged/002 (FR-6.14–6.16), 004-caged/001 and 004-caged/004 (FR-6.13) |
| § Area 6 › Sound | 004-caged/006-caged-listen-and-links.md |
| § Area 7 — Audio | 001-mvp/003 (FR-7.1, 7.2, 7.6–7.11), 001-mvp/005 (FR-7.3), 002-triads-across-the-neck/002 (FR-7.4), 004-caged/006 (FR-7.5) |
| § Area 8 — Language and notation | 005-languages-and-notation/001 (FR-8.1–8.3, 8.8, 8.10), 005-languages-and-notation/002 (FR-8.4–8.7, 8.9) |
| § Area 9 — On-device preferences | 003-your-instrument/002-remembered-preferences.md |
| § Area 10 — Sharing by link | 006-sharing/001 (FR-10.1–10.3, 10.6, 10.8), 006-sharing/002 (FR-10.4, 10.5, 10.7) |

#### 04-data-model.md

| Source section | Covered by |
|---|---|
| § Musical domain | Container, see DM rows |
| § DM-1 Pitch class · DM-2 Spelled note · DM-3 Pitch | 001-mvp/002-interactive-fretboard.md, 001-mvp/005-triads-isolated-view.md |
| § DM-4 Tuning · DM-5 Instrument | 003-your-instrument/001, 003-your-instrument/003, 003-your-instrument/004 |
| § DM-6 Position | 001-mvp/002-interactive-fretboard.md |
| § DM-7 Triad quality · DM-8 Triad · DM-9 String set · DM-10 Triad shape | 001-mvp/005-triads-isolated-view.md |
| § DM-11 CAGED shape | 004-caged/001-caged-shapes.md |
| § DM-12 Layer template · DM-13 CAGED shape occurrence | 004-caged/004-caged-layers.md |
| § State and preferences | Container, see DM rows |
| § DM-14 Preferences | 003-your-instrument/002-remembered-preferences.md |
| § DM-15 View state | 002-triads-across-the-neck/003-linked-tools.md (session state), 006-sharing/001-share-a-view.md (carried in link) |
| § DM-16 Text catalog | 005-languages-and-notation/001-three-languages.md |
| § DM-17 State link | 006-sharing/001-share-a-view.md |
| § DM-18 Usage event (conditional) | 007-comfort-and-launch-readiness/005-anonymous-measurement.md |

#### 05-integrations.md

| Source section | Covered by |
|---|---|
| § INT-1 Application delivery | 001-mvp/001-walking-skeleton.md |
| § INT-2 Anonymous usage measurement (conditional) | 007-comfort-and-launch-readiness/005-anonymous-measurement.md |
| § INT-3 Device audio output | 001-mvp/003-note-playback.md |
| § INT-4 Browser local storage | 003-your-instrument/002-remembered-preferences.md |
| § INT-5 Sharing and clipboard | 006-sharing/001-share-a-view.md |
| § INT-6 Device preferences | 005-languages-and-notation/001 (language), 007-comfort-and-launch-readiness/003 (theme, motion, contrast) |
| § Integrations explicitly absent | 007-comfort-and-launch-readiness/004-about-privacy-and-shortcuts.md (enforced as posture) |

#### 06-non-functional-requirements.md

| Source section | Covered by |
|---|---|
| § NFR-1 Performance | 001-mvp/001 (NFR-1.1), 001-mvp/002 (NFR-1.6), 001-mvp/003 (NFR-1.4, 1.5, 1.7), 003-your-instrument/001 (NFR-1.3). NFR-1.2 applies across all tool files |
| § NFR-2 Compatibility and responsiveness | 001-mvp/001 (NFR-2.1, 2.4, 2.5), 007-comfort-and-launch-readiness/002 (NFR-2.2, 2.3, 2.6), 007-comfort-and-launch-readiness/003 (NFR-2.7) |
| § NFR-3 Accessibility | 001-mvp/002 (NFR-3.5, keyboard base), 007-comfort-and-launch-readiness/001 (NFR-3.1–3.4, 3.8), 007-comfort-and-launch-readiness/003 (NFR-3.6, 3.7), 005-languages-and-notation/002 (NFR-3.9) |
| § NFR-4 Internationalization | 005-languages-and-notation/001 (NFR-4.1–4.4), 005-languages-and-notation/002 (NFR-4.5) |
| § NFR-5 Privacy and compliance | 003-your-instrument/002 (NFR-5.2), 007-comfort-and-launch-readiness/004 (NFR-5.1, 5.4–5.6), 007-comfort-and-launch-readiness/005 (NFR-5.3) |
| § NFR-6 Security | 001-mvp/001 (NFR-6.1), 006-sharing/002 (NFR-6.2), 003-your-instrument/002 (NFR-6.3), 007-comfort-and-launch-readiness/004 (NFR-6.4, 6.5) |
| § NFR-7 Availability and scale | 001-mvp/001-walking-skeleton.md |
| § NFR-8 Observability | 007-comfort-and-launch-readiness/005 (NFR-8.1, 8.2), 001-mvp/001 and 007-comfort-and-launch-readiness/004 (NFR-8.3) |
| § NFR-9 Musical correctness | Cross-cutting: automated checks in 001-mvp/005 and 004-caged/001. NFR-9.4 in 001-mvp/003. NFR-9.5 teacher review is a pre-launch process gate, not sliced |
| § NFR-10 Evolution | Not sliced: architectural guidance for `/speckit.plan`. Versioned formats folded into 003-your-instrument/002 and 006-sharing/001 |

#### 07-architecture-overview.md

| Source section | Covered by |
|---|---|
| § 1 Overview · § 2 Components · § 3 Communication patterns · § 4 Flow of a typical interaction · § 5 Structural decisions and rationale | Not sliced: technical design input for `/speckit.plan`. Referenced from the matching feature files |
| § ARCH-1 Shell and navigation | 001-mvp/001-walking-skeleton.md |
| § ARCH-2 Theory engine | Not sliced separately: built up through 001-mvp/002, 001-mvp/005, 004-caged/001, 004-caged/002 |
| § ARCH-3 Instrument model | 003-your-instrument/001-instrument-panel-and-tunings.md |
| § ARCH-4 View state manager | 002-triads-across-the-neck/003-linked-tools.md |
| § ARCH-5 Interactive fretboard | 001-mvp/002-interactive-fretboard.md, 003-your-instrument/005 |
| § ARCH-6 Tools (Notes, Triads, CAGED) | 001-mvp/004, 001-mvp/005, 004-caged/001 |
| § ARCH-7 Audio engine | 001-mvp/003-note-playback.md |
| § ARCH-8 Preferences | 003-your-instrument/002-remembered-preferences.md |
| § ARCH-9 Texts and notation | 005-languages-and-notation/001-three-languages.md |
| § ARCH-10 Link codec | 006-sharing/001-share-a-view.md, 006-sharing/002-open-a-shared-view.md |
| § ARCH-11 Measurement (conditional) | 007-comfort-and-launch-readiness/005-anonymous-measurement.md |

#### 08-edge-cases-and-error-handling.md

| Source section | Covered by |
|---|---|
| § Principles | Cross-cutting: "never blank" and "adjust and tell" folded into every file's acceptance scenarios |
| § Area 1 — Structure and navigation | 001-mvp/001 (EC-1.1–1.3, 1.5), 007-comfort-and-launch-readiness/002 (EC-1.4) |
| § Area 2 — Instrument | 003-your-instrument/001 (EC-2.3, 2.4, 2.7), 003-your-instrument/003 (EC-2.1, 2.2, 2.6), 004-caged/002 (EC-2.5) |
| § Area 3 — Fretboard | 001-mvp/002 (EC-3.2–3.4, 3.7), 004-caged/004 (EC-3.1), 007-comfort-and-launch-readiness/002 (EC-3.5, 3.6) |
| § Area 4 — Fretboard Notes | 001-mvp/004 (EC-4.1–4.6), 002-triads-across-the-neck/003 (EC-4.7) |
| § Area 5 — Triads | 001-mvp/005 (EC-5.2, 5.6–5.8), 002-triads-across-the-neck/001 (EC-5.3), 002-triads-across-the-neck/002 (EC-5.4, 5.5, 5.9), 003-your-instrument/003 (EC-5.1) |
| § Area 6 — CAGED | 004-caged/001 (EC-6.2, 6.3, 6.6), 004-caged/002 (EC-6.1, 6.9, 6.10), 004-caged/004 (EC-6.4, 6.5), 004-caged/005 (EC-6.7), 004-caged/006 (EC-6.8) |
| § Area 7 — Audio | 001-mvp/003 (EC-7.1–7.3, 7.5–7.7), 004-caged/006 (EC-7.4) |
| § Area 8 — Language and notation | 005-languages-and-notation/001 (EC-8.1–8.3), 005-languages-and-notation/002 (EC-8.4, 8.5) |
| § Area 9 — Preferences | 003-your-instrument/002-remembered-preferences.md |
| § Area 10 — Link | 006-sharing/001 (EC-10.3), 006-sharing/002 (EC-10.1, 10.2, 10.4–10.7) |

#### 09-assumptions-and-open-questions.md

| Source section | Covered by |
|---|---|
| § 1 Decisions confirmed in the interview | Not sliced: confirmed scope, reflected in wave themes |
| § 2 Assumptions | Not sliced: each assumption is folded into its feature file (e.g. A-7 → 003-your-instrument/003, A-11 → 004-caged/004, A-5/A-6 → 005-languages-and-notation/002) |
| § 3 Open questions | Listed below under Open questions, and in the files they gate |
| § 4 Deferred items, with a trigger for return | Not sliced: out of scope for version 1 |

#### 10-glossary.md

| Source section | Covered by |
|---|---|
| § 1 Instrument terms · § 2 Theory terms · § 3 Application terms | Not sliced: reference material |
| § 4 Term equivalence in the three languages | 005-languages-and-notation/001-three-languages.md (used as the translation glossary) |

#### 11-music-theory-reference.md

| Source section | Covered by |
|---|---|
| § TM-1 Notes, pitches, and octaves | 001-mvp/002-interactive-fretboard.md, 001-mvp/003-note-playback.md |
| § TM-2 Tunings | 003-your-instrument/001-instrument-panel-and-tunings.md, 003-your-instrument/004-seven-strings.md |
| § TM-3 Notes on the fretboard | 001-mvp/002-interactive-fretboard.md |
| § TM-4 Triad spelling | 001-mvp/005-triads-isolated-view.md, 002-triads-across-the-neck/003 (TM-4.5 detection) |
| § TM-5 Triad shapes | 001-mvp/005-triads-isolated-view.md, 002-triads-across-the-neck/001 (TM-5.6), 003-your-instrument/004 (7-6-5 table) |
| § TM-6 CAGED: major shapes | 004-caged/001 (TM-6.1, 6.2), 004-caged/003 (TM-6.3), 004-caged/004 (TM-6.4–6.7) |
| § TM-7 CAGED: minor shapes | 004-caged/001 (TM-7.1–7.3), 004-caged/003 (TM-7.2 connections), 004-caged/004 (TM-7.4, 7.5) |
| § TM-8 CAGED and tunings | 004-caged/002-caged-in-any-tuning.md |
| § TM-9 Sample for teacher review | Not sliced: pre-launch review gate (M-4). Sample views reused as acceptance scenarios in 001-mvp/004, 001-mvp/005, 002-triads-across-the-neck/001–002, 003-your-instrument/004–005, 004-caged/002–005 |

#### 12-design-and-experience.md

| Source section | Covered by |
|---|---|
| § 1 Principles | Cross-cutting: DX-4 → 002-triads-across-the-neck/002, DX-7 → 001-mvp/002, DX-8 → 007-comfort-and-launch-readiness/003. Others folded throughout |
| § 2 Voice and texts | 005-languages-and-notation/001-three-languages.md |
| § 3 Visual language | 007-comfort-and-launch-readiness/003-themes-motion-and-print.md |
| § 3.1 Character | 007-comfort-and-launch-readiness/003-themes-motion-and-print.md |
| § 3.2 Color roles | 007-comfort-and-launch-readiness/003-themes-motion-and-print.md |
| § 3.3 Markers | 001-mvp/002-interactive-fretboard.md |
| § 3.4 Typography | 005-languages-and-notation/002-note-notation-and-accidentals.md |
| § 3.5 Motion | 002-triads-across-the-neck/002 (quality motion), 004-caged/003 (focus motion), 007-comfort-and-launch-readiness/003 (full system and reduced motion) |
| § 4 Screen anatomy | See subsections |
| § 4.1 Home screen | 001-mvp/001-walking-skeleton.md |
| § 4.2 Tool screen | 001-mvp/001-walking-skeleton.md, 007-comfort-and-launch-readiness/002 |
| § 4.3 Controls per tool | 001-mvp/004, 001-mvp/005, 004-caged/001–004 |
| § 5 Responsiveness | 007-comfort-and-launch-readiness/002-minimap-fit-and-landscape.md |
| § 5.1 Width ranges · § 5.2 Phone in portrait · § 5.3 Phone in landscape · § 5.5 Common rules | 007-comfort-and-launch-readiness/002-minimap-fit-and-landscape.md (portrait baseline already in 001-mvp/002) |
| § 5.4 Desktop | 007-comfort-and-launch-readiness/004 (shortcuts), 001-mvp/002 (hover) |
| § 6 The fretboard in detail | 001-mvp/002-interactive-fretboard.md, 003-your-instrument/004–005 |
| § 7 Accessibility in the design | 007-comfort-and-launch-readiness/001-describe-this-view-and-legend.md |
| § 8 What the design avoids | Not sliced: design guard-rails, referenced in 007-comfort-and-launch-readiness/003 |

### metronome-trainer-spec.md

| Source section | Covered by |
|---|---|
| § Overview (intro, observed vs inferred) | Not sliced: background. Observed and inferred status set the order of waves 008 and 009 |
| § Overview: Scope | Not sliced: scope boundary. Lesson content, accounts, syncing and authoring stay out; folded into the scope lines of 008-ratios-training/001 and 005 |
| § Overview: Platform | 008-ratios-training/001 (browser, desktop and mobile, audio), 010-practice-sessions/002. Dark theme replaced by the app's themes (decided at calibration) |
| § Shared metronome engine: parameters table | 008-ratios-training/001 (BPM, # of Beats), 008-ratios-training/003 (Count In rows) |
| § Shared metronome engine: Audio | 008-ratios-training/001 (accented and normal clicks, lookahead, background), 008-ratios-training/002 (soft subdivision click) |
| § Shared metronome engine: Visual beat indicator | 008-ratios-training/001 (dots), 008-ratios-training/003 (single pulsing count-in dot) |
| § Shared metronome engine: Status line | 008-ratios-training/001, 002, 003 |
| § Mode 1 — Metronome *(inferred)* | 009-more-modes/001 (plain click), 009-more-modes/003 (tap tempo, subdivisions) |
| § Mode 2 — Speed Training *(inferred)* | 009-more-modes/002-speed-training.md |
| § Mode 3 — Ratios Training *(observed)*: settings panel | 008-ratios-training/001 (BPM, beats, Start), 003 (count-in rows), 002 and 004 (Loop 1, Loop 2, Subdivision ratio) |
| § Mode 3 — Ratios Training: subdivision options | 008-ratios-training/002-subdivisions.md |
| § Mode 3 — Ratios Training: sequence | 008-ratios-training/004-alternating-ratios.md |
| § Run states and controls: state diagram and controls table | 008-ratios-training/001 (Start, Pause, Resume, Reset), 008-ratios-training/004 (loop states), 009-more-modes/001 (mode tabs) |
| § Run states and controls: persistence | 008-ratios-training/005-remembered-metronome-settings.md |
| § Run states and controls: keyboard and per-click display | 008-ratios-training/001-metronome-tool-and-click-engine.md |
| § Practice timer *(observed)* | 010-practice-sessions/001-practice-timer.md |
| § UI layout and visual design: metronome card | 008-ratios-training/001 (rows, button, status box, Pause and Reset), 008-ratios-training/002 and 004 (dropdowns, section header), 009-more-modes/001 (tab bar) |
| § UI layout and visual design: colour tokens | 008-ratios-training/001 and 010-practice-sessions/001: mapped to roles in the app's existing themes (accent, secondary accent, danger), not added as new values |
| § UI layout and visual design: responsive | 008-ratios-training/001 (96 px pill minimum), 009-more-modes/001 (tab icons drop on phones) |
| § Non-functional requirements: timing, audio start | 008-ratios-training/001, 002 |
| § Non-functional requirements: offline, no account | 010-practice-sessions/002-offline-practice.md |
| § Non-functional requirements: settings persist per mode | 008-ratios-training/005-remembered-metronome-settings.md |
| § Non-functional requirements: accessibility | 008-ratios-training/001; already baseline for the app since 007-comfort-and-launch-readiness/001 |
| § Acceptance criteria | Split by feature: sequence and status line → 008-ratios-training/004; 2 beats → 001, 002; Count In Off → 003; ratio Off → 004; Pause/Resume/Reset → 001; Speed Training → 009-more-modes/002; timer → 010-practice-sessions/001; background clicks → 008-ratios-training/001 |
| § Open questions (not visible in the video) | Listed below under Open questions, and in the files they gate |
| Sources (video link) | Not sliced: reference material |

## Open questions

1. **Q-1** Will anonymous usage measurement be adopted? → gates 007-comfort-and-launch-readiness/005 (and anonymous error reporting in it).
2. **Q-4** Synthesized or recorded sound? → 001-mvp/003-note-playback.md.
3. **Q-13** Same emphasis for the Cm and Gm shapes? → 004-caged/001-caged-shapes.md.
4. **Q-10** Does "CAGED" need explaining on the home card? → 004-caged/001-caged-shapes.md.
5. **Q-8** Do notation defaults per language match real usage? → 005-languages-and-notation/002.
6. **Q-12** Who are the reviewing teachers (M-4) and the native reviewers? → 005-languages-and-notation/001, and the pre-launch review gate.
7. **Q-11** Is a privacy notice or consent required? → 007-comfort-and-launch-readiness/004.
8. **Q-2 / Q-3** Final product name, owner, and budget → 001-mvp/001 (address and name), 007-comfort-and-launch-readiness/004.
9. **Q-5, Q-6, Q-7, Q-9, Q-14** Post-v1 questions (open-tuning CAGED, capo, next stage, 8-string, other solfège) → no file in these waves.
10. **Metronome: subdivisions and tap tempo in plain mode?** The source's defaults are used; confirm before building → 009-more-modes/003.
11. **Speed Training: step size, loops per step, stop or hold at target?** Defaults used: 5 BPM, 4 loops, hold (Stop selectable) → 009-more-modes/002.
12. **Full list of subdivision options** Only 8th Triplets and Sextuplets were seen; the source's eight-option list is used → 008-ratios-training/002.
13. **Click sounds, and can the user choose sounds or volume?** Three sounds assumed; whether the app's mute and volume govern the metronome → 008-ratios-training/001.
14. **Does the timer auto-start the metronome, or stop it at zero?** Assumed independent → 010-practice-sessions/001.
15. **BPM limits** 30–300 assumed → 008-ratios-training/001.
16. **Background playback conflicts with 001-mvp/003**, which stops sound when the app is hidden. The metronome is specified as an exception → 008-ratios-training/001.
