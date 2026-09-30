# 05 — Integrations

Version 1 is deliberately self-contained. There is no account service, payment service, external content service, or messaging service. The integrations below are the only boundaries with anything outside the application, described at a logical level.

| Id | External system | Direction | Required |
|---|---|---|---|
| INT-1 | Application delivery | Inbound | Yes |
| INT-2 | Anonymous usage measurement | Outbound | Conditional (Q-1) |
| INT-3 | Device audio output | Outbound | No (the application works in silence) |
| INT-4 | Browser local storage | Inbound and outbound | No (the application works with defaults) |
| INT-5 | Device sharing and clipboard | Outbound | No (a manual alternative exists) |
| INT-6 | Device preferences | Inbound | No |

---

## INT-1 — Application delivery

- **Purpose:** make the application and its content (interface, musical rules, texts in the three languages, sound material) available to the browser.
- **Data exchanged:** static content only, from the service to the browser. No user data travels in the opposite direction.
- **Frequency:** when the application opens and when a new version exists.
- **Failures:**
  - No connection at opening: the application does not load; the browser's standard message applies. Offline use is out of scope.
  - Connection lost after loading: the application keeps working in full, because every calculation and every sound is produced on the device (NFR-1.5).
  - Partial load: the application becomes interactive only when the essentials are loaded; missing secondary resources (for example, sound material) degrade to the behavior described in EC-7.1.

## INT-2 — Anonymous usage measurement (conditional)

- **Purpose:** measure metrics M-5 to M-7 from file 00 and guide the evolution of the product.
- **Data exchanged:** aggregable usage events (DM-18), from the browser to a measurement service. No identifiers of a person or device, no full addresses of shared links, no content of custom tunings.
- **Frequency:** per event, sent without blocking.
- **Failures:** any sending failure is ignored silently; measurement never delays or interrupts the interface.
- **Condition:** depends on the decision recorded in Q-1. If not adopted, DM-18 and this integration cease to exist and metrics M-5 to M-7 are measured only in user tests.
- **Related requirements:** NFR-5.3 and NFR-5.4.

## INT-3 — Device audio output

- **Purpose:** play notes, triads, arpeggios, and scales.
- **Data exchanged:** sound, from the application to the device.
- **Known restrictions:** browsers release sound only after a user gesture (FR-7.7); devices in silent mode can suppress sound without notifying the application (EC-7.2).
- **Failures:** if audio cannot start, the application keeps working in silence, with a single notice (EC-7.1).

## INT-4 — Browser local storage

- **Purpose:** remember the preferences (DM-14) without an account.
- **Data exchanged:** read at opening; write on every preference change.
- **Failures:** storage unavailable, full, or blocked → FR-9.5. Unreadable or old-format data → FR-9.6.
- **Note:** the data is specific to the browser and the device. Clearing the browser data erases the preferences; this is expected and is stated on the "About" page.

## INT-5 — Sharing and clipboard

- **Purpose:** hand the state link (DM-17) to another app or to the clipboard.
- **Data exchanged:** an address and, when the mechanism accepts it, a short title describing the view ("A minor — CAGED, E shape").
- **Failures:** mechanism unavailable or declined by the user → the link is shown in a selectable field (EC-10.3).

## INT-6 — Device preferences

- **Purpose:** adopt defaults consistent with the device on the first visit.
- **Data read:** preferred language (FR-8.2), light or dark theme (FR-1.9), reduced-motion preference (NFR-3.6), increased-contrast preference (NFR-3.7).
- **Failures:** information absent → defaults: English, light theme, normal motion.

---

## Integrations explicitly absent

| What does not exist | Why |
|---|---|
| Identity and account service | No login (C-2) |
| Synchronization across devices | Depends on an account |
| Audio capture from the microphone | Out of scope |
| Payment and advertising services | No monetization |
| Social networks | Sharing uses a generic link |
| Third-party content (videos, scores, songs) | Out of scope |
