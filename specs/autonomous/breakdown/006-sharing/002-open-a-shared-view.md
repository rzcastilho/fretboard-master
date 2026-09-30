# 006-sharing / 002 — Open a Shared View

**Source:** [§ Area 10 — Sharing by link](../../fretboard-master/03-functional-requirements.md#area-10--sharing-by-link), [§ Edge cases, Area 10](../../fretboard-master/08-edge-cases-and-error-handling.md#area-10--link), [§ UJ-8 Share a view](../../fretboard-master/02-user-journeys.md#uj-8--share-a-view), [§ NFR-6 Security](../../fretboard-master/06-non-functional-requirements.md#nfr-6--security), [§ ARCH-10 Link codec](../../fretboard-master/07-architecture-overview.md#arch-10--link-codec)

**Prerequisites:** Assumes 006-sharing/001-share-a-view.

## Prompt

> The student taps the teacher's link on their phone and should land straight on the same view, drawn for them: in their language, notation, handedness, and string orientation. Opening a link skips the home screen and goes directly to the described tool and state.
>
> When the link's instrument differs from the viewer's stored one, the view uses the link's instrument and shows a persistent notice: "This view uses [tuning]". For a custom tuning, it lists the string notes. The notice offers two actions. **Use mine** recalculates the view on the local instrument. **Adopt this one** stores the link's instrument as the preference. Until one is chosen, the link's instrument applies only to that tool for that session and nothing stored changes. If **Use mine** makes the view impossible (say a 7-6-5 set on a 6-string), the system moves to the nearest equivalent and says so. The same applies when a link describes a state that's impossible on its own instrument. A link with a non-compatible tuning opened in CAGED shows the standard-tuning fallback.
>
> Links are untrusted input. Every value is checked against the allowed sets and ranges before use, nothing from the link is rendered as formatted text or executed, and invalid values never break the app. Missing, unknown, or out-of-range values fall back to that tool's defaults, and valid values are kept. If anything was replaced, a notice says "This link was incomplete; we show the closest view possible". An unknown tool, or a link from a newer format version, opens home or the closest view with the same notice. Links made by any earlier version keep working in later versions.
>
> Acceptance: when a left-handed Portuguese student opens a teacher's Drop D link for CAGED, D major, E shape, it opens that view mirrored, in Portuguese, with "This view uses Drop D", **Use mine**, and **Adopt this one**. When the student taps **Adopt this one**, Drop D becomes their stored tuning. When a link carries an out-of-range fret count and an unknown quality, both fall back to defaults, the valid values are kept, and the incomplete-link notice shows. When a link names a tool that doesn't exist, home opens with the notice.

## Scope boundary

Links never carry or apply personal presentation settings (language, notation, handedness, theme, sound).
