# Contract: Tool links (state)

There are two modules:

- `src/lib/state/links.ts`: pure. No Svelte, paraglide or DOM. It is lint-guarded like
  `notes-view.ts`.
- `src/lib/state/links.svelte.ts`: the orchestrator over the `notes` and `triads` stores and
  `$app/navigation`.

## 1. Pure API (`links.ts`)

```ts
export const NOTES_PRIMARY_CHOICE: 'sharp'; // FR-8.6 will make this a preference

export type CarryContext =
  | { kind: 'root'; rootPc: PitchClass }
  | { kind: 'triad'; rootPc: PitchClass; quality: Quality; spelling: SpellingOverride }
  | { kind: 'notes'; selection: readonly [PitchClass, PitchClass, PitchClass] };

export function carryFromNotes(n: NotesViewState): CarryContext | null;          // one note → root
export function carryFromDetected(d: TriadMatch): CarryContext;                  // View as triad
export function carryFromTriads(t: TriadsViewState): CarryContext;               // main triad only

export function carryRoot(t: TriadsViewState, pc: PitchClass): TriadsViewState;
export function carryTriad(
  t: TriadsViewState, pc: PitchClass, q: Quality, spelling: SpellingOverride, i: Instrument
): TriadsViewState;
export function carrySelection(
  n: NotesViewState, sel: readonly PitchClass[]
): NotesViewState;
```

Guarantees:

| # | Given | Then |
|---|---|---|
| L1 | Notes `[9]`, Triads `{root C, minor, first, set 4}` | `carryRoot` → `{root A, override none, minor, first, set 4, occurrence 0}` |
| L2 | Notes `[8]`, Triads quality augmented | root 8, override `none` → effective spelling A♭ (TM-4.3) |
| L3 | Triads root 1 with override `flat`, `carryRoot(t, 1)` | the same object (D♭ kept) |
| L4 | Notes selection length 0, 2 or ≥ 3 | `carryFromNotes` → `null` (no carry) |
| L5 | Triads `{root 4, augmented, compare on/minor}` | `carryFromTriads` → `[4, 8, 0]` (compare ignored) |
| L6 | `carrySelection(n, [0,4,7])` | only `selection` changes; card, filters, labels, background and hideNames are the same values |
| L7 | detected `{1, major}` | `carryFromDetected` → spelling `sharp` → Triads spells C♯–E♯–G♯ |
| L8 | detected `{0, major}` | spelling `none` (natural) |
| L9 | `carryTriad` with Compare on and `q === compare.quality` | quality and compare quality swap (007 invariant kept) |
| L10 | `carryTriad` with the same root, spelling and quality | the same object |
| L11 | any carry | inversion, stringSet, view, labelType and compare.on are unchanged |

## 2. Orchestrator (`links.svelte.ts`)

```ts
export type LinkedTool = 'notes' | 'triads';

/** Apply the carry for a user switch `from → to` (nav link). No-op if from === to. */
export function linkTools(from: ScreenId, to: LinkedTool): void;

/** Shortcut: Notes "View as triad". Applies the carry, then goto('/triads') (one history entry). */
export function viewAsTriad(): Promise<void>;

/** Shortcut: position card "Triads from this note". */
export function openTriadsFromNote(pc: PitchClass): Promise<void>;

/** Reset the given tool's store (failure-view Reset tool, EC-1.3). */
export function resetTool(tool: LinkedTool): void;
```

Rules:

- `linkTools('notes','triads')`: `triads.carryRoot(pc)` iff `carryFromNotes(notes.state)` is
  non-null.
- `linkTools('triads','notes')`: `notes.carrySelection(carryFromTriads(triads.state).selection)`.
  This always carries.
- `linkTools(from, to)` with `from` ∈ {home, about}: no-op (FR-003, FR-006).
- `viewAsTriad()`: no-op without navigation if `notes.display.detected === null`.
- None of these functions write to the URL, storage or history, except the single `goto`
  in each shortcut (FR-015).

## 3. Callers

| Caller | Calls | Condition |
|---|---|---|
| `AppNav.svelte` tool link `onclick` | `linkTools(current, item.id)` | `item.id` is a tool, `item.id !== current`, `e.button === 0`, no modifier keys, `!e.defaultPrevented` |
| `DetectedTriad.svelte` button | `viewAsTriad()` | the button is visible only when detected |
| `PositionCard.svelte` button | `openTriadsFromNote(info.pitchClass)` | the card is open |
| `ToolLayout.svelte` failure snippet | `resetTool(tool)` then the boundary `reset()` | **Reset tool** in the failure view |
| `ToolCard.svelte`, `HomeScreen.svelte`, Back/Forward, typed or reloaded URL | — | never carry |
