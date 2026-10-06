# ADR 0021: Share link format and address-bar sync

- **Status**: Accepted
- **Source**: spec 022-share-a-view (research R-02, R-03, R-04, R-08)

## Context

A learner must be able to send the exact view they are looking at to someone else, as a plain
link, with no account and no network round trip. The link has to describe the whole musical view
(tool, key, quality, selection, instrument), carry nothing personal (language, notation,
handedness, orientation, theme, sound, scroll), keep working after the app changes defaults, and
fit comfortably in a message. The address bar should show the same link so that copying it by
hand works too, without adding history entries or disturbing playback and focus.

## Decision

- **Path per tool, query for state, versioned.** `<origin>/<tool>?v=1&<tool fields>&<common
fields>`, with `v` first, fixed per-tool parameter order, no fragment. Every field is written
  explicitly (canonical), so the same view always yields the same bytes and a later change of a
  default cannot alter an old link. Values use only `[A-Za-z0-9.-]`: list separator `.`, one
  "none" token `-`, booleans `0`/`1`. The encoder concatenates strings and never percent-encodes.
  The codec lives in `src/lib/link`, pure TypeScript with no Svelte, DOM, i18n or storage. (R-02)
- **Instrument as preset id or per-string pitches.** `sc=<6|7>&tu=<id>&fr=<12..24>`. `tu` is the
  preset id (`AF-1`, `AF-21`, …) for a preset tuning, otherwise `c.` plus each string's absolute
  MIDI pitch from string 1 to string n. Decoding converts pitches to offsets and re-canonicalizes
  through `tuningFromOffsets` (ADR 0014), so a custom list equal to a preset decodes to that
  preset. Handedness and orientation are never read by the encoder. (R-03)
- **Per-tool field mapping mirrors the view state one to one.** Notes: `sel`, `str`, `rg`, `bg`,
  `hn`, `cd`, `lb`. Triads: `rt`, `sp`, `q`, `inv`, `ss`, `vw`, `oc`, `cmp`, `cq`, `lb`. CAGED:
  `rt`, `sp`, `q`, `fc`, `ly`, `cn`, `ts`, `lb`, `tmp`. `compare.quality` is written even when
  compare is off so the round trip is exact. The CAGED temporary-standard flag is carried as
  `tmp` (it supersedes slice 015's "never in the URL") but is still never written to device
  storage. (R-04)
- **Address-bar sync through `replaceState`.** `src/lib/state/address.ts` is a plain debounce
  (150 ms trailing, injected timer and writer); `address.svelte.ts` binds it to SvelteKit's
  shallow `replaceState`, guarded by a pathname check so a stale timer never writes one tool's
  state onto another tool's URL. A failed write disables sync for the current screen instead of
  retrying or reaching the UI. The Share command always encodes the live state directly, so it
  is never stale. (R-08)

## Consequences

- Two views are equal exactly when their links are byte-identical, which makes exclusion
  (SC-003) and completeness (SC-002) testable as plain string comparisons.
- The format is a public contract. A change that alters meaning needs a new `v`, and old fixtures
  under `tests/unit/link/fixtures` keep decoding.
- Adding view state means adding a field to the codec in the same change, or it silently stays
  out of the link. The exclusion and inclusion matrix tests catch the omission.
- Links stay under 1,000 characters in the worst case (seven strings, full selection).
- Shallow `replaceState` skips navigation callbacks, so playback, CAGED `screenChanged` and
  focus management are untouched by address updates.

## Alternatives considered

- **Base64 JSON blob** (R-02): opaque, not canonical across key order, longer.
- **Fragment (`#`) state** (R-02): rejected by clarification.
- **Omit defaults** (R-02): defaults may change, which would silently alter old links.
- **Offsets for custom tunings** (R-03): relative to an implicit reference, and the minus sign
  collides visually with the "none" token.
- **Note names for custom tunings** (R-03): depend on language and notation, which links must
  not.
- **Drop `cq` when `cmp=0`** (R-04): loses remembered state and breaks the exact round trip.
- **Layers as a name list** (R-04): longer and order-ambiguous versus five `0/1` digits.
- **`history.replaceState` directly** (R-08): desyncs SvelteKit's router state.
- **`goto(..., { replaceState: true })`** (R-08): runs load and navigation callbacks, stops
  playback and moves focus.
- **Throttle instead of debounce** (R-08): rejected by clarification; trailing debounce settles
  on the final view.
