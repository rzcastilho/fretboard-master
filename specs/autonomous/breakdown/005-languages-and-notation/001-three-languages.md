# 005-languages-and-notation / 001 — English, Portuguese, and Spanish

**Source:** [§ Area 8 — Language and notation](../../fretboard-master/03-functional-requirements.md#area-8--language-and-notation), [§ NFR-4 Internationalization](../../fretboard-master/06-non-functional-requirements.md#nfr-4--internationalization), [§ Edge cases, Area 8](../../fretboard-master/08-edge-cases-and-error-handling.md#area-8--language-and-notation), [§ UJ-6 Adjust language and notation](../../fretboard-master/02-user-journeys.md#uj-6--adjust-language-and-notation), [§ DM-16 Text catalog](../../fretboard-master/04-data-model.md#dm-16--text-catalog), [§ ARCH-9 Texts and notation](../../fretboard-master/07-architecture-overview.md#arch-9--texts-and-notation), [§ 4. Term equivalence in the three languages](../../fretboard-master/10-glossary.md#4-term-equivalence-in-the-three-languages), [§ INT-6 Device preferences](../../fretboard-master/05-integrations.md#int-6--device-preferences), [§ 2. Voice and texts](../../fretboard-master/12-design-and-experience.md#2-voice-and-texts)

**Prerequisites:** Assumes every tool from waves 001–004 and preference storage from 003-your-instrument/002-remembered-preferences.

## Prompt

> The audience is spread across Latin America, the Iberian Peninsula, and English-speaking countries, and a beginner quits at the first untranslated theory term. Every screen should speak the guitarist's language, in the words guitarists there actually use. Add full interface coverage in English, Portuguese (Brazil), and Spanish. On first visit, the app uses the device language if it's supported. Regional variants map to their base language, so European Portuguese gets Portuguese and any Spanish or English variant gets Spanish or English. Anything else gets English. A language selector sits on the home screen and in a language panel reachable from every tool. Switching is instant, doesn't reload the page, keeps every tool's state, and is stored as a preference.
>
> Every text is translated: controls, card questions, composition panel, tuning names, notices, empty states, and screen-reader descriptions. Established English tuning names ("Drop D", "DADGAD") and CAGED shape letters stay as they are. No screen mixes languages. Musical terms follow a trilingual glossary, reviewed by a native-speaking musician for each language. Interval labels are the same everywhere (♭3, 3, 5, ♭5, ♯5), except the root: "R" in English, "T" in Portuguese and Spanish. The layout handles text length differences with no truncation or overlap, including at 320 logical width and at 200% browser text size. The voice stays that of a calm, experienced teacher, with no notice longer than two lines. The text structure should let a fourth language be added without touching musical rules or behavior.
>
> Acceptance: when a device set to pt-PT opens the app for the first time, the interface is in Portuguese. A device set to French gets English. When a user switches from English to Spanish mid-comparison in Triads, the comparison stays on screen with all text in Spanish and root labels shown as "T". When a text is missing in one language because of a content error, the English text shows in that spot and the gap is logged.

## Scope boundary

Note-name notation and accidental preference are covered in 005-languages-and-notation/002.

## Open questions

- Q-12: who are the native-speaking reviewers for Portuguese and Spanish?
- Q-2: is the final product name the same in all three languages?
