# Contract: About privacy text (catalog and component)

**Feature**: `028-anonymous-measurement` | Implements FR-013, FR-016 (About ↔ wire check), SC-006

## 1. Catalog keys (en, pt-BR, es)

| Key | Change |
|---|---|
| `about_privacy_not_measured` | **Removed** from all three catalogs and from `PrivacyPolicy.svelte` |
| `about_privacy_measured` | **New**: the six events and four trait kinds (tool, device type, language, instrument: strings, tuning, handedness), sent to the app's own site |
| `about_privacy_errors` | **New**: anonymous error reports with view settings and instrument |
| `about_privacy_never` | **New**: never sent (identifiers, link addresses, custom tuning notes); nothing used for profiles, ads, cross-referencing or other companies |
| `about_privacy_dnt` | **New**: nothing sent with Do Not Track or Global Privacy Control on |
| `about_privacy_no_ads` | **Unchanged, byte-identical** ("no content from other companies" stays true) |
| `about_privacy_stored`, `_erase`, `_hosting`, `_share_links`, `_all_ages` | Tightened wording, same claims (word budget) |
| `about_privacy_no_data`, `_no_permissions` | Unchanged |

## 2. Order in `PrivacyPolicy.svelte`

`no_data`, `stored`, `erase`, `measured`, `errors`, `never`, `dnt`, `no_ads`, `no_permissions`,
`hosting`, `share_links`, `all_ages` — the measurement block replaces the old `not_measured`
position.

## 3. Limits (catalog unit test, unchanged caps)

- Sum of the twelve statements: ≤ 220 words (en), ≤ 280 (pt-BR, es).
- No jargon: en `data controller` `processing` `lawful basis`; pt-BR `controlador` `tratamento`
  `base legal`; es `responsable del tratamiento` `tratamiento` `base jurídica`.
- No third-party name (data goes only to the app's own site).

## 4. Worked English draft (220 words total; final wording may change within limits)

| Key | Text | Words |
|---|---|---|
| no_data | (unchanged) | 16 |
| stored | Your settings stay only in this browser on this device: language and notation; instrument; sound, volume and tempo; theme; labels and last tool; hints shown; and the shortcuts switch. No cookies are used. | 33 |
| erase | Clearing browser data, or Erase my preferences below, removes them. If storage is blocked, the app still works. | 18 |
| measured | The app sends anonymous counts to its own site: tool opened, first fretboard tap, sound played, link shared, link opened, instrument changed. Each carries only the tool, device type, language and instrument (strings, tuning, left-handed). | 35 |
| errors | If something breaks, an anonymous report with the view settings and instrument is sent. | 14 |
| never | Never sent: identifiers, link addresses or custom tuning notes. Nothing is used for profiles, ads, cross-referencing or other companies. | 18 |
| dnt | With Do Not Track or Global Privacy Control on, nothing is sent. | 12 |
| no_ads | (unchanged) | 12 |
| no_permissions | (unchanged) | 11 |
| hosting | The service delivering the app sees what any website sees, such as your IP address, only to deliver it. | 19 |
| share_links | A share link holds only view settings, no personal data, and goes only to whoever you send it to. | 19 |
| all_ages | It suits all ages: no contact between users and no content from users. | 13 |

## 5. About ↔ wire consistency test (`tests/unit/measure/about-matches-wire.test.ts`)

A per-locale term map in the test names, for each `EventType` and each trait kind
(`tool`, `device`, `lang`, `instrument`), the phrase that must appear in
`about_privacy_measured`. The test asserts:

1. `Object.keys(termMap.events)` equals `EVENT_TYPES` from `wire.ts`, and the trait kinds equal
   the event item's non-structural keys grouped as tool / device / lang / instrument
   (`strings`, `tuning`, `hand`).
2. Every phrase appears in that locale's `about_privacy_measured`.
3. `about_privacy_never` names identifiers, link addresses and custom tuning in each locale;
   `about_privacy_dnt` names both signals.

Adding an event to `wire.ts` without updating the About text fails this test.

## 6. Component test

`tests/unit/privacy-policy.test.ts` (jsdom) updated: renders twelve list items in §2 order, none
reading "Nothing is measured".
