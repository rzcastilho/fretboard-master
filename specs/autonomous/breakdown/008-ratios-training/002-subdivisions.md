# 008-ratios-training / 002 — Subdivisions

**Source:** [§ Mode 3 — Ratios Training](../../metronome-trainer-spec.md#mode-3--ratios-training-observed), [§ Shared metronome engine](../../metronome-trainer-spec.md#shared-metronome-engine), [§ Non-functional requirements and acceptance criteria](../../metronome-trainer-spec.md#non-functional-requirements-and-acceptance-criteria)

**Prerequisites:** Assumes 008-ratios-training/001-metronome-tool-and-click-engine.

## Prompt

> Speed comes from evenly placed notes inside the beat, not just from the beat itself. Let the guitarist choose how many clicks fill each beat, so they can practise 8th-note triplets, sextuplets and the rest against an audible grid.
>
> Add a **Loop 1** dropdown to the Ratios Training settings view: a full-width dark dropdown with a chevron. Its options, in this order, with clicks per beat: Quarter notes (1), 8th notes (2), 8th Triplets (3), 16th notes (4), Quintuplets (5), Sextuplets (6), Septuplets (7), 32nd notes (8). The default is 8th Triplets. While running, each beat plays its usual click (accented on beat 1) followed by the remaining subdivision clicks, evenly spaced across the beat, in a third, softer sound so the beat stays easy to hear. The status line adds the clicks-per-beat of the loop that is playing: `BEAT 2/4 · SUB 3`. The dots still move once per beat, not once per subdivision. Subdivision clicks keep the same timing guarantees as beat clicks: no drift, jitter within 2 ms, and at 300 BPM with 32nd notes (40 clicks a second) every click still sounds distinctly.
>
> Acceptance: when a user picks 8th Triplets at 85 BPM with 4 beats and starts, each beat sounds one beat click and two soft clicks, evenly spaced, and the status line reads `BEAT n/4 · SUB 3`. When the user picks Quarter notes, only beat clicks play and the line reads `SUB 1`. When # of Beats is 2, the line reads `BEAT 2/2 · SUB 3` and two dots show.

## Scope boundary

One subdivision for the whole run; the second loop and alternation between two subdivisions are in 008-ratios-training/004.
