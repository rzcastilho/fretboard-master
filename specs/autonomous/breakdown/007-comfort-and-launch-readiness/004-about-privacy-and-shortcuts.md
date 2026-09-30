# 007-comfort-and-launch-readiness / 004 — About Page, Privacy, and Keyboard Shortcuts

**Source:** [§ Area 1 — Structure and navigation](../../fretboard-master/03-functional-requirements.md#area-1--structure-and-navigation), [§ 5.4 Desktop](../../fretboard-master/12-design-and-experience.md#54-desktop), [§ NFR-5 Privacy and compliance](../../fretboard-master/06-non-functional-requirements.md#nfr-5--privacy-and-compliance), [§ NFR-6 Security](../../fretboard-master/06-non-functional-requirements.md#nfr-6--security), [§ NFR-8 Observability](../../fretboard-master/06-non-functional-requirements.md#nfr-8--observability), [§ Integrations explicitly absent](../../fretboard-master/05-integrations.md#integrations-explicitly-absent)

**Prerequisites:** Assumes 003-your-instrument/002-remembered-preferences and translated texts from 005-languages-and-notation/001.

## Prompt

> Before public launch, users and parents should be able to see in plain words what the app does and doesn't do with their data, and desktop users should have shortcuts for their most common actions. Complete the About page in all three languages. It gets a few lines on what the app is, the marker legend (root, third, fifth), the keyboard shortcuts list, the app version, and a plain-language privacy policy. The policy says no personal data is collected, what's stored on this device only (the preference list), that clearing browser data erases it, and what, if anything, is measured anonymously. **Erase my preferences** stays on this page.
>
> Add keyboard shortcuts for the frequent actions: play or Listen, next and previous (shape in CAGED, inversion in Triads), switch label type, and switch notation. They must never clash with screen-reader or browser shortcuts. Lock in the privacy and security posture across the app. There's no sign-up, email, name, or user identifier anywhere. There's no advertising and no third-party content that tracks users. No executable content loads from origins other than the app's own delivery (except anonymous measurement, if adopted). The app asks for no device permissions: no microphone, camera, location, or notifications. It's suitable for minors, since there's no user interaction, no user-generated content, and no data collection. The design must comply with the Brazilian and European data-protection laws for this audience.
>
> Acceptance: when a user opens About in Spanish, they see the legend, the shortcut list, the version, and the privacy text in Spanish. When a desktop user presses the play shortcut in Triads, the current shape plays, and the next shortcut moves to the next inversion. When the app runs in a fresh browser profile, it triggers no permission prompts and makes no requests to third-party origins (aside from measurement, if Q-1 adopts it).

## Scope boundary

No cookie banner or consent flow unless the legal review (Q-11) requires one.

## Open questions

- Q-11: is a privacy notice or consent needed in the target countries even without personal data?
- Q-2: what is the final product name?
- Q-3: who maintains and funds the product?
