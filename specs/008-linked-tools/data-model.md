# Data Model: Linked Tools (008)

Phase 1 output for [plan.md](./plan.md). Decisions are explained in [research.md](./research.md).
Every type is immutable (`readonly`). Every transition is total: invalid input is a no-op, and
a no-op returns the same object (`Object.is`), following the convention of
`notes-view.ts` and `triads-view.ts`.

## 1. Existing entities (unchanged shape)

| Entity | Module | Role in this slice |
|---|---|---|
| `NotesViewState` | `src/lib/state/notes-view.ts` | **Tool session state** for Notes. `selection: readonly PitchClass[]` is the **ordered note selection** (FR-011). It is first-selected order already, and toggling a note off and on appends it at the end. |
| `TriadsViewState` | `src/lib/state/triads-view.ts` | **Tool session state** for Triads. The carry writes `rootPc`, `spellingOverride`, `quality`, `occurrence` and, through the swap rule only, `compare.quality`. |
| `Quality`, `QUALITY_INTERVALS`, `QUALITIES` | `src/lib/theory/triad.ts` | Detection patterns (TM-4.5). |

No persisted format changes. Preferences, storage and share links are untouched, so there is
no new format version (Principle IX does not apply).

## 2. New: `DetectedTriadTheory` (theory)

`src/lib/theory/triad-detect.ts`

```ts
export interface TriadMatch {
  readonly rootPc: PitchClass; // 0..11
  readonly quality: Quality;
}
export function detectTriad(selection: readonly PitchClass[]): TriadMatch | null;
```

Validation and rules (FR-009, FR-010):

- The selection must hold exactly 3 entries, each an integer in 0..11, all distinct.
  Otherwise the result is `null`.
- Candidate roots are tried in selection order. A candidate matches quality `q` when
  `{(a − r) mod 12, (b − r) mod 12} = {QUALITY_INTERVALS[q].third, QUALITY_INTERVALS[q].fifth}`.
- The first match in (candidate order × `QUALITIES` order) is returned.
- Invariants:
  - for major, minor and diminished, the result is the same for all 6 orders;
  - for augmented, `rootPc === selection[0]`.

## 3. New: `DetectedTriad` (display, Notes)

This field is added to `NotesDisplay` in `src/lib/state/notes-model.ts`:

```ts
export interface DetectedTriad {
  readonly rootPc: PitchClass;
  readonly quality: Quality;            // re-exported type for tools
  readonly rootSpelling: Spelling;      // Notes primary spelling: defaultSpelling(rootPc)
  readonly name: string;                // "G♯ augmented" (catalog: notes_triad_name)
  readonly spokenName: string;          // "G sharp augmented"
}
// NotesDisplay.detected: DetectedTriad | null
```

- The value exists only while `detectTriad(state.selection) !== null`. It is independent of
  `hideNames`, filters and region.
- When the value is present, `model.description` is extended with
  `notes_desc_triad({ name: spokenName })`.

## 4. New: `CarryContext` (state, pure)

`src/lib/state/links.ts`. This is the musical context moved at a switch.

```ts
export type CarryContext =
  | { readonly kind: 'root'; readonly rootPc: PitchClass }                    // Notes → Triads (one note / card)
  | { readonly kind: 'triad'; readonly rootPc: PitchClass;
      readonly quality: Quality; readonly spelling: 'none' | 'sharp' | 'flat' } // View as triad
  | { readonly kind: 'notes'; readonly selection: readonly [PitchClass, PitchClass, PitchClass] }; // Triads → Notes
```

The constructors are pure:

| Function | Result |
|---|---|
| `carryFromNotes(n: NotesViewState): CarryContext \| null` | `{kind:'root', rootPc: n.selection[0]}` iff `n.selection.length === 1`, else `null` (FR-001, FR-003) |
| `carryFromDetected(d: TriadMatch): CarryContext` | `{kind:'triad', …, spelling: isAlteredRoot(rootPc) ? NOTES_PRIMARY_CHOICE : 'none'}` with `NOTES_PRIMARY_CHOICE = 'sharp'` (FR-008) |
| `carryFromTriads(t: TriadsViewState): CarryContext` | `{kind:'notes', selection: [r, r+third, r+fifth] mod 12}` from `t.quality`, never `t.compare.quality` (FR-002) |

## 5. New transitions (state, pure)

| Function | Changes | Keeps | No-op when |
|---|---|---|---|
| `carryRoot(t, pc)` | `rootPc`, `spellingOverride → 'none'`, `occurrence → 0` | everything else | `pc === t.rootPc` or `pc` is invalid (FR-001, acceptance 2.9) |
| `carryTriad(t, pc, q, spelling, i)` | `rootPc`, `spellingOverride`, `quality` (swap with `compare.quality` if equal, as in `setQuality`), `occurrence → 0`, then the occurrence is clamped | inversion, stringSet, view, labelType, compare.on | root, spelling and quality all equal |
| `carrySelection(n, sel)` | `selection → sel` (order root, third, fifth) | labelType, background, hideNames, activeStrings, region, card | `sel` equals `n.selection` element-wise |

## 6. Store additions (Svelte runes)

| Store | New method | Behavior |
|---|---|---|
| `triads` (`triads.svelte.ts`) | `carryRoot(pc)` | `apply(carryRoot(view, pc))` |
| `triads` | `carryTriad(pc, q, spelling)` | `apply(next, swapped ? compare-swapped notice : null)` |
| `notes` (`notes.svelte.ts`) | `carrySelection(sel)` | `apply(carrySelection(view, sel))` |

`apply()` already stops playback on a real change and does nothing on a no-op.

## 7. State transitions: tool sessions

```text
             reload / new tab
                  │
                  ▼
  ┌────────── initial ◀──────── Reset tool (either entry point) ─┐
  │               │                                              │
  │   in-tool change (no history)                                │
  │               ▼                                              │
  └──────────▶ remembered ───────────────────────────────────────┘
                  │  ▲
     carry-over   │  │  switch away / Back / Forward / home card
  (nav link or    ▼  │  (state kept as is)
   shortcut)   remembered with the carried part replaced
```

- Each tool has one remembered state per page session (FR-012).
- A carry replaces only its part (FR-005).
- A reset becomes the remembered state (FR-013) and never touches the other tool or the
  instrument, locale or notation (FR-014).
