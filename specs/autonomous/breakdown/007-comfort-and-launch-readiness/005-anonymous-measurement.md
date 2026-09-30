# 007-comfort-and-launch-readiness / 005 — Anonymous Usage Measurement and Error Reporting

**Source:** [§ INT-2 Anonymous usage measurement (conditional)](../../fretboard-master/05-integrations.md#int-2--anonymous-usage-measurement-conditional), [§ DM-18 Usage event (conditional)](../../fretboard-master/04-data-model.md#dm-18--usage-event-conditional), [§ ARCH-11 Measurement (conditional)](../../fretboard-master/07-architecture-overview.md#arch-11--measurement-conditional), [§ NFR-8 Observability](../../fretboard-master/06-non-functional-requirements.md#nfr-8--observability), [§ 6. Success metrics](../../fretboard-master/00-overview.md#6-success-metrics), [§ NFR-5 Privacy and compliance](../../fretboard-master/06-non-functional-requirements.md#nfr-5--privacy-and-compliance)

**Prerequisites:** Assumes all tools (waves 001–004), sharing (wave 006), and the About page from 007-comfort-and-launch-readiness/004. Build it only if open question Q-1 is decided in favor.

## Prompt

> The team needs to know whether the product works for real people: how fast they first touch the fretboard, whether they hear sound, whether phone users engage as much as desktop users. It has to learn that without knowing who anyone is. Add anonymous, aggregate usage measurement. The app sends these events without blocking: tool opened, first fretboard interaction, sound played, link shared, link opened, and instrument changed. Each event carries only the tool, the device class (phone, tablet, desktop), the language, and instrument traits (string count, preset tuning id or just "custom", handedness). Events never include an identifier for a person, device, or persistent session, a full shared-link address, or custom tuning content. Events are batched. Send failures are ignored silently and never slow or interrupt the interface. The About page says exactly what's measured.
>
> These events should support three targets: median time to first fretboard interaction of 15 seconds or less, at least 50% of sessions with at least one sound, and phone sessions with a fretboard interaction within 10 points of desktop. Under the same decision, record unexpected device-side failures (calculation, drawing, or audio errors, plus missing translations) anonymously, with the view state and instrument configuration needed to reproduce them. That includes failures behind the "Something went wrong in this view" fallback. Also monitor the delivery service for availability and response time.
>
> Acceptance: when a user opens Triads and taps a fret, a tool-opened event and a first-interaction event are sent with no identifier. When the measurement service is down, the app behaves the same and shows no error. When a Triads view throws while drawing, an anonymous report with the view state and instrument is recorded and the user sees the fallback. When a user shares a link, the event records "link shared" but never the link itself.

## Scope boundary

No individual profiles, cross-referencing with other sources, advertising use, or third-party sharing.

## Open questions

- Q-1: will anonymous measurement be adopted? If not, drop this file and measure M-5 to M-7 in usability tests only.
