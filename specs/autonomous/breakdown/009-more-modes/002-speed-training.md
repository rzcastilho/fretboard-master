# 009-more-modes / 002 — Speed Training

**Source:** [§ Mode 2 — Speed Training](../../metronome-trainer-spec.md#mode-2--speed-training-inferred), [§ Run states and controls](../../metronome-trainer-spec.md#run-states-and-controls), [§ Non-functional requirements and acceptance criteria](../../metronome-trainer-spec.md#non-functional-requirements-and-acceptance-criteria)

**Prerequisites:** Assumes 009-more-modes/001-mode-tabs-and-plain-metronome and wave 008-ratios-training.

## Prompt

> The classic way to build speed is to play a passage a few times at one tempo, nudge the tempo up, and repeat until the goal tempo. Add a **Speed Training** mode that does the nudging for the player, so they can keep their eyes on the guitar.
>
> The settings view has **Start BPM** (defaults to the current BPM), **Target BPM** (defaults to Start + 40, never below Start BPM), **Increment** (1–20 BPM, default 5), **Loops per step** (default 4: the number of full # of Beats loops played at each tempo before stepping up), # of Beats, the Count In rows, and an **At target** choice of **Hold** (default) or **Stop**. Each numeric row uses the same slider and −/value/+ pill. A run plays Initial Count In, then Loops per step loops at Start BPM, then Repeat Count In, then the next step at Start + Increment, and so on. The last step is exactly Target BPM, even if the increment would overshoot it. At target, Hold keeps clicking at Target BPM until Pause or Reset; Stop ends the run and returns to the settings view. The status line reads `STEP 3/9 · LOOP 2/4`, and the BPM readout updates at the first click of each new step. Pause, Resume and Reset behave as in the other modes; Resume continues within the same step and loop.
>
> Acceptance: when a user sets Start 80, Target 120, Increment 5, Loops per step 4, 4 beats and starts, they hear 4 loops at 80, a 2-click count-in, 4 loops at 85, and so on through 9 steps to 120, and the status line shows `STEP 1/9 · LOOP 1/4` at the start. When Target is 102 with Start 80 and Increment 5, the steps are 80, 85, 90, 95, 100, 102. When the user tries to set Target below Start, Target stops at Start BPM. When At target is Stop, the run returns to the settings view after the last loop at Target BPM.

## Scope boundary

No subdivisions inside Speed Training, and no automatic tempo decrease or per-step loop counts.
