# ADR 0020: Notation context and accidental policy

- **Status**: Accepted
- **Source**: spec 021-note-notation-and-accidentals (research R-01, R-04, R-05, R-06, R-09, R-16)

## Context

Note names must be switchable between letters (C D E) and solfège (Do Re Mi), and single notes
must be spelled with sharps, flats or both, from anywhere in the app and without remounting
anything. The preference applies to single notes only: Triads and CAGED carry theory spellings
and their background markers keep sharps. Solfège syllables are longer than letters, so marker
labels need a deterministic fit rule that works in SSR and jsdom (no DOM measurement).

## Decision

- **Replaceable notation source.** `src/lib/notation/notation.ts` reads the active context
  `{ notation: 'letters' | 'solfege'; accidentals: 'sharps' | 'flats' | 'both' }` through one
  getter, `overwriteNotationSource(get)`. The default returns `{ letters, sharps }`, so Vitest and
  prerender behave as before. `src/lib/state/notation.svelte.ts` installs a getter that reads
  its `$state` on `start()`, so every `noteLabel` and `spokenNote` call inside a `$derived`
  re-runs on switch. Same mechanism as ADR 0019. `src/lib/notation` stays free of Svelte
  imports. (R-01)
- **Accidentals are a per-surface opt-in.** Notation exports `singleSpelling`, `spellingPair`
  and `markerSpellings`, which read the context. `defaultSpelling` does not change, so Triads and
  CAGED never leak flats. The Notes model, `NoteSelector` and open-string names call the
  helpers explicitly. (R-04)
- **`DisplayModel.spellingPolicy?: 'preference'`.** Only the Notes model sets it. When absent,
  the Fretboard keeps today's behavior (explicit `mk.spelling`, else `defaultSpelling`), so
  Triads and CAGED fixtures stay byte-identical. (R-05)
- **`Instrument.fixedSpelling`.** Preset tunings (including customs that canonicalize to a
  preset) keep their spelling. Unmatched custom tunings follow the preference through
  `stringSpelling(open, fixed)`. The flag is plain data, so `src/lib/instrument` does not depend
  on a preference. (R-06)
- **Grapheme fit rule.** Pure `fitMarkerLabel(lines, markerSize)` in
  `src/lib/fretboard/label-fit.ts`, counting `Array.from(text).length`: up to 3 graphemes
  normal size, 4 minimum size, 5 or more abbreviated (name part to 2 graphemes, drop octave)
  then retested. Two lines (under "both") only on medium or root markers with each line up to 3
  graphemes. Parts come from `noteLabelParts`. No `Intl.Segmenter`, no measurement. (R-09)

## Consequences

- A notation or accidental change is a rune write. Nothing remounts, no call site gains a
  parameter, and FR-018 (one notation source) holds by construction.
- Each surface that should follow the preference must opt in. A new surface defaults to the
  old behavior, which is the safe side for theory-spelled tools.
- Marker label fit is testable as a pure function. The abbreviation is language-neutral and
  only ever affects "Sol" to "So".

## Alternatives considered

- **Pass notation as a parameter to every formatter** (R-01): about 60 call sites, and a missed
  one silently keeps letters.
- **`{#key}` remount on switch** (R-01): loses focus and transient state, breaks motion.
- **Make `defaultSpelling` honor the preference** (R-04): leaks flats into Triads and CAGED.
- **Detect the tool inside the Fretboard** (R-05): couples the renderer to tool identity.
- **Respell custom tunings in `tuningStrings`** (R-06): makes the instrument module depend on a
  preference and invalidates memoized instruments.
- **`Intl.Segmenter`** (R-09): unneeded for the closed alphabet and adds weight.
- **DOM text measurement** (R-09): not deterministic across SSR and jsdom.
