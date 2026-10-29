# 008-ratios-training / 003 — Count-in

**Source:** [§ Shared metronome engine](../../metronome-trainer-spec.md#shared-metronome-engine), [§ Mode 3 — Ratios Training](../../metronome-trainer-spec.md#mode-3--ratios-training-observed), [§ Run states and controls](../../metronome-trainer-spec.md#run-states-and-controls), [§ Non-functional requirements and acceptance criteria](../../metronome-trainer-spec.md#non-functional-requirements-and-acceptance-criteria)

**Prerequisites:** Assumes 008-ratios-training/001 and 002.

## Prompt

> A player needs a moment to get their hands on the strings and feel the tempo before the exercise starts. Add a count-in: a few clicks at the running BPM that come before the first loop.
>
> The settings view gains a **Count In** toggle (an on/off switch, on by default). When it is on, two rows appear beneath it, each with slider and −/value/+ pill: **Initial Count In** (0–8 clicks, default 4), the clicks before the first loop starts, and **Repeat Count In** (0–8 clicks, default 2), the clicks inserted before each change of loop. Turning the toggle off hides both rows and plays no count-in at all. Count-in clicks are all accented. During a count-in the running view swaps the dot row for a single dot that pulses on each click (a plain state change under reduced motion), and the status line reads `COUNT IN 1/4` … `4/4`. The first loop begins exactly one beat after the last count-in click, with no gap. Resuming from Pause never repeats a count-in. Repeat Count In has nothing to do until the pattern switches between two loops (008-ratios-training/004), but its value is stored now.
>
> Acceptance: when Count In is on with Initial Count In 4 at 85 BPM, the user hears four accented clicks with a single pulsing dot and `COUNT IN n/4`, then `BEAT 1/4 · SUB 3` begins on the next beat. When Count In is off, the two rows disappear and Start goes straight to `BEAT 1/4`. When Initial Count In is 0 with Count In on, the run starts on beat 1 directly. When the user pauses during the count-in and resumes, it continues from the frozen count-in click.

## Scope boundary

The repeat count-in between Loop 1 and Loop 2 is played in 008-ratios-training/004; Speed Training's count-in before each tempo change is in 009-more-modes/002.
