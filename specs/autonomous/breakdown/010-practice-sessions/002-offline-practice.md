# 010-practice-sessions / 002 — Practise Offline

**Source:** [§ Overview](../../metronome-trainer-spec.md#overview), [§ Non-functional requirements and acceptance criteria](../../metronome-trainer-spec.md#non-functional-requirements-and-acceptance-criteria)

**Prerequisites:** Assumes 010-practice-sessions/001-practice-timer and waves 001–009.

## Prompt

> Practice rooms, rehearsal spaces and basements often have poor or no signal, and a metronome that won't load there is no metronome at all. After a first visit with a connection, Fretboard Master should open and work fully with no network, and can be added to the phone's home screen like an installed app. No account is required.
>
> After the first successful load, everything needed to run the app (pages, every tool, all three languages, the click and chime sounds, and the note sounds) is kept on the device. With no connection, opening the app's address or the home-screen icon shows the app as usual, and every tool works, including the Metronome tool and timer. The app shows no "offline" error for features that don't need the network. When a newer version is published, it is fetched in the background and used on the next launch, never mid-session, so a running metronome is never interrupted by an update. Saved preferences and metronome settings are not affected by updates. The app keeps working when the device's storage pressure clears the cache: it falls back to loading from the network as on a first visit.
>
> Acceptance: when a user loads the app once, switches the phone to airplane mode, and opens the home-screen icon, the home screen appears and the Metronome runs Ratios Training with sound. When a new version is published while the user is mid-run, the run continues uninterrupted and the next launch uses the new version. When the user has never loaded the app and is offline, the browser's normal no-connection page shows.

## Scope boundary

No background sync, push notifications or offline sharing of links; this only covers using the app offline.
