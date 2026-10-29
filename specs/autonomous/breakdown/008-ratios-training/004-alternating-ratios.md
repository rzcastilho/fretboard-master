# 008-ratios-training / 004 — Alternate Two Ratios

**Source:** [§ Mode 3 — Ratios Training](../../metronome-trainer-spec.md#mode-3--ratios-training-observed), [§ Run states and controls](../../metronome-trainer-spec.md#run-states-and-controls), [§ UI layout and visual design](../../metronome-trainer-spec.md#ui-layout-and-visual-design), [§ Non-functional requirements and acceptance criteria](../../metronome-trainer-spec.md#non-functional-requirements-and-acceptance-criteria)

**Prerequisites:** Assumes 008-ratios-training/001, 002 and 003.

## Prompt

> The hardest part of fast playing is switching cleanly between note groupings without the tempo moving. This is the heart of Ratios Training: the metronome alternates between two subdivisions at a constant BPM, with a short count-in at every switch, so the player practises changing ratio, for example 8th-note triplets to sextuplets and back.
>
> Add a **SUBDIVISION RATIO** section header in small caps with an on/off switch on the right (on by default), and a **Loop 2** dropdown under Loop 1 with the same eight options (default Sextuplets). When the section is on, a run goes: Initial Count In, Loop 1 for # of Beats beats, Repeat Count In, Loop 2 for # of Beats beats, Repeat Count In, back to Loop 1, and so on until Pause or Reset. The `SUB` value always shows the clicks-per-beat of the loop playing, and a Repeat Count In shows as `COUNT IN n/2` with the single pulsing dot. Switches have no gap and no overlap. When the section is off, only Loop 1 repeats and no repeat count-in is played. When Count In is off, the loops switch back to back. Pause and Resume keep the exact position, including which loop and whether a count-in was in progress.
>
> Acceptance: when a user runs 85 BPM, 4 beats, Count In 4/2, Loop 1 8th Triplets, Loop 2 Sextuplets, the audible sequence is 4 clicks, 4 beats × 3, 2 clicks, 4 beats × 6, 2 clicks, 4 beats × 3 …, and the status line shows `COUNT IN n/4`, `BEAT n/4 · SUB 3`, `COUNT IN n/2`, `BEAT n/4 · SUB 6` in step with the audio. When Subdivision ratio is off, Loop 1 repeats with no repeat count-in. When the user pauses on `BEAT 3/4 · SUB 6` and resumes, the next click is beat 4 of Loop 2.

## Scope boundary

Exactly two loops at one BPM; more than two patterns, per-loop tempos or per-loop beat counts are not included.
