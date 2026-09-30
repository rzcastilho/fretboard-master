# 00 — Overview

**Product:** Fretboard Master (working name)
**Type:** web application of interactive tools for studying the guitar fretboard
**Specification version:** 1.0 — 30 September 2026
**Nature:** technology-agnostic. It describes behavior, data, and logical architecture; it does not choose languages, libraries, or infrastructure.

## 1. Vision

Give every guitarist an interactive fretboard that is theoretically correct and pleasant to use, on which they see and hear the notes, the triads, and the CAGED shapes — on their instrument, in their tuning, and in their language.

## 2. Problem

Guitarists learn chords and solos as memorized shapes and take years to understand what they are playing. Three gaps recur in almost every student:

1. **They do not know where the notes are.** They know the open strings and a few notes on strings 6 and 5; the rest of the neck is unknown territory.
2. **They do not see the triad inside the chord.** They play the full barre chord without knowing that three notes carry the harmony, or where the root, the third, and the fifth are.
3. **They do not connect the regions of the neck.** They stay in one or two positions because they do not see that the same chord exists in five linked shapes.

The material available today is static (printed diagrams, videos) or tied to standard tuning and right-handed players. Left-handed players, 7-string players, and players who use alternate tunings have to translate everything in their heads.

## 3. Target users

- **Beginner** — has just started; uses the tool to locate notes and check what a teacher or method book asks for.
- **Guitarist who plays without theory** — has repertoire but works from memorized shapes; uses the tool to name what they already do.
- **Stuck intermediate player** — knows the basics and wants to unlock the whole neck with triads and CAGED.
- **Guitar teacher** — uses the tool as a visual board during lessons. There is no teacher role or account; the teacher is a user like any other.

Details in `01-personas-and-jobs.md`.

## 4. Teaching principle

This version has no lessons and no explanatory text. The teaching lives **in the design of the tools**, which follow the choices of an experienced teacher:

- One concept at a time: the initial view of each tool shows the minimum; everything else is optional.
- The function of the note comes before the shape of the hand: root, third, and fifth have a fixed visual identity across the product.
- Theoretically correct spelling: C augmented is C–E–G♯, never C–E–A♭.
- See, hear, and compare: every position on screen can be heard; every shape can be compared with its neighbor.
- The screen shows the student's own instrument: every calculation respects tuning, string count, and handedness.

## 5. Scope

### 5.1 In scope (version 1)

| Area | Content |
|---|---|
| Fretboard notes | Interactive fretboard with every note; filters by note, string, region, and naturals; octaves and unisons; labels on demand |
| Triads | Major, minor, diminished, and augmented; root position, 1st and 2nd inversions; every set of three adjacent strings; isolated view and full-neck view; comparison between qualities |
| CAGED | The five major and minor shapes; connections between shapes; chord, triad, arpeggio, pentatonic, and scale layers |
| Instrument | 6 and 7 strings; right-handed and left-handed; preset and custom tunings; 12 to 24 frets |
| Audio | Playback of single notes, triads (block and arpeggiated), arpeggios, and scales |
| Language and notation | English, Portuguese (Brazil), and Spanish; letter names (C D E) or solfège names (Do Re Mi); sharps or flats |
| Preferences | Stored on the user's own device, without an account |
| Sharing | A link that reopens the tool in the same state |

### 5.2 Out of scope (version 1)

- Accounts, login, and synchronization across devices.
- Gamification: streaks, daily goals, achievements, levels, scores.
- Guided lessons, level-based tracks, and explanatory teacher text.
- Exercises, quizzes, and any form of assessment.
- Progress tracking or study history.
- Spaced repetition.
- Capturing the instrument's audio through the microphone.
- Offline use and installation as an app.
- Seventh chords, extended chords, open-voiced (spread) triads, modes, and scales beyond major, natural minor, and the pentatonics.
- Tablature, standard notation, metronome, tuner, and backing tracks.
- Monetization and advertising.
- Other instruments (bass, classical guitar with its own specifics, ukulele).

## 6. Success metrics

| # | Signal | Target |
|---|---|---|
| M-1 | In a usability test, the participant finds every occurrence of a requested note using the notes tool | ≥ 90% finish within 60 seconds, unaided |
| M-2 | In a usability test, the participant displays a specific triad (root, quality, inversion, string set) | ≥ 85% finish within 90 seconds, unaided |
| M-3 | In a usability test, the participant displays the five CAGED shapes of a key and identifies the roots | ≥ 85% finish within 90 seconds, unaided |
| M-4 | Review by two independent guitar teachers | Zero theory errors in the views of the sample defined in file 11 |
| M-5 | First interaction with the fretboard after opening the application | Median ≤ 15 seconds |
| M-6 | Sessions in which the user hears at least one sound | ≥ 50% |
| M-7 | Phone sessions with at least one fretboard interaction | Proportion equivalent to desktop (difference ≤ 10 percentage points) |

M-5 to M-7 depend on anonymous, aggregate measurement (see `05-integrations.md`, INT-2, and open question Q-1).

## 7. Constraints

- **C-1** The application runs in a browser, without installation.
- **C-2** There is no sign-up and no authentication. The application collects no personal data.
- **C-3** The application requires an internet connection to load.
- **C-4** Phone and desktop have the same priority: no feature is exclusive to either.
- **C-5** The three languages launch together.
- **C-6** Every view is calculated from the configured tuning; no diagram is drawn only for standard tuning.
- **C-7** The product is new; there is no legacy system to replace or integrate with.

## 8. Specification map

| File | Content |
|---|---|
| `01-personas-and-jobs.md` | Personas and jobs-to-be-done |
| `02-user-journeys.md` | End-to-end flows |
| `03-functional-requirements.md` | Numbered requirements by area |
| `04-data-model.md` | Logical entities |
| `05-integrations.md` | External systems |
| `06-non-functional-requirements.md` | Performance, accessibility, privacy, internationalization |
| `07-architecture-overview.md` | Components and responsibilities |
| `08-edge-cases-and-error-handling.md` | Empty states, errors, and edge situations |
| `09-assumptions-and-open-questions.md` | What is assumed and what remains to be decided |
| `10-glossary.md` | Domain terms |
| `11-music-theory-reference.md` | The musical rules the tools implement |
| `12-design-and-experience.md` | Visual principles, responsiveness, and fretboard anatomy |
