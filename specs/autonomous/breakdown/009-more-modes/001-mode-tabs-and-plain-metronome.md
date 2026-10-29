# 009-more-modes / 001 — Mode Tabs and Plain Metronome

**Source:** [§ Mode 1 — Metronome](../../metronome-trainer-spec.md#mode-1--metronome-inferred), [§ Run states and controls](../../metronome-trainer-spec.md#run-states-and-controls), [§ UI layout and visual design](../../metronome-trainer-spec.md#ui-layout-and-visual-design)

**Prerequisites:** Assumes wave 008-ratios-training in full.

## Prompt

> Not every practice session is a drill: sometimes a player just wants a click to play along with. Add a mode tab bar to the Metronome tool and a plain **Metronome** mode beside Ratios Training.
>
> The tab bar sits at the top of the metronome card with three equal tabs: `♩ Metronome`, `⚡ Speed Training`, `+ Ratios Training`. The active tab has accent-coloured text and a 2 px accent underline; inactive tabs are muted. On phones the labels drop their icons. Speed Training is delivered in 009-more-modes/002; until then its tab is not shown. Switching tabs while running stops playback at once and shows that mode's settings view. Each mode keeps its own remembered settings.
>
> Metronome mode is a plain click at a fixed BPM, with no training logic. Its settings view has BPM, # of Beats, Count In and Initial Count In, with the same ranges and defaults as Ratios Training, and the same Start, Pause/Resume and Reset behaviour, keyboard shortcuts and running view. Beat 1 of each loop is accented and the dots cycle through the loop. Repeat Count In is not shown, because there is no change of loop to count into. The status line reads `BEAT n/4`.
>
> Acceptance: when a user opens the Metronome tab, sets 100 BPM and 3 beats, and starts, they hear 4 count-in clicks, then a repeating 3-beat loop with beat 1 accented and three dots cycling. When the user switches to Ratios Training mid-run, sound stops and the Ratios Training settings view shows its own saved values. On a 375 px wide phone, the tabs show text labels without icons.

## Scope boundary

Tap tempo and subdivisions in plain Metronome mode are in 009-more-modes/003.
