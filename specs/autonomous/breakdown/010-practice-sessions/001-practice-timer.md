# 010-practice-sessions / 001 — Practice Timer

**Source:** [§ Practice timer](../../metronome-trainer-spec.md#practice-timer-observed), [§ Non-functional requirements and acceptance criteria](../../metronome-trainer-spec.md#non-functional-requirements-and-acceptance-criteria)

**Prerequisites:** Assumes wave 008-ratios-training and 009-more-modes/001-mode-tabs-and-plain-metronome.

## Prompt

> Short, focused, time-boxed practice beats long unfocused sessions. Add a countdown timer above the metronome card so the player can give each exercise a fixed number of minutes, without reaching for another device.
>
> The timer card has a stopwatch icon with the heading **Timer**, a row of preset pills `1m` to `10m`, a large seven-segment-style readout such as `02:00`, and a round play button on the right that becomes a pause button while running. The selected pill is outlined in the secondary accent (the green role). Tapping a preset sets the countdown to that many minutes and stops any running countdown; tapping the selected preset again resets it to the full duration. The readout counts down in whole seconds. At zero the readout flashes (a plain state change under reduced motion), a short chime plays, and the timer stops. The timer and the metronome are fully independent: the metronome keeps running at zero, starting the timer doesn't start the metronome, and the timer state survives mode-tab switches and Reset of the metronome. The chosen preset is remembered on the device; a running countdown is not. The chime respects the app's mute setting, and the screen-reader live region announces the last 10 seconds and zero.
>
> Acceptance: when a user picks `2m` and taps play, the readout counts `02:00`, `01:59` … `00:00`, then flashes and chimes while the metronome keeps clicking. When the user taps `5m` while a 2-minute countdown is running, the countdown stops and reads `05:00`. When the user resets the metronome mid-countdown, the timer keeps counting.

## Scope boundary

No custom durations, stopwatch mode, session history or link between timer and metronome.

## Open questions

- Should the timer auto-start the metronome, or stop it at zero? The source leaves this open; this file assumes neither.
