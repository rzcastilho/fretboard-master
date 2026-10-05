# ADR 0018: CAGED tuning classes and temporary tuning

- **Status**: Accepted
- **Source**: spec 015-caged-in-any-tuning (research R-02, R-06, R-15)
- **Amends**: ADR 0017 (CAGED occurrences from the real tuning: "only compatible draws")

## Context

Slice 014 drew CAGED shapes only in compatible tunings and showed an interim message everywhere
else. Players use Drop D, Drop C and other tunings, and a non-compatible tuning still needs an
honest, useful screen, not a dead end.

## Decision

- **Three tuning classes drive behavior.** `cagedTuningClass` (ADR 0017) returns `compatible`,
  `altered-string` or `non-compatible`. `compatible` draws full shapes. `altered-string` (strings
  5 → 1 standard, string 6 changed) draws shapes with string 6 showing only chord notes that lie
  inside the shape. `non-compatible` draws nothing and shows an explanation. (R-02)
- **Placement from string 5.** `shift = mod12(rootPc − (pc(open[string 5]) − 9))`. For every
  compatible tuning this equals the slice-014 string-6 shift, so existing behavior and tests are
  unchanged. For an altered string the table's string-6 cell is dropped before the fit test, so
  `start`, `end` and fit use strings 5 → 1 only. Drop D therefore matches Standard frets for the
  same key. (R-02)
- **Temporary tuning is CAGED-local and never stored.** In a non-compatible tuning the player can
  choose **View in standard tuning**. The CAGED store holds `temporary` state in module memory
  only; the effective instrument is the standard counterpart of the preferred one. It is not
  written to preferences. It ends on leaving CAGED, reload, or confirming an instrument in the
  panel. The preferred instrument is never changed. A permanent badge marks the temporary view.
  (R-06)
- **Amends ADR 0017.** "Only `compatible` draws" becomes "`compatible` and `altered-string`
  draw". Tuning classification itself is unchanged. (R-15)
- **Non-dismissible fallback notice.** The non-compatible notice offers **View in standard
  tuning** and **Go to Triads**. It cannot be dismissed, because it is the fallback view and
  dismissing it would leave an empty zone (plan Complexity Tracking).

## Consequences

- Behavior is selected by one three-way enum; no preset-id tables.
- Standard and other compatible tunings behave exactly as in slice 014.
- Temporary state cannot leak into persisted preferences or other tools.
- The one-way notice costs a deviation from the usual dismissible-message pattern, recorded here.

## Alternatives considered

- **Placement from string 6 for altered tunings** (R-02): wrong when string 6 is the altered one.
- **A separate placement function per class** (R-02): duplicates the candidate and fit loop.
- **Persisting the temporary tuning** (R-06): silently changes the player's instrument.
- **Switching the global instrument to Standard** (R-06): affects every tool and needs an undo.
- **Dismissible notice** (plan): leaves an empty zone with no way back.
