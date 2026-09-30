# 09 — Assumptions and open questions

## 1. Decisions confirmed in the interview

| Subject | Decision |
|---|---|
| Audience | Guitarists of every level |
| Focus of version 1 | Tooling: three interactive tools, with no lessons, exercises, text tips, or gamification |
| Access | Free, no login |
| Persistence | Preferences only, stored on the device |
| Triads | Major, minor, diminished, and augmented, with inversions on every string set |
| CAGED | Major and minor shapes, connections, triads, arpeggios, pentatonic, and scale |
| Instrument | 6 and 7 strings, right-handed and left-handed, alternate tunings |
| Audio | Notes and triads can be heard |
| Languages | English, Portuguese, and Spanish, with switchable notation |
| Devices | Phone and desktop with the same priority |
| Connectivity | Always online |

## 2. Assumptions

Decisions made during drafting, without confirmation. Each one can be reversed; the "If it changes" column states what is affected.

| Id | Assumption | Where it appears | If it changes |
|---|---|---|---|
| A-1 | "Fretboard Master" is a working name | Every file | Text only |
| A-2 | Without lessons or tips, the requested "teaching focus" is realized in the design of the tools: one concept at a time, a fixed identity for root/third/fifth, correct spelling, side-by-side comparison | 00 §4, FR-3.8, FR-5.7, FR-5.11 | If teacher text returns to scope, it enters as a new functional area on top of the view state (NFR-10.3) |
| A-3 | The default is 22 frets, adjustable from 12 to 24 | FR-2.8 | The default value only |
| A-4 | The musical state of the tools is not remembered between visits; only the preferences and the last tool are | FR-9.2, FR-1.4 | Would add items to DM-14 |
| A-5 | Default notation: letters in English and Portuguese; solfège (Do Re Mi) in Spanish | FR-8.4 | The default values only |
| A-6 | In English, the solfège notation uses Do Re Mi Fa Sol La Si (fixed do, with Si) | FR-8.4 | Text only |
| A-7 | Custom tuning limited to −7/+4 semitones per string relative to standard | FR-2.5 | The limits only |
| A-8 | CAGED is offered only in tunings that preserve the standard intervals on strings 5 to 1; in the others, the tool explains and offers alternatives instead of inventing shapes | FR-2.12, FR-6.14, TM-8 | See Q-5 |
| A-9 | The fretboard has slightly decreasing fret spacing, not real proportion, to preserve the touch area on the high frets | FR-3.6 | Presentation only |
| A-10 | There is no free zoom on the fretboard; there are two modes (whole and comfortable) | FR-3.14, EC-3.5 | Presentation only |
| A-11 | The Triad, Pentatonic, and Scale layers require a shape in focus | FR-6.12 | Affects FR-6.8 to FR-6.12 |
| A-12 | Reference phone: mid-range, about four years old, median mobile network | NFR-1 | Performance targets |
| A-13 | Printing or capturing a view with a legible result is a requirement | NFR-2.7 | Can be removed without impact |
| A-14 | Availability target of 99.5% per month | NFR-7.1 | The target only |
| A-15 | Tens of thousands of monthly users in the first year | NFR-7.3 | Delivery sizing only |
| A-16 | The Scale layer covers only the major and natural minor scales; the Pentatonic layer, only major and minor | FR-6.8 | New scales extend DM-12 |
| A-17 | Triads are always in close position, on three adjacent strings; open-voiced triads are out | FR-5.6 | A new view in Triads |
| A-18 | The root is labeled "R" in English and "T" in Portuguese and Spanish | FR-8.8 | Text only |
| A-19 | Sharing by link is part of the tooling, although not explicitly requested; it serves classroom use | Area 10 | Can be removed; FR-10.6 ceases to exist |
| A-20 | There is a light theme and a dark theme, following the device | FR-1.9 | Presentation only |
| A-21 | Default string orientation: highest on top, as in tablature | FR-2.7 | The default value only |
| A-22 | The specification is written in English; the interface texts quoted are English examples, to be translated into Portuguese and Spanish | Every file | — |
| A-23 | With 7 strings, the CAGED chord shapes stay on the six higher strings and only the melodic layers use the seventh | FR-6.13 | Affects TM-6.7 |
| A-24 | Context carry-over between tools is automatic | FR-1.6 | Can become optional |

## 3. Open questions

| Id | Question | Why it matters | Suggestion |
|---|---|---|---|
| Q-1 | Will there be anonymous usage measurement? | Without it, metrics M-5 to M-7 can be measured only in user tests; with it, the "About" page must describe it and a notice may be required, depending on the applicable law | Adopt minimal measurement, without identifiers, and review it with legal support |
| Q-2 | What is the final product name? Is it the same in the three languages? | Identity, address, and texts | Decide before visual design |
| Q-3 | Who maintains the product and what funds it? | With no revenue and no accounts, the cost is low but not zero (delivery, maintenance, language review) | Record the owner and the annual budget |
| Q-4 | Is the sound synthesized or recorded from a real instrument? | Recorded sounds better but increases the volume transferred (NFR-1.7) and must cover A1 to E6; synthesized is light and covers any tuning | Decide in the technical design phase, with a listening test by guitarists |
| Q-5 | Should CAGED have its own treatment for open tunings in a future version? | Today the tool is declined in those tunings (A-8) | Keep it out of version 1 |
| Q-6 | Will there be capo support? | It changes the reference of "fret 0" and the open chords; a frequent request from acoustic players | Evaluate for the next version |
| Q-7 | What is the next stage after the tooling: lessons, exercises, progress, accounts? | It defines how much to invest now in the extension points (NFR-10.3) | Define the order before technical design |
| Q-8 | Do the notation defaults per language (A-5, A-6) match real usage? | A wrong default drives the beginner away in the first minute | Validate with three to five guitarists of each language |
| Q-9 | Are 8-string guitars and other fretted string instruments on the horizon? | The theory engine is generic; the cost is in drawing and testing | Record as a possible evolution |
| Q-10 | Does the term "CAGED" need explaining for an audience that has never heard it? | The home-screen card uses the question "How does the whole neck connect?", but the name may mean nothing to a beginner | Test the card label in usability sessions |
| Q-11 | Is a privacy notice or consent required in the target countries, even without personal data? | Storing preferences on the device can require informing the user in some jurisdictions | Legal review before launch |
| Q-12 | Who are the two reviewing teachers (M-4) and the native reviewers for Portuguese and Spanish (NFR-4.2)? | Without them, NFR-9.5 and NFR-4.2 are not met | Name them before testing starts |
| Q-13 | Should the Cm shape and the Gm shape be presented with the same emphasis as the other three minor shapes? | Some teachers teach them only as scale regions, not as chords | Decide with the reviewing teachers |
| Q-14 | Are "Si" versus "Ti" for the seventh degree in English, and "H/B" for German-speaking audiences, relevant? | Only if languages expand | Out of version 1 |

## 4. Deferred items, with a trigger for return

| Item | Trigger for returning to scope |
|---|---|
| Teacher's teaching tips | Usability tests show that beginners do not understand the tools without text |
| Exercises and quizzes | Decision on Q-7 |
| Accounts, synchronization, and progress | Introduction of exercises, or recurring requests to use more than one device |
| Gamification | Only after progress is recorded |
| Microphone | After exercises |
| Offline use | Frequent use in places without a network (rehearsal rooms, schools) |
| Seventh chords, modes, other scales | Completion of version 1 with M-1 to M-4 met |
