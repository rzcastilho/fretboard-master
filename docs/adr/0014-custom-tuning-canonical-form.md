# ADR 0014: Custom tuning canonical form

- **Status**: Accepted
- **Source**: spec 011-custom-tuning (plan R-01, R-02, R-03; contracts/storage-format.md)
- **Amends**: ADR 0012 (instrument store contract) and ADR 0013 (preferences record)

## Context

A learner can set each of the six strings to their own pitch (−7…+4 semitones from standard).
Some custom set-ups equal a preset (for example two presses of "Lower string 6" give Drop D).
If such a tuning had two representations, equality, the badge, the home summary, storage and the
"no change on confirm" rule could each disagree about whether it is "custom" or "Drop D".

## Decision

- **Tagged union, one form per tuning.** `InstrumentConfig.tuningId` is replaced by
  `InstrumentConfig.tuning: Tuning`, where
  `Tuning = { kind: 'preset'; id: TuningId } | { kind: 'custom'; offsets: Offsets }` and
  `Offsets` is a 6-tuple of integers −7…+4 (strings 6 → 1, low → high).
- **Canonical form.** A `custom` value is never created for offsets that match a preset. Every
  constructor goes through `tuningFromOffsets`, which returns the preset when `matchPreset`
  finds one. Matching compares semitone offsets, never spelling (G♯ equals A♭).
- **Spelling.** A matched tuning keeps the preset's own spelling (Half step down shows E♭).
  An unmatched tuning uses sharps (`spellSharp` in `src/lib/theory/pitch.ts`).
- **Store contract (changes ADR 0012).** The instrument store gains `chooseCustom`,
  `stepString` and `playString`. Panel state gains `customOpen`. Confirm applies the pending
  tuning only when it differs from the active one.
- **Record (changes ADR 0013, add-only).** `version` stays 1. New optional field
  `customTuning` (six integers). Writer: unmatched custom → `"tuning":"AF-1"` plus
  `customTuning`; any preset → no `customTuning`. Reader: a valid `customTuning` wins over
  `tuning`; an invalid one is ignored alone. Records without it load as before. Existing
  fixtures are untouched and six new ones are added.

## Consequences

- Equality, badge ("Custom" only for unmatched), summary and storage are correct by
  construction. TypeScript forces every consumer to handle `custom`.
- `tuningId` no longer exists on `InstrumentConfig`. Prefs still store `tuning` for older
  readers and for presets.
- A stored `customTuning` that matches a preset is non-canonical and is rewritten on the next
  write. That is expected, not an error.
- Six strings only. Other string counts are out of scope.

## Alternatives considered

- **Keep `tuningId` and add nullable `offsets`**: two fields that can disagree.
- **Store offsets for every tuning**: loses preset spelling unless re-derived on each read.
- **Store six absolute spelled pitches**: forces range checks in pitch space and a spelling
  choice at storage time.
- **Match by spelled pitch**: would miss enharmonic equals.
