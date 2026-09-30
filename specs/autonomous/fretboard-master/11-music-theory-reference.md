# 11 — Music theory reference

This file defines the musical rules the tools implement and provides **reference tables** against which the result is checked (NFR-9.2). It is the source of truth for any theory question.

Conventions of this file:

- Notes appear as letter names (C D E F G A B). The application displays them in the notation the user chose.
- Strings are numbered from 1 (highest) to 6 or 7 (lowest). Fret sequences are written **from the lowest string to the highest**; "x" is a string not played; 0 is an open string.
- Degrees and intervals: R (root), 2, ♭3, 3, 4, ♭5, 5, ♯5, ♭6, 6, ♭7, 7.
- The fret tables hold for **standard tuning**. In other tunings, the same rules calculate the values.
- Every table in this file was generated and checked by calculation.

| Section | Content |
|---|---|
| TM-1 | Notes, pitches, and octaves |
| TM-2 | Tunings |
| TM-3 | Notes on the fretboard |
| TM-4 | Triad spelling |
| TM-5 | Triad shapes |
| TM-6 | CAGED — major shapes |
| TM-7 | CAGED — minor shapes |
| TM-8 | CAGED and tunings |
| TM-9 | Sample for teacher review |

---

## TM-1 — Notes, pitches, and octaves

**TM-1.1** There are twelve pitch classes, in chromatic order: C, C♯/D♭, D, D♯/E♭, E, F, F♯/G♭, G, G♯/A♭, A, A♯/B♭, B. There is no note between E–F or between B–C.

**TM-1.2** Each fret raises the pitch of the string by one semitone. The pitch of a position is the pitch of the open string plus the fret number, in semitones. Fret 12 sounds one octave above the open string.

**TM-1.3** Octaves are numbered by the real pitch (the guitar sounds one octave below what is written on the staff; the application uses the sounding pitch). The octave changes at C: …A2, B2, C3, D3… In standard tuning, the open string 6 is E2 and the open string 1 is E4; middle C (C4) is on string 2, fret 1.

**TM-1.4** Unison: two positions with the same pitch. In standard tuning, the same pitch repeats on the next lower string five frets further up (four frets between strings 2 and 3).

---

## TM-2 — Tunings

Open-string pitches, from lowest to highest.

| Id | Name | Pitches |
|---|---|---|
| AF-1 | Standard | E2 A2 D3 G3 B3 E4 |
| AF-2 | Half step down | E♭2 A♭2 D♭3 G♭3 B♭3 E♭4 |
| AF-3 | Whole step down | D2 G2 C3 F3 A3 D4 |
| AF-4 | Drop D | D2 A2 D3 G3 B3 E4 |
| AF-5 | Drop C | C2 G2 C3 F3 A3 D4 |
| AF-6 | Double Drop D | D2 A2 D3 G3 B3 D4 |
| AF-7 | DADGAD | D2 A2 D3 G3 A3 D4 |
| AF-8 | Open G | D2 G2 D3 G3 B3 D4 |
| AF-9 | Open D | D2 A2 D3 F♯3 A3 D4 |
| AF-10 | Open E | E2 B2 E3 G♯3 B3 E4 |
| AF-11 | Open A | E2 A2 E3 A3 C♯4 E4 |
| AF-21 | 7-string standard | B1 E2 A2 D3 G3 B3 E4 |
| AF-22 | 7-string half step down | B♭1 E♭2 A♭2 D♭3 G♭3 B♭3 E♭4 |
| AF-23 | Drop A | A1 E2 A2 D3 G3 B3 E4 |

The spelling of the string names in preset tunings is the one in this table (for example, AF-2 uses flats; AF-9 uses F♯), regardless of the accidental preference. In custom tunings the preference applies (FR-8.6).

Intervals between neighboring strings in standard tuning, from low to high: a perfect fourth (5 semitones) between all of them, except between strings 3 and 2, which is a major third (4 semitones). The seventh string sits a perfect fourth below the sixth.

---

## TM-3 — Notes on the fretboard

A reference for 6-string standard tuning, frets 0 to 12, with sharps. From fret 13 onward the pattern repeats (fret 13 = fret 1, one octave higher).

| String | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | E | F | F♯ | G | G♯ | A | A♯ | B | C | C♯ | D | D♯ | E |
| 2 | B | C | C♯ | D | D♯ | E | F | F♯ | G | G♯ | A | A♯ | B |
| 3 | G | G♯ | A | A♯ | B | C | C♯ | D | D♯ | E | F | F♯ | G |
| 4 | D | D♯ | E | F | F♯ | G | G♯ | A | A♯ | B | C | C♯ | D |
| 5 | A | A♯ | B | C | C♯ | D | D♯ | E | F | F♯ | G | G♯ | A |
| 6 | E | F | F♯ | G | G♯ | A | A♯ | B | C | C♯ | D | D♯ | E |

The seventh string (B1 in AF-21) has the same notes as string 2, two octaves lower.

---

## TM-4 — Triad spelling

**TM-4.1 Rule.** A triad is built from stacked thirds, so its notes occupy **alternate letters**: root on letter X, third two letters above, fifth four letters above (C–E–G, D–F–A, E–G–B…). Once the letters are set, the accidental of each note is the one needed to reach the exact interval:

| Quality | Third | Fifth |
|---|---|---|
| Major | 4 semitones above the root | 7 semitones |
| Minor | 3 semitones | 7 semitones |
| Diminished | 3 semitones | 6 semitones |
| Augmented | 4 semitones | 8 semitones |

Consequence: the spelling can require a double sharp (𝄪) or a double flat (𝄫), and notes such as E♯, B♯, C♭, and F♭. The application displays them (EC-5.6).

**TM-4.2 Reference table.**

| Root | Major | Minor | Diminished | Augmented |
|---|---|---|---|---|
| C | C–E–G | C–E♭–G | C–E♭–G♭ | C–E–G♯ |
| C♯ | C♯–E♯–G♯ | C♯–E–G♯ | C♯–E–G | C♯–E♯–G𝄪 |
| D♭ | D♭–F–A♭ | D♭–F♭–A♭ | D♭–F♭–A𝄫 | D♭–F–A |
| D | D–F♯–A | D–F–A | D–F–A♭ | D–F♯–A♯ |
| D♯ | D♯–F𝄪–A♯ | D♯–F♯–A♯ | D♯–F♯–A | D♯–F𝄪–A𝄪 |
| E♭ | E♭–G–B♭ | E♭–G♭–B♭ | E♭–G♭–B𝄫 | E♭–G–B |
| E | E–G♯–B | E–G–B | E–G–B♭ | E–G♯–B♯ |
| F | F–A–C | F–A♭–C | F–A♭–C♭ | F–A–C♯ |
| F♯ | F♯–A♯–C♯ | F♯–A–C♯ | F♯–A–C | F♯–A♯–C𝄪 |
| G♭ | G♭–B♭–D♭ | G♭–B𝄫–D♭ | G♭–B𝄫–D𝄫 | G♭–B♭–D |
| G | G–B–D | G–B♭–D | G–B♭–D♭ | G–B–D♯ |
| G♯ | G♯–B♯–D♯ | G♯–B–D♯ | G♯–B–D | G♯–B♯–D𝄪 |
| A♭ | A♭–C–E♭ | A♭–C♭–E♭ | A♭–C♭–E𝄫 | A♭–C–E |
| A | A–C♯–E | A–C–E | A–C–E♭ | A–C♯–E♯ |
| A♯ | A♯–C𝄪–E♯ | A♯–C♯–E♯ | A♯–C♯–E | A♯–C𝄪–E𝄪 |
| B♭ | B♭–D–F | B♭–D♭–F | B♭–D♭–F♭ | B♭–D–F♯ |
| B | B–D♯–F♯ | B–D–F♯ | B–D–F | B–D♯–F𝄪 |

**TM-4.3 Default spelling of an altered root.** For each quality, the application adopts the spelling with fewer accidentals (a double counts as two). The user can switch (FR-5.3).

| Key | Major | Minor | Diminished | Augmented |
|---|---|---|---|---|
| C♯ / D♭ | D♭ | C♯ | C♯ | D♭ |
| D♯ / E♭ | E♭ | E♭ * | D♯ | E♭ |
| F♯ / G♭ | F♯ * | F♯ | F♯ | G♭ |
| G♯ / A♭ | A♭ | G♯ | G♯ | A♭ |
| A♯ / B♭ | B♭ | B♭ | A♯ | B♭ |

\* A tie in the number of accidentals, resolved by the most common usage among guitarists.

**TM-4.4 Augmented triad.** It divides the octave into three equal parts. C–E–G♯, E–G♯–B♯, and A♭–C–E sound with the same three pitches; only the spelling and the root change.

**TM-4.5 Triad detection (FR-4.10).** Three distinct pitch classes form a supported triad when, taking one of them as the root, the other two lie at (4, 7), (3, 7), (3, 6), or (4, 8) semitones. In the first three cases the root is unique.

---

## TM-5 — Triad shapes

**TM-5.1 Close position.** The three notes fit within one octave and lie on three adjacent strings, one per string, in ascending order of pitch.

**TM-5.2 Order of the notes per inversion**, from low to high:

| Inversion | Low string | Middle string | High string |
|---|---|---|---|
| Root position | root | third | fifth |
| 1st inversion | third | fifth | root |
| 2nd inversion | fifth | root | third |

**TM-5.3 Calculating the shape**, for any tuning:

1. On the lowest string of the set, locate the fret closest to the nut (from 0 to 11) that holds the bass note of the inversion.
2. The note on the middle string is the next triad note **above** the bass; its fret is the difference, in semitones, between that pitch and the open middle string.
3. The note on the high string is the next triad note above the previous one; its fret is calculated the same way.
4. If any fret comes out negative, raise the bass by one octave (12 frets) and recalculate.
5. The shape fits on the fretboard if no fret exceeds the fret count. Other occurrences lie 12 frets higher.

**TM-5.4 Span.** The difference between the highest and the lowest fretted fret (open strings do not count). From 5 upward, the shape receives the "wide stretch" mark.

**TM-5.5 Reference table — root C, standard tuning.** The lowest occurrence of each shape; frets from the lowest string of the set to the highest.

| Quality | Inversion | 6-5-4 | 5-4-3 | 4-3-2 | 3-2-1 |
|---|---|---|---|---|---|
| Major | Root position | 8-7-5 | 3-2-0 | 10-9-8 | 5-5-3 |
| Major | 1st | 12-10-10 | 7-5-5 | 2-0-1 | 9-8-8 |
| Major | 2nd | 3-3-2 | 10-10-9 | 5-5-5 | 0-1-0 |
| Minor | Root position | 8-6-5 | 3-1-0 | 10-8-8 | 5-4-3 |
| Minor | 1st | 11-10-10 | 6-5-5 | 1-0-1 | 8-8-8 |
| Minor | 2nd | 3-3-1 | 10-10-8 | 5-5-4 | 12-13-11 |
| Diminished | Root position | 8-6-4 | 15-13-11 | 10-8-7 | 5-4-2 |
| Diminished | 1st | 11-9-10 | 6-4-5 | 13-11-13 | 8-7-8 |
| Diminished | 2nd | 2-3-1 | 9-10-8 | 4-5-4 | 11-13-11 |
| Augmented | Root position | 8-7-6 | 3-2-1 | 10-9-9 | 5-5-4 |
| Augmented | 1st | 12-11-10 | 7-6-5 | 2-1-1 | 9-9-8 |
| Augmented | 2nd | 4-3-2 | 11-10-9 | 6-5-5 | 1-1-0 |

Set 7-6-5 (tuning AF-21), root C:

| Quality | Root position | 1st | 2nd |
|---|---|---|---|
| Major | 13-12-10 | 5-3-3 | 8-8-7 |
| Minor | 13-11-10 | 4-3-3 | 8-8-6 |
| Diminished | 13-11-9 | 4-2-3 | 7-8-6 |
| Augmented | 13-12-11 | 5-4-3 | 9-8-7 |

The other roots result from transposing these shapes, respecting the lowest-occurrence rule (TM-5.3, steps 1 and 4).

**TM-5.6 Teaching observations the views must make evident.**

- Sets 6-5-4 and 5-4-3 have the same shapes, because the intervals between the strings are equal. Sets 4-3-2 and 3-2-1 have different shapes because of the major third between strings 3 and 2.
- From major to minor, only the third drops one fret. From minor to diminished, only the fifth drops one fret. From major to augmented, only the fifth rises one fret.
- The three inversions, linked on the same string set, cover the neck in sequence: root position → 1st → 2nd → root position (one octave higher).
- In the augmented triad, the three inversions have the same drawing, shifted four frets.

**TM-5.7 Example in another tuning.** In Drop D (AF-4), C major in root position on set 6-5-4 comes out as 10-7-5: span 5, marked "wide stretch". In standard tuning, the same triad is 8-7-5.

---

## TM-6 — CAGED: major shapes

**TM-6.1 The five shapes.** Each shape is named after the open chord it derives from. Reference in the key of **C major**, standard tuning.

| Shape | Frets (string 6 → 1) | Degrees (string 6 → 1) | Strings with a root | Source open chord |
|---|---|---|---|---|
| C | x 3 2 0 1 0 | x R 3 5 R 3 | 5, 2 | C: x 3 2 0 1 0 |
| A | x 3 5 5 5 3 | x R 5 R 3 5 | 5, 3 | A: x 0 2 2 2 0 |
| G | 8 7 5 5 5 8 | R 3 5 R 3 R | 6, 3, 1 | G: 3 2 0 0 0 3 |
| E | 8 10 10 9 8 8 | R 5 R 3 5 R | 6, 4, 1 | E: 0 2 2 1 0 0 |
| D | x x 10 12 13 12 | x x R 5 R 3 | 4, 2 | D: x x 0 2 3 2 |

For another key, every fret shifts by the number of semitones between C and that key.

**TM-6.2 Order along the neck.** Always C → A → G → E → D → C…, toward the body. The first shape of each key is the one that fits closest to the nut. In parentheses, the lowest fret of the chord of each shape.

| Key | Sequence from the nut |
|---|---|
| C | C (0) → A (3) → G (5) → E (8) → D (10) |
| D♭ | C (1) → A (4) → G (6) → E (9) → D (11) |
| D | D (0) → C (2) → A (5) → G (7) → E (10) |
| E♭ | D (1) → C (3) → A (6) → G (8) → E (11) |
| E | E (0) → D (2) → C (4) → A (7) → G (9) |
| F | E (1) → D (3) → C (5) → A (8) → G (10) |
| F♯ | E (2) → D (4) → C (6) → A (9) → G (11) |
| G | G (0) → E (3) → D (5) → C (7) → A (10) |
| A♭ | G (1) → E (4) → D (6) → C (8) → A (11) |
| A | A (0) → G (2) → E (5) → D (7) → C (9) |
| B♭ | A (1) → G (3) → E (6) → D (8) → C (10) |
| B | A (2) → G (4) → E (7) → D (9) → C (11) |

After the fifth shape, the cycle restarts 12 frets higher, for as long as there are frets. The same table holds for the minor keys (TM-7).

**TM-6.3 Connections.** Chord notes shared by neighboring shapes, in C major:

| Shapes | Shared positions (string, fret) | Degrees |
|---|---|---|
| C → A | string 5, fret 3 | R |
| A → G | string 4, fret 5 · string 3, fret 5 · string 2, fret 5 | 5, R, 3 |
| G → E | string 6, fret 8 · string 1, fret 8 | R, R |
| E → D | string 4, fret 10 | R |
| D → C | string 3, fret 12 · string 2, fret 13 · string 1, fret 12 | 5, R, 3 |

Every shape shares at least one root or a block of three notes with its neighbor: that is the anchor for changing region.

**TM-6.4 Major scale and arpeggio in each shape.** Frets of the C major scale in each region, with the degree in parentheses. The notes of degree R, 3, and 5 form the **Arpeggio** layer; the chord notes (TM-6.1) are a subset of them.

| Shape | String 6 | String 5 | String 4 | String 3 | String 2 | String 1 |
|---|---|---|---|---|---|---|
| C | 0(3) 1(4) 3(5) | 0(6) 2(7) 3(R) | 0(2) 2(3) 3(4) | 0(5) 2(6) | 0(7) 1(R) 3(2) | 0(3) 1(4) 3(5) |
| A | 3(5) 5(6) | 2(7) 3(R) 5(2) | 2(3) 3(4) 5(5) | 2(6) 4(7) 5(R) | 3(2) 5(3) 6(4) | 3(5) 5(6) |
| G | 5(6) 7(7) 8(R) | 5(2) 7(3) 8(4) | 5(5) 7(6) | 4(7) 5(R) 7(2) | 5(3) 6(4) 8(5) | 5(6) 7(7) 8(R) |
| E | 7(7) 8(R) 10(2) | 7(3) 8(4) 10(5) | 7(6) 9(7) 10(R) | 7(2) 9(3) 10(4) | 8(5) 10(6) | 7(7) 8(R) 10(2) |
| D | 10(2) 12(3) 13(4) | 10(5) 12(6) | 9(7) 10(R) 12(2) | 9(3) 10(4) 12(5) | 10(6) 12(7) 13(R) | 10(2) 12(3) 13(4) |

Properties of each pattern: it covers the six strings and contains every scale note between its lowest and its highest note, without gaps or repetitions, with two or three notes per string.

**TM-6.5 Major pentatonic in each shape** (degrees R, 2, 3, 5, 6): the scale pattern without the 4th and 7th degrees. In C:

| Shape | String 6 | String 5 | String 4 | String 3 | String 2 | String 1 |
|---|---|---|---|---|---|---|
| C | 0 3 | 0 3 | 0 2 | 0 2 | 1 3 | 0 3 |
| A | 3 5 | 3 5 | 2 5 | 2 5 | 3 5 | 3 5 |
| G | 5 8 | 5 7 | 5 7 | 5 7 | 5 8 | 5 8 |
| E | 8 10 | 7 10 | 7 10 | 7 9 | 8 10 | 8 10 |
| D | 10 12 | 10 12 | 10 12 | 9 12 | 10 13 | 10 12 |

**TM-6.6 Region of a shape.** The region is the range of frets occupied by the scale pattern (TM-6.4). In a key where part of the region would fall below the nut, the notes below fret 0 are omitted in that occurrence; the shape is drawn if the chord fits (FR-6.4).

**TM-6.7 Seventh string.** In AF-21 and AF-22, the seventh string receives, in each region, the same frets as string 2 (same notes, two octaves lower).

---

## TM-7 — CAGED: minor shapes

**TM-7.1 The five shapes.** Reference in the key of **C minor**, standard tuning. The roots lie on the same strings as in the corresponding major shapes.

| Shape | Frets (string 6 → 1) | Degrees (string 6 → 1) | Strings with a root | Source open chord |
|---|---|---|---|---|
| Cm | x 3 1 0 1 x | x R ♭3 5 R x | 5, 2 | — (derived from C) |
| Am | x 3 5 5 4 3 | x R 5 R ♭3 5 | 5, 3 | Am: x 0 2 2 1 0 |
| Gm | 8 6 5 5 8 8 | R ♭3 5 R 5 R | 6, 3, 1 | — (derived from G) |
| Em | 8 10 10 8 8 8 | R 5 R ♭3 5 R | 6, 4, 1 | Em: 0 2 2 0 0 0 |
| Dm | x x 10 12 13 11 | x x R 5 R ♭3 | 4, 2 | Dm: x x 0 2 3 1 |

Notes:

- **Cm shape:** string 1 is not played, because the minor third would lie one fret below the region. The high minor third of the region is on string 2 (TM-7.4).
- **Gm shape:** on string 2, the shape uses the fifth (fret 8), because the minor third would lie one fret below the region.
- The Cm and Gm shapes do not correspond to open chords in common use; they exist as regions of the neck and are presented as such.

**TM-7.2 Order and connections.** The order along the neck is the same (Cm → Am → Gm → Em → Dm) and table TM-6.2 holds unchanged. Shared notes, in C minor:

| Shapes | Shared positions (string, fret) | Degrees |
|---|---|---|
| Cm → Am | string 5, fret 3 | R |
| Am → Gm | string 4, fret 5 · string 3, fret 5 | 5, R |
| Gm → Em | string 6, fret 8 · string 2, fret 8 · string 1, fret 8 | R, 5, R |
| Em → Dm | string 4, fret 10 | R |
| Dm → Cm | string 3, fret 12 · string 2, fret 13 | 5, R |

**TM-7.3 Relationship with the relative key.** The scale pattern of each minor shape is identical to the pattern of a major shape of the relative key (three semitones higher):

| Minor shape | Same region as the major shape of the relative key |
|---|---|
| Em | G |
| Dm | E |
| Cm | D |
| Am | C |
| Gm | A |

Example: the region of the Em shape of A minor is the region of the G shape of C major.

**TM-7.4 Natural minor scale and arpeggio in each shape.** Frets of the C natural minor scale (C D E♭ F G A♭ B♭), with degrees. The notes of degree R, ♭3, and 5 form the Arpeggio layer.

| Shape | String 6 | String 5 | String 4 | String 3 | String 2 | String 1 |
|---|---|---|---|---|---|---|
| Cm | 1(4) 3(5) 4(♭6) | 1(♭7) 3(R) | 0(2) 1(♭3) 3(4) | 0(5) 1(♭6) 3(♭7) | 1(R) 3(2) 4(♭3) | 1(4) 3(5) 4(♭6) |
| Am | 3(5) 4(♭6) 6(♭7) | 3(R) 5(2) 6(♭3) | 3(4) 5(5) 6(♭6) | 3(♭7) 5(R) | 3(2) 4(♭3) 6(4) | 3(5) 4(♭6) 6(♭7) |
| Gm | 6(♭7) 8(R) | 5(2) 6(♭3) 8(4) | 5(5) 6(♭6) 8(♭7) | 5(R) 7(2) 8(♭3) | 6(4) 8(5) 9(♭6) | 6(♭7) 8(R) |
| Em | 8(R) 10(2) 11(♭3) | 8(4) 10(5) 11(♭6) | 8(♭7) 10(R) | 7(2) 8(♭3) 10(4) | 8(5) 9(♭6) 11(♭7) | 8(R) 10(2) 11(♭3) |
| Dm | 10(2) 11(♭3) 13(4) | 10(5) 11(♭6) 13(♭7) | 10(R) 12(2) 13(♭3) | 10(4) 12(5) 13(♭6) | 11(♭7) 13(R) | 10(2) 11(♭3) 13(4) |

**TM-7.5 Minor pentatonic in each shape** (degrees R, ♭3, 4, 5, ♭7): the scale pattern without the 2nd and ♭6th degrees. In C minor:

| Shape | String 6 | String 5 | String 4 | String 3 | String 2 | String 1 |
|---|---|---|---|---|---|---|
| Cm | 1 3 | 1 3 | 1 3 | 0 3 | 1 4 | 1 3 |
| Am | 3 6 | 3 6 | 3 5 | 3 5 | 4 6 | 3 6 |
| Gm | 6 8 | 6 8 | 5 8 | 5 8 | 6 8 | 6 8 |
| Em | 8 11 | 8 10 | 8 10 | 8 10 | 8 11 | 8 11 |
| Dm | 11 13 | 10 13 | 10 13 | 10 12 | 11 13 | 11 13 |

The Em shape is the minor pentatonic position most guitarists learn first; the interface can use that fact as a point of recognition.

---

## TM-8 — CAGED and tunings

**TM-8.1** The CAGED shapes are a consequence of the intervals between the strings in standard tuning. They hold in any tuning that preserves those intervals (the whole tuning transposed equally): the drawing is the same and the note names change.

**TM-8.2** The name of the shape refers to the **drawing**, not to the sound. In AF-2, the E shape at the nut sounds E♭.

**TM-8.3** When only the lowest string is altered (AF-4, AF-5), the shapes stay valid on strings 5 to 1. On the altered string, the notes of the region are recalculated from the real tuning (FR-6.15). In Drop D, the notes on string 6 lie two frets further up compared with standard tuning.

**TM-8.4** In tunings that alter the relationship between strings 5 to 1 (AF-6 to AF-11 and most custom tunings), the drawings of the open chords are different and the CAGED model does not apply (FR-6.14).

---

## TM-9 — Sample for teacher review

The minimum views to review before launch (metric M-4, NFR-9.5). Each view is checked for notes, spelling, functions, position on the fretboard, and sound.

| # | Tool | View | Instrument |
|---|---|---|---|
| 1 | Notes | Every occurrence of F♯/G♭, with octaves | 6 strings, AF-1 |
| 2 | Notes | Natural notes, frets 0–12 | 6 strings, AF-1 |
| 3 | Notes | Unisons of A3 | 6 strings, AF-1 |
| 4 | Notes | All notes, frets 0–5 | 7 strings, AF-21 |
| 5 | Notes | Every occurrence of D | 6 strings, AF-7 (DADGAD) |
| 6 | Triads | A major, three inversions, set 3-2-1, full neck | 6 strings, AF-1 |
| 7 | Triads | E♭ minor, 1st inversion, set 4-3-2 | 6 strings, AF-1 |
| 8 | Triads | B diminished, root position, set 5-4-3 | 6 strings, AF-1 |
| 9 | Triads | A♭ augmented, three inversions, set 6-5-4 | 6 strings, AF-1 |
| 10 | Triads | G major compared with G minor, 2nd inversion, set 4-3-2 | 6 strings, AF-1 |
| 11 | Triads | D♯ major (spelling with a double sharp) | 6 strings, AF-1 |
| 12 | Triads | C major, root position, set 6-5-4 | 6 strings, AF-4 (Drop D) |
| 13 | Triads | E minor, root position, set 7-6-5 | 7 strings, AF-21 |
| 14 | Triads | G major, all notes | 6 strings, AF-8 (Open G) |
| 15 | CAGED | C major, five shapes, Chord layer | 6 strings, AF-1 |
| 16 | CAGED | A minor, Em shape, Chord + Pentatonic layers | 6 strings, AF-1 |
| 17 | CAGED | G major, E shape, Chord + Arpeggio + Scale layers | 6 strings, AF-1 |
| 18 | CAGED | F♯ minor, five shapes, connections on | 6 strings, AF-1 |
| 19 | CAGED | E major, A shape, Triad layer | 6 strings, AF-2 (half step down) |
| 20 | CAGED | D major, C shape, Scale layer | 7 strings, AF-21 |
| 21 | CAGED | D major, E shape, Chord layer | 6 strings, AF-4 (Drop D) |
| 22 | All | Views 6, 15, and 16 in left-handed mode | 6 strings, AF-1 |
