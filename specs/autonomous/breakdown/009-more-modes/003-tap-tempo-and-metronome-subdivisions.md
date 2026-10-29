# 009-more-modes / 003 — Tap Tempo and Subdivisions in Plain Metronome

**Source:** [§ Mode 1 — Metronome](../../metronome-trainer-spec.md#mode-1--metronome-inferred), [§ Open questions](../../metronome-trainer-spec.md#open-questions-not-visible-in-the-video)

**Prerequisites:** Assumes 009-more-modes/001-mode-tabs-and-plain-metronome and 008-ratios-training/002-subdivisions.

## Prompt

> When a player hears a tempo in a song or a lesson, it is faster to tap it than to guess a number. And a plain click is more useful when it can also mark 8ths or triplets. Add two conveniences to the plain Metronome mode.
>
> **Tap tempo:** tapping the BPM readout four or more times sets BPM to the average interval of the recent taps, rounded to a whole BPM and kept within 30–300. A pause of more than two seconds between taps starts a new measurement. Tap tempo works from the keyboard too, and it is available in the settings view and while running; while running, the new tempo takes effect at the next beat without restarting the loop. **Subdivision:** a selector with Quarter, 8ths, Triplets and 16ths adds softer clicks evenly between the beats, using the same soft sound as Ratios Training, and the status line adds `· SUB n` when it is not Quarter. Both values are remembered with the other Metronome-mode settings.
>
> Acceptance: when a user taps the readout four times 0.5 seconds apart, BPM becomes 120. When they tap three times only, BPM does not change. When they tap faster than 300 BPM, BPM becomes 300. When the user picks Triplets at 90 BPM, each beat sounds one beat click and two soft clicks, and the status line reads `BEAT n/4 · SUB 3`.

## Scope boundary

Both features are optional extras inferred from the source; Ratios Training and Speed Training do not get tap tempo here.

## Open questions

- The source marks both features as "nice to have" and asks whether the real Metronome tab has them. Confirm before building, or drop this file.
