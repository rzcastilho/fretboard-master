# ADR 0015: String count and seven-string canonical form

- **Status**: Accepted
- **Source**: spec 012-seven-strings (plan R-01, R-02, R-03, R-11; contracts/tuning-api.md, contracts/storage-format.md)
- **Amends**: ADR 0012 (instrument store contract), ADR 0013 (preferences record) and ADR 0014 (custom tuning canonical form)

## Context

A learner can play a seven-string guitar. Presets AF-3 … AF-11 must exist for both six and
seven strings, so a preset id alone cannot imply the string count. ADR 0014 fixed `Offsets` as a
six-tuple and made "one form per tuning" a structural guarantee. That guarantee has to survive a
second count, and every six-string behavior, record and test has to stay unchanged (FR-019).

## Decision

- **Count is part of the config.** `InstrumentConfig` gains `stringCount: 6 | 7` next to
  `tuning` and `fretCount`. `DEFAULT_CONFIG` is 6 strings, AF-1, 22 frets. A preset id is
  resolved for a count with `presetStrings(id, count)`.
- **Presets per count.** Six strings: AF-1 … AF-11. Seven strings: AF-21 (7-string standard,
  B1 E2 A2 D3 G3 B3 E4), AF-22 (half step down), AF-23 (Drop A), then AF-3 … AF-11. AF-3 … AF-11
  on seven strings add a string a perfect fourth below string 6 (`fourthBelow` in
  `src/lib/theory/pitch.ts`, pure, no UI imports). AF-1/AF-2 never occur on seven strings and
  AF-21/22/23 never occur on six.
- **Variable-length offsets.** `Offsets` is `readonly number[]` with length equal to the count,
  integers −7…+4 per string, relative to the count's standard pitches. `matchPreset` searches
  only `presetsFor(offsets.length)`, so pitch equality decides the name and AF-21/AF-22 win over
  AF-1/AF-2 by construction. `tuningFromOffsets` stays the single constructor.
- **Count change.** Adding string 7 prepends a copy of string 6's offset (`addSeventh`);
  removing it drops the first offset (`dropSeventh`). Both go through `tuningFromOffsets`, so
  6/AF-1 ↔ 7/AF-21, 6/AF-2 ↔ 7/AF-22, and AF-3 … AF-11 keep their id. `setStringCount` returns
  the same object when nothing changes. `selectTuning` and `stepString` refuse ids and strings
  that do not exist for the count.
- **Record (changes ADR 0013, add-only).** `version` stays 1. New optional field `strings`
  (6 | 7; absent or invalid → 6). Writer omits it for six strings, so every six-string record is
  byte-identical to slice 011 output. Seven strings with an unmatched custom tuning write
  `"tuning":"AF-21"` plus a seven-integer `customTuning`. Reader normalizes `tuning` for the
  count and accepts `customTuning` only when its length equals the count. Existing fixtures are
  untouched; thirteen are added.
- **View adjustment.** Count change flows through the existing adapt paths: Triads 7-6-5 on a
  seven-to-six change lands on 6-5-4 with the adjustment notice; the Notes string filter follows
  the explicit rows in data-model §6. A change that needs no adjustment shows no notice.

## Consequences

- Equality, badge (hidden for AF-1 and AF-21 only), summary and storage stay correct by
  construction. Six-string output is unchanged.
- Older bundles reading a seven-string record ignore `strings`, reject `AF-21` and a
  seven-long `customTuning`, and load six-string standard without error (ADR 0002 version skew).
- Call sites of `presetInstrument`, `offsetsOfTuning`, `tuningStrings` and `tuningInstrument`
  take a count.
- Counts other than 6 and 7 stay out of scope.

## Alternatives considered

- **Separate seven-string ids for every preset** (R-01): doubles the id space, the message
  catalog and the storage picklist.
- **Derive the count from the tuning** (R-01): impossible for AF-3 … AF-11.
- **Allow AF-1 on seven strings and rename at display time** (R-02): two representations of one
  tuning; `equalsConfig` would report a change on Confirm that is none.
- **Absolute MIDI pitches instead of offsets** (R-03): changes the 011 storage format and its
  fixtures, which may only be added to.
- **Keep the six-tuple and add a `seventh` field** (R-03): two code paths wherever a tuning is
  iterated.
- **Version 2 record** (R-11): the extension rule allows optional fields; a v2 forces a
  migration path.
