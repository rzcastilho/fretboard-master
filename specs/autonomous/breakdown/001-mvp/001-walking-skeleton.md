# 001-mvp / 001 — Walking Skeleton: Home Screen and Navigation

**Source:** [§ Area 1 — Structure and navigation](../../fretboard-master/03-functional-requirements.md#area-1--structure-and-navigation), [§ 4.1 Home screen](../../fretboard-master/12-design-and-experience.md#41-home-screen), [§ 4.2 Tool screen](../../fretboard-master/12-design-and-experience.md#42-tool-screen), [§ Edge cases, Area 1](../../fretboard-master/08-edge-cases-and-error-handling.md#area-1--structure-and-navigation), [§ INT-1 Application delivery](../../fretboard-master/05-integrations.md#int-1--application-delivery), [§ NFR-7 Availability and scale](../../fretboard-master/06-non-functional-requirements.md#nfr-7--availability-and-scale), [§ 7. Constraints](../../fretboard-master/00-overview.md#7-constraints)

**Prerequisites:** None — first slice of the MVP.

## Prompt

> Give a guitarist a real address they can open in any current browser, on a phone or a desktop, and land on a working home screen with no install, sign-up, or sign-in. This is the walking skeleton of Fretboard Master, an app of interactive fretboard study tools. It should be deployed, reachable, and navigable end to end, even before the tools do anything musical.
>
> The home screen has a top zone (product name and an "About" link), a center zone with tool cards, and a bottom zone reserved for the instrument summary. For this release there are two cards of equal visual weight: **Fretboard Notes** ("Where is every note?") and **Triads** ("What is a chord made of?"). A third card, CAGED, is added later. No decorative images, carousel, or intro text: the first possible action is choosing a study. Each card opens a tool screen laid out in the shared five zones (application bar, main controls, fretboard, context panel, actions), filled with placeholders for now. Inside a tool, persistent navigation reaches home or the other tool in one action and shows the current tool. Browser back and forward move between screens only. The About page shows a short description and the app version.
>
> The app never goes blank. While loading, home appears as a skeleton, never a full-screen spinner. On the reference phone (mid-range, about four years old, median mobile network), home is usable within 3 seconds. The page never scrolls horizontally at 320–2560 logical widths, and it respects phone safe areas. All traffic is encrypted. A new version publishes without downtime, and open sessions keep the version they loaded.
>
> Acceptance: when a user opens the root address, the home screen with both cards is usable within 3 seconds on the reference phone. When a user opens an address that doesn't exist, home opens with the notice "We could not find that page". When a tool hits an unexpected failure, it shows "Something went wrong in this view" with **Reset tool** and **Go to home**, and the rest of the app keeps working. When a user in Triads presses browser back, they return to home.

## Scope boundary

No fretboard, sound, preferences, or languages other than English. Those come in later slices.
