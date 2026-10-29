# 008-ratios-training / 001 — Metronome Tool and Steady Click

**Source:** [§ Overview](../../metronome-trainer-spec.md#overview), [§ Shared metronome engine](../../metronome-trainer-spec.md#shared-metronome-engine), [§ Run states and controls](../../metronome-trainer-spec.md#run-states-and-controls), [§ UI layout and visual design](../../metronome-trainer-spec.md#ui-layout-and-visual-design), [§ Non-functional requirements and acceptance criteria](../../metronome-trainer-spec.md#non-functional-requirements-and-acceptance-criteria)

**Prerequisites:** Assumes waves 001–007 are delivered: the app shell and home cards (001-mvp/001), sound unlock and the mute and volume control (001-mvp/003), the three languages (005-languages-and-notation/001), and themes and reduced motion (007-comfort-and-launch-readiness/003).

## Prompt

> A guitarist building speed needs a click they can trust: one that never drifts or stutters, because a wobbly click makes every exercise useless. Add a fourth tool to Fretboard Master, **Metronome**, with its own home card, and open it on the **Ratios Training** practice panel. This first slice delivers the steady click and the run controls; subdivisions, count-in and loop alternation follow.
>
> The settings view has a **BPM** row (30–300, default 85, step 1) and a **# of Beats** row (beats per loop, 1–16, default 4). Each row is a label on the left, a slider in the middle, and a −/value/+ pill on the right that keeps at least 96 px when space is tight. A full-width orange **Start Training** button opens the running view: a bordered status box with the position in small caps on the left (`BEAT 2/4`), the BPM in large accent digits on the right, and a centred row of one dot per beat. The current beat's dot is lit, beats already played stay dimmed, upcoming beats are grey. Beat 1 of each loop plays an accented click, other beats a normal click. Below the box sit a full-width **Pause** button (it becomes an orange **Resume**) and a small red **Reset** square. Pause stops sound at once and freezes the dots and status line; Resume continues from the frozen beat; Reset returns to the settings view with the same values. Space toggles Start/Pause/Resume and Esc resets. Every control works by keyboard, sliders expose value and range, and the status line has a live text equivalent for screen readers. All labels ship in English, Portuguese and Spanish, and the card follows the app's themes, using the accent for active and lit states and red only for Reset.
>
> Timing is the product: click jitter stays within 2 ms with no cumulative drift over 10 minutes at any BPM, the first click sounds within 50 ms of Start and is never cut off (iOS included), and clicks keep going when the tab is hidden or the phone locks, as far as the platform allows. This is a deliberate exception to the app's rule that playback stops when the app is hidden.
>
> Acceptance: when a user sets 85 BPM and 4 beats and taps Start Training, four dots appear and the status line steps `BEAT 1/4` … `4/4` in step with the clicks, beat 1 accented. When # of Beats is 2, two dots show and the line reads `BEAT n/2`. When the user pauses on beat 3 and resumes, the next click is beat 4, with no count-in. When the user sets 300 BPM and runs for 10 minutes, the last click lands where the clock says it should.

## Scope boundary

No subdivisions, count-in, Loop 2, mode tabs, or remembered settings; those arrive in the following files and waves.

## Open questions

- Should the app's existing mute and volume control govern the metronome, or does the metronome need its own volume?
