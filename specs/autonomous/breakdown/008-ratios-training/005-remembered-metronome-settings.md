# 008-ratios-training / 005 — Remembered Metronome Settings

**Source:** [§ Run states and controls](../../metronome-trainer-spec.md#run-states-and-controls), [§ Non-functional requirements and acceptance criteria](../../metronome-trainer-spec.md#non-functional-requirements-and-acceptance-criteria)

**Prerequisites:** Assumes 008-ratios-training/001–004 and the on-device preferences store from 003-your-instrument/002-remembered-preferences.

## Prompt

> A player who practises daily shouldn't have to dial in 85 BPM, 4 beats, count-in 4/2 and triplets ↔ sextuplets every time. Remember the metronome settings on the device, with no account.
>
> Every value the user sets in the Ratios Training settings view (BPM, # of Beats, Count In on/off, Initial Count In, Repeat Count In, Subdivision ratio on/off, Loop 1, Loop 2) is kept on the device, survives Reset and a page reload, and is restored the next time the Metronome tool opens. Settings are kept per mode, so later modes (Metronome, Speed Training) each keep their own values without overwriting these. They live in the app's existing preferences store: the same versioning, the same validation (a stored value outside its range is replaced by the default, and the tool still opens), and the same **Erase** command, which also clears the metronome settings. The running position is not remembered; reopening the tool always lands on the settings view.
>
> Acceptance: when a user sets 120 BPM, 2 beats and Loop 2 to Quintuplets, then reloads the page, the settings view shows those values. When the stored BPM is 900 (corrupt or from an older version), the tool opens with BPM 85 and the other stored values intact. When the user erases their preferences, the metronome returns to its defaults.

## Scope boundary

Settings are not shared by link and not synced between devices.
