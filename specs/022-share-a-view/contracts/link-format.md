# Contract: Share Link Wire Format, version 1

External interface: the URL a user sends to another person, and the browser address on a tool
screen. Frozen once released (Constitution IX); later versions may only add parameters.
Rationale in [research.md](../research.md) R-02–R-05; field semantics in
[data-model.md](../data-model.md) §1.

## 1. Shape

```text
link      = origin "/" tool "?" "v=1" ( "&" param )*        ; no fragment, no trailing slash
tool      = "notes" | "triads" | "caged"
token     = 1*( ALPHA / DIGIT / "." / "-" )                 ; never percent-encoded
none      = "-"
bool      = "0" | "1"
int       = "0" | %x31-39 *DIGIT                           ; no sign, no leading zeros
list      = none | int *( "." int )
```

- `origin` is `location.origin` of the sharer (absolute URL).
- Home (`/`) and About (`/about`) never carry parameters.
- Every parameter below is always written, in the listed order, even when it equals a default.
- Decoders ignore unknown parameters and duplicate keys after the first (forward extension).

## 2. Common tail (every tool, after the tool fields)

| # | Key | Value | Meaning |
|---|---|---|---|
| c1 | `sc` | `6` \| `7` | string count |
| c2 | `tu` | `TuningId` (`AF-1` … `AF-11`, `AF-21` … `AF-23`) \| `c.` int×sc | preset, or custom MIDI pitches string 1 (highest) → sc |
| c3 | `fr` | int 12..24 | fret count |

`labelType` (`lb`) is per tool and sits at the end of each tool's field list.

## 3. Notes — `/notes`

| # | Key | Value | State field |
|---|---|---|---|
| 1 | `v` | `1` | format version |
| 2 | `sel` | list of pitch classes 0..11, first-selected order | `selection` |
| 3 | `str` | list of strings, ascending | `activeStrings` |
| 4 | `rg` | `<start>.<end>` | `region` |
| 5 | `bg` | `naturals` \| `all` \| `none` | `background` |
| 6 | `hn` | bool | `hideNames` |
| 7 | `cd` | `<string>.<fret>` \| none | `card` |
| 8 | `lb` | `name` \| `octave` \| `none` | `labelType` |
| 9–11 | `sc` `tu` `fr` | §2 | instrument |

## 4. Triads — `/triads`

| # | Key | Value | State field |
|---|---|---|---|
| 1 | `v` | `1` | |
| 2 | `rt` | int 0..11 | `rootPc` |
| 3 | `sp` | `none` \| `sharp` \| `flat` | `spellingOverride` |
| 4 | `q` | `major` \| `minor` \| `diminished` \| `augmented` | `quality` |
| 5 | `inv` | `root` \| `first` \| `second` | `inversion` |
| 6 | `ss` | int 3..sc | `stringSet` |
| 7 | `vw` | `isolated` \| `full-neck` \| `all-notes` | `view` |
| 8 | `oc` | int ≥ 0 | `occurrence` |
| 9 | `cmp` | bool | `compare.on` |
| 10 | `cq` | quality \| none | `compare.quality` |
| 11 | `lb` | `interval` \| `name` | `labelType` |
| 12–14 | `sc` `tu` `fr` | §2 | instrument |

## 5. CAGED — `/caged`

| # | Key | Value | State field |
|---|---|---|---|
| 1 | `v` | `1` | |
| 2 | `rt` | int 0..11 | `rootPc` |
| 3 | `sp` | `none` \| `sharp` \| `flat` | `spellingOverride` |
| 4 | `q` | `major` \| `minor` | `quality` |
| 5 | `fc` | `<C\|A\|G\|E\|D>.<ordinal>` \| none | `focus` |
| 6 | `ly` | 5 bool digits: chord, arpeggio, pentatonic, scale, triad | `layers` |
| 7 | `cn` | bool | `connections` |
| 8 | `ts` | int 3..sc \| none | `triadSet` |
| 9 | `lb` | `interval` \| `name` | `labelType` |
| 10 | `tmp` | bool | temporary-standard-tuning flag (FR-6.14; preferred instrument stays in §2) |
| 11–13 | `sc` `tu` `fr` | §2 | preferred instrument |

## 6. Never present (FR-010)

Language, notation, accidental policy, handedness, orientation, theme, sound/volume/tempo,
scroll position, open panels, hover, keyboard cursor, playback, notices, timestamps, random
tokens, any identifier. A unit test asserts the encoder's output key set equals exactly the
keys in §3–§5 for each tool.

## 7. Examples (become v1 fixtures)

```text
https://fretboard.example/notes?v=1&sel=-&str=1.2.3.4.5.6&rg=0.22&bg=naturals&hn=0&cd=-&lb=name&sc=6&tu=AF-1&fr=22
https://fretboard.example/triads?v=1&rt=0&sp=none&q=major&inv=root&ss=3&vw=isolated&oc=0&cmp=0&cq=-&lb=interval&sc=6&tu=AF-1&fr=22
https://fretboard.example/caged?v=1&rt=0&sp=none&q=major&fc=-&ly=10000&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-1&fr=22
https://fretboard.example/caged?v=1&rt=9&sp=none&q=minor&fc=E.0&ly=10100&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-1&fr=22
https://fretboard.example/notes?v=1&sel=0.4.7&str=1.2.3&rg=5.9&bg=all&hn=1&cd=2.5&lb=octave&sc=6&tu=c.64.59.55.50.45.38&fr=22
```

Worst case (7 strings, custom tuning, all 12 notes, card, 24 frets) ≈ 170 characters
including a 30-character origin; SC-006 limit is 1,000.

## 8. Compatibility rules

1. A released `v=1` link MUST decode to the same snapshot in every later build (fixtures,
   append-only).
2. New fields in v1 are not allowed; adding a field means `v=2`, whose decoder MUST still
   accept `v=1` with the new field at its v1-equivalent default.
3. Token spellings in §3–§5 are frozen even if internal type ids are renamed; the codec maps
   them explicitly (`format.ts`), never by `String(enumValue)` passthrough of an untested id.
