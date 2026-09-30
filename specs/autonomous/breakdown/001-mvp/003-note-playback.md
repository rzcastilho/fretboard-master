# 001-mvp / 003 — Hear Any Position

**Source:** [§ Area 7 — Audio](../../fretboard-master/03-functional-requirements.md#area-7--audio), [§ Edge cases, Area 7](../../fretboard-master/08-edge-cases-and-error-handling.md#area-7--audio), [§ UJ-7 Hear what is on screen](../../fretboard-master/02-user-journeys.md#uj-7--hear-what-is-on-screen), [§ INT-3 Device audio output](../../fretboard-master/05-integrations.md#int-3--device-audio-output), [§ ARCH-7 Audio engine](../../fretboard-master/07-architecture-overview.md#arch-7--audio-engine), [§ NFR-1 Performance](../../fretboard-master/06-non-functional-requirements.md#nfr-1--performance)

**Prerequisites:** Assumes the fretboard from 001-mvp/002-interactive-fretboard.

## Prompt

> A guitarist with an instrument on their lap wants to tap a fret on screen and hear exactly that pitch, so they can check what they're playing and link shape to sound. Make every fretboard position audible at its real pitch: the open-string pitch in the tuning in use plus the fret number, in semitones. Tapping string 5, fret 3 in standard tuning plays C3.
>
> The tone should sound like a clean guitar string, with a clear attack and a natural decay. Every note from the lowest open string to the highest fret of string 1 should be in tune and at a balanced perceived volume, and low notes need enough harmonics to be recognizable on a small phone speaker. The app makes no sound before the user does something. Audio turns on with the first gesture that asks for sound. After that, a note starts within 100 ms of a tap. The positions that sound pulse on the fretboard in sync with the audio, and they still pulse when sound is muted, because the pulse carries information. Under reduced motion, the pulse becomes a plain state change. A sound control in the application bar mutes and sets volume; it lasts for the session for now. A new request interrupts whatever is playing, so fast taps never pile up. Sequences offer a **Stop** command. Playback stops when the app is hidden (tab switch, screen lock) and does not resume by itself.
>
> Once loaded, sound needs no network. The audio part takes requests in musical terms (one pitch, a set of simultaneous pitches, or a sequence with a tempo) and returns time marks for the synced emphasis, so later tools can reuse it for triads, arpeggios, and scales.
>
> Acceptance: when a user taps string 6 open for their first sound, audio turns on and E2 plays. When audio can't start or the sound material failed to load, a single notice shows for the session ("Sound is not available on this device right now"), the sound control shows unavailable, and the pulses keep working. When a user taps three positions in quick succession, each tap cuts off the one before. When the user switches tabs mid-note, the sound stops and stays stopped on return.

## Scope boundary

Triad, arpeggio, and scale playback belong to the tools that trigger them. Remembering volume and mute between visits comes with 003-your-instrument/002-remembered-preferences.

## Open questions

- Q-4: will the sound be synthesized or recorded from a real instrument? Recorded audio has to cover A1 to E6 and weighs on first-load size.
