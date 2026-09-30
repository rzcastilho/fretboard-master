# 006-sharing / 001 — Share the Current View

**Source:** [§ Area 10 — Sharing by link](../../fretboard-master/03-functional-requirements.md#area-10--sharing-by-link), [§ UJ-8 Share a view](../../fretboard-master/02-user-journeys.md#uj-8--share-a-view), [§ DM-17 State link](../../fretboard-master/04-data-model.md#dm-17--state-link), [§ DM-15 View state](../../fretboard-master/04-data-model.md#dm-15--view-state), [§ INT-5 Sharing and clipboard](../../fretboard-master/05-integrations.md#int-5--sharing-and-clipboard), [§ ARCH-10 Link codec](../../fretboard-master/07-architecture-overview.md#arch-10--link-codec), [§ Edge cases, Area 10](../../fretboard-master/08-edge-cases-and-error-handling.md#area-10--link), [§ NFR-10 Evolution](../../fretboard-master/06-non-functional-requirements.md#nfr-10--evolution)

**Prerequisites:** Assumes all three tools (waves 001–004) and the instrument settings from wave 003.

## Prompt

> Marcos, a guitar teacher, builds a view in class and wants to send the student exactly that view, through any channel. Add **Share** to the application bar of every tool. It creates a link to the current view. On devices with a system share sheet, the sheet opens with the link and a short title that describes the view ("A minor — CAGED, E shape"). Elsewhere, the link is copied and the copy is confirmed. If copy or share isn't available or gets declined, the link appears in a selectable field with "Copy this address".
>
> The link includes the tool, its full musical state, the label type, and the instrument's string count, tuning (preset or each custom string), and fret count. For Notes, the musical state is the selected notes, active strings, region, background, hidden mode, and focused position. For Triads, it's root spelling, quality, inversion, set, view, octave, and comparison. For CAGED, it's key, quality, focused shape occurrence, layers, connections, Triad-layer set, and temporary tuning. The link leaves out language, notation, accidental preference, handedness, orientation, theme, sound, and scroll position, and it contains nothing that identifies a person or device. The format carries a version number so it can grow without breaking old links. The browser address bar also follows the tool's state, so bookmarking or copying the address works the same as **Share**. Address updates never add history entries, so back and forward still move between screens only.
>
> Acceptance: when a user on a phone taps **Share** on CAGED, A minor, E shape, Chord and Pentatonic layers, the system share sheet opens with the link and the title "A minor — CAGED, E shape". When a desktop user taps **Share**, the link is copied with a confirmation. When the clipboard is unavailable, the link shows in a selectable field. When a user changes the Triads inversion, the address bar updates and browser back still returns to the previous screen.

## Scope boundary

Opening and validating a received link is covered in 006-sharing/002. There are no short links, QR codes, or social-network integrations.
