# 002-triads-across-the-neck / 003 — Carry Context Between Notes and Triads

**Source:** [§ Area 1 — Structure and navigation](../../fretboard-master/03-functional-requirements.md#area-1--structure-and-navigation), [§ Area 4 — Fretboard Notes tool](../../fretboard-master/03-functional-requirements.md#area-4--fretboard-notes-tool), [§ TM-4 Triad spelling](../../fretboard-master/11-music-theory-reference.md#tm-4--triad-spelling), [§ Overall navigation map](../../fretboard-master/02-user-journeys.md#overall-navigation-map), [§ Edge cases, Area 4](../../fretboard-master/08-edge-cases-and-error-handling.md#area-4--fretboard-notes), [§ ARCH-4 View state manager](../../fretboard-master/07-architecture-overview.md#arch-4--view-state-manager)

**Prerequisites:** Assumes 001-mvp/004-fretboard-notes-tool and 001-mvp/005-triads-isolated-view.

## Prompt

> Moving between tools should feel like one study, not two apps. What a guitarist found in one tool should be waiting in the next. Link Fretboard Notes and Triads so musical context carries over automatically, and each tool remembers its state for the session.
>
> Carry-over rules: from Notes with exactly one note selected, opening Triads makes that note the root and keeps the last quality, inversion, and string set used in Triads. From Triads, opening Notes selects the triad's three notes. With nothing selected at the origin, the destination opens in its last session state, or its initial state if it has none. Returning to a visited tool reopens it as it was left, unless a carry-over brings new context. **Reset tool** returns a tool to its initial state without touching instrument, language, or notation. None of these in-tool changes add browser history entries.
>
> In Notes, the position card gains **Triads from this note**. When the selection is exactly three notes that form a major, minor, diminished, or augmented triad, Notes shows the triad's name and **View as triad**, which opens Triads with that root and quality. Detection: three distinct pitch classes form a supported triad when, taking one as the root, the others sit at (4, 7), (3, 7), (3, 6), or (4, 8) semitones. The first three patterns have a unique root. The augmented triad has three possible roots, so the first-selected note is used. If three notes form no supported triad, the shortcut doesn't appear and no message shows.
>
> Acceptance: when a user selects C, E, and G in Notes, the tool shows "C major" and **View as triad** opens Triads on C major. When a user with A selected switches to Triads after last using 1st inversion on 4-3-2, Triads opens on A major, 1st inversion, 4-3-2. When a user selects G♯, C, E (with G♯ first), **View as triad** opens G♯ augmented. When a user selects C, D, E, no shortcut appears.

## Scope boundary

Links to and from CAGED come with 004-caged/006. Carrying state across visits isn't included (by design, only preferences persist).
