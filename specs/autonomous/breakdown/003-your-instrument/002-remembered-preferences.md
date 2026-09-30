# 003-your-instrument / 002 — Remembered Preferences, No Account

**Source:** [§ Area 9 — On-device preferences](../../fretboard-master/03-functional-requirements.md#area-9--on-device-preferences), [§ Edge cases, Area 9](../../fretboard-master/08-edge-cases-and-error-handling.md#area-9--preferences), [§ DM-14 Preferences](../../fretboard-master/04-data-model.md#dm-14--preferences), [§ INT-4 Browser local storage](../../fretboard-master/05-integrations.md#int-4--browser-local-storage), [§ ARCH-8 Preferences](../../fretboard-master/07-architecture-overview.md#arch-8--preferences), [§ Area 1 — Structure and navigation](../../fretboard-master/03-functional-requirements.md#area-1--structure-and-navigation), [§ NFR-5 Privacy and compliance](../../fretboard-master/06-non-functional-requirements.md#nfr-5--privacy-and-compliance)

**Prerequisites:** Assumes 003-your-instrument/001-instrument-panel-and-tunings and the sound control from 001-mvp/003-note-playback.

## Prompt

> A guitarist coming back another day should find their instrument and settings as they left them, with no account, sign-in, or data leaving their device. Store preferences in the browser on this device only, and never send them anywhere.
>
> What's stored: the instrument (string count, tuning, custom or preset, fret count, handedness, string orientation), sound (muted, volume 0–1, tempo), the last tool used, the preferred label type per tool, and which one-time notices were already shown. Language, notation, accidental preference, and theme join the same store when those features arrive. The stored record carries a format version so it can gain fields later without breaking. The musical state of the tools (notes, root, key, shape in focus, layers) is deliberately not remembered: each visit starts each tool in its initial state. When a last-used tool exists, its home card shows "Continue". All three cards stay in their usual order. Writes happen on every change without blocking the interface.
>
> Stored data is untrusted input. Read it once at startup and validate every item against the allowed sets and ranges. If data is unreadable, partly invalid, or in an unknown old format, keep what's valid, use defaults for the rest, and show no error. If storage is blocked or unavailable (including some private browsing modes), the app works on defaults and says once per session that preferences won't be remembered. A full storage write fails silently and settings last until the session ends. With two tabs open, the last write wins and the other tab picks it up at next opening. The About page gets **Erase my preferences**, which asks for one-line confirmation, clears everything, restores defaults, and returns home.
>
> Acceptance: when a user who set Drop D and muted sound comes back the next day, Drop D and mute are restored and their last tool's card says "Continue", but the tool opens in its initial state. When storage is blocked, the app works and shows the not-remembered notice once. When stored data has a valid tuning and a corrupt volume, the tuning is kept and volume falls back to the default without an error. When a user confirms **Erase my preferences**, the defaults return and the home screen opens.

## Scope boundary

No sync across devices, cloud backup, or remembered study state.
