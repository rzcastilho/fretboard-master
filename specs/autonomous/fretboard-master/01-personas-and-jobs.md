# 01 — Personas and jobs

No persona has an account or a profile in the system. All of them use the same application; what changes is where they enter and which controls they use.

## 1. Primary personas

### P-1 — Lia, the beginner

| | |
|---|---|
| **Who she is** | 19 years old, started playing four months ago with videos and a printed method book. 6-string guitar, standard tuning. |
| **Context of use** | Phone propped on the amplifier or the music stand, guitar on her lap. Sessions of 5 to 15 minutes. |
| **What she knows** | Open chords, the names of the open strings, some tablature. |
| **What blocks her** | When the method says "play a G on string 4", she counts fret by fret from the open string. Sharps and flats confuse her. |
| **What she wants** | To check quickly where a note is and hear whether it is right. |
| **Abandonment risk** | A screen full of information; untranslated theory terms; controls too small to use with a pick in her hand. |

### P-2 — Caio, who plays without theory

| | |
|---|---|
| **Who he is** | 34 years old, has played for 15 years in a bar band. Learned everything by ear and from tablature. Tunes a half step down and, for some songs, to Drop D. |
| **Context of use** | Desktop at home in the evening, sessions of 20 to 40 minutes; phone at rehearsal. |
| **What he knows** | Dozens of chords and licks, the minor pentatonic in one position. |
| **What blocks him** | He does not know why the shapes work. When the keyboard player says "it's just the A triad in first inversion", he has no answer. |
| **What he wants** | To name what he already plays: see which notes form the chord he is fretting and where the root, third, and fifth are. |
| **Abandonment risk** | A tool that only works in standard tuning; diagrams that do not match what he has under his fingers. |

### P-3 — Bruna, the stuck intermediate player

| | |
|---|---|
| **Who she is** | 27 years old, studied basic theory, improvises in one or two regions of the neck. Owns a 7-string guitar. She is left-handed. |
| **Context of use** | Tablet or desktop, planned study sessions of 30 to 60 minutes. |
| **What she knows** | Scale and chord construction on paper, the pentatonic in two positions, barre chords. |
| **What blocks her** | She does not connect the regions of the neck. She knows what a triad is but cannot find the inversions in real time. |
| **What she wants** | To see the same chord in the five shapes, understand how one shape links to the next, and see the triad and the scale inside each shape. |
| **Abandonment risk** | Right-handed diagrams she has to mirror in her head; no seventh string. |

## 2. Secondary persona

### P-4 — Marcos, the teacher

| | |
|---|---|
| **Who he is** | 45 years old, private teacher and music-school teacher. |
| **Context of use** | Desktop connected to a large screen in the classroom, or a video call with screen sharing. |
| **What he wants** | A clean visual board to show a concept in seconds, and a way to send the student exactly the view he showed in class. |
| **What he demands** | Theoretical correctness without exception — including note spelling. One enharmonic error makes him stop recommending the tool. |
| **Abandonment risk** | Theory errors; no way to send the student the same view; a cluttered interface that distracts in class. |

## 3. Edge users

| Id | User | Need the specification addresses |
|---|---|---|
| E-1 | Person with color blindness | The function of the note (root, third, fifth) is distinguishable by shape and label, not only by color (NFR-3.3) |
| E-2 | Person who navigates by keyboard only | The whole fretboard and every control are keyboard-operable (NFR-3.2) |
| E-3 | Person using a screen reader | Every view has an equivalent text description (NFR-3.4, FR-3.18) |
| E-4 | Person sensitive to motion | Animations respect the device's reduced-motion preference (NFR-3.6) |
| E-5 | User on a small phone (320 logical width) | No feature is lost; the fretboard scrolls horizontally (FR-3.12) |
| E-6 | User on a slow connection | Light initial load; once loaded, the application does not depend on the network to calculate or to play sounds (NFR-1) |
| E-7 | User in a quiet environment | Sound is optional and can be switched off persistently (FR-7.8) |
| E-8 | User with local storage blocked | The application works with defaults and states that preferences will not be remembered (edge case EC-9.1) |

## 4. Jobs-to-be-done

Priority: **A** = essential for version 1; **B** = important; **C** = desirable.

| Id | When… | I want to… | so that… | Personas | Prior. |
|---|---|---|---|---|---|
| J-1 | I need to locate a note | see every fret where it appears on the neck | I stop counting fret by fret | P-1, P-2 | A |
| J-2 | I look at any fret | know which note it is and hear it | I can check what I am playing | P-1 | A |
| J-3 | I want to memorize a region | limit the view to one string or one stretch of the neck | I study one piece at a time | P-1, P-3 | A |
| J-4 | I hear about a triad | see its three notes, each with its function, on a string set | I understand what the chord is made of | P-2, P-3 | A |
| J-5 | I know the root position | see the inversions side by side and along the neck | I find the triad closest to where my hand is | P-3 | A |
| J-6 | I compare major and minor (or diminished and augmented) | see exactly which note changes | I understand quality as an alteration, not as another shape to memorize | P-2, P-3, P-4 | A |
| J-7 | I know a chord in one region | see the five shapes of the same chord across the neck | I leave the position I am stuck in | P-3 | A |
| J-8 | I study a CAGED shape | see the triad, the arpeggio, the pentatonic, and the scale inside it | I link chord and melody in the same region | P-3 | A |
| J-9 | I move from one shape to its neighbor | see which notes the two share | I make the transition without getting lost | P-3, P-4 | A |
| J-10 | I use an alternate tuning, 7 strings, or play left-handed | have everything recalculated for my instrument | I do not translate diagrams in my head | P-2, P-3 | A |
| J-11 | I see a position on screen | hear how it sounds | I associate shape and sound | all | A |
| J-12 | I show something in class or to a friend | send a link that opens exactly that view | the other person sees what I see | P-4 | B |
| J-13 | I come back to the application another day | find my instrument, language, and notation as I left them | I do not reconfigure every time | all | A |
| J-14 | I open the application for the first time | choose which of the three studies to start with | I go straight to what interests me | all | A |
| J-15 | I read note names | choose between letter names and Do Re Mi, and between sharps and flats | I use the notation I know | P-1, P-4 | B |
