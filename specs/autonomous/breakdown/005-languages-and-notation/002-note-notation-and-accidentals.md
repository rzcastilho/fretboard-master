# 005-languages-and-notation / 002 — Letters or Solfège, Sharps or Flats

**Source:** [§ Area 8 — Language and notation](../../fretboard-master/03-functional-requirements.md#area-8--language-and-notation), [§ Area 4 — Fretboard Notes tool](../../fretboard-master/03-functional-requirements.md#area-4--fretboard-notes-tool), [§ Edge cases, Area 8](../../fretboard-master/08-edge-cases-and-error-handling.md#area-8--language-and-notation), [§ 3.4 Typography](../../fretboard-master/12-design-and-experience.md#34-typography), [§ NFR-3 Accessibility](../../fretboard-master/06-non-functional-requirements.md#nfr-3--accessibility), [§ 2. Assumptions](../../fretboard-master/09-assumptions-and-open-questions.md#2-assumptions)

**Prerequisites:** Assumes 005-languages-and-notation/001-three-languages.

## Prompt

> Lia learned Do Re Mi at school, Marcos teaches with letters, and sharps and flats confuse beginners. Note names should match what each person knows. Add a note-name notation setting: **letters** (C D E F G A B) or **solfège**. Solfège is "Dó Ré Mi Fá Sol Lá Si" in Portuguese and "Do Re Mi Fa Sol La Si" in Spanish and English (fixed do, with Si). Notation doesn't depend on language, and any combination works. The default is letters in English and Portuguese and solfège in Spanish. It can be changed in the language panel or with a quick toggle in each tool's application bar. The change is instant and reaches labels, note selectors, the composition panel, tuning and string names, and text descriptions.
>
> Add an accidental preference for single notes (the Notes tool and string names): sharps (default), flats, or both. With "both", markers show both spellings when they fit and the sharp spelling when they don't, with both on the position card. In Triads and CAGED, theory decides spelling and this preference doesn't apply. Preset tunings keep their own string spelling (Half step down always shows E♭). Accidentals always use real symbols, ♯ ♭ 𝄪 𝄫, never "#" or "b", in every language and notation. They're drawn with the same weight and alignment as the letters. Labels that don't fit ("Sol♯", double accidentals) shrink to a legible minimum, then abbreviate, with the full name on the card or hint. Screen readers read accidentals in full ("F sharp", "Fá sustenido"). CAGED shapes keep their letter names in solfège. The first time CAGED opens in solfège, a one-time note explains "The shapes are named after the open chords C (Do), A (La), G (Sol), E (Mi), and D (Re)". Notation and accidental choices are stored as preferences.
>
> Acceptance: when a first-time Spanish user opens Notes, the naturals read Do Re Mi Fa Sol La Si. When a user picks flats, the Notes selector and markers show D♭ E♭ G♭ A♭ B♭, while a Triads A major still reads A–C♯–E. When a user in solfège opens CAGED for the first time, tags still read "E shape" and the explanation shows once. When a screen reader reaches F♯, it hears "F sharp", not "F hash".

## Scope boundary

Only fixed-do solfège. No movable do, "Ti", or German H/B naming (open question Q-14).

## Open questions

- Q-8: do the per-language notation defaults match real usage? To be validated with three to five guitarists per language.
