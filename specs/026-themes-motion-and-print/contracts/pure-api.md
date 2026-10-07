# Contract: Pure Modules, Stores and the Boot Script

Signatures and the cases each must pass. Types are in [data-model.md](../data-model.md).
Modules in §1–§4 are built test-first (Principle IV).

## 1. Preferences codec (`src/lib/prefs/schema.ts`)

```ts
export const THEMES: readonly ['light', 'dark'];
export type Theme = (typeof THEMES)[number];
// Preferences gains:  readonly theme: Theme | null;   DEFAULT_PREFERENCES.theme = null
export function parsePreferences(raw: string | null): Preferences;   // unchanged signature
export function serializePreferences(p: Preferences): string;       // unchanged signature
```

Required cases:

| Input | Result |
|---|---|
| Record without `theme` | `theme: null`, every other field as before |
| `"theme":"dark"` / `"light"` | `'dark'` / `'light'` |
| `"theme":"system"`, `"Dark"`, `1`, `{}`, `null` | `null`, other fields unchanged |
| `serialize(defaults)` | Byte-identical to the slice-025 string (no `theme` key) |
| `serialize({ …, theme: 'dark' })` | Ends `…,"theme":"dark"}`, after `cagedNote` when present |
| Round trip | `parse(serialize(p))` deep-equals `p` (fast-check over all fields incl. `theme`) |

## 2. Boot script (`static/theme-boot.js`)

Behaviour, run in a `node:vm` context with stub `localStorage` and `document.documentElement`
(test `tests/unit/prefs/theme-boot.test.ts`):

| Storage state | `documentElement.dataset.theme` after run |
|---|---|
| Key `fretboard-master:prefs` absent | Unset |
| Valid record, `theme: 'dark'` | `'dark'` |
| Valid record, `theme: 'light'` | `'light'` |
| `theme` invalid or absent | Unset |
| Non-JSON, JSON array, `null` | Unset |
| `getItem` throws, or `localStorage` getter throws | Unset, no exception escapes |
| Raw longer than `MAX_RAW_LENGTH` | Unset |

Static assertions: the file contains `PREFS_KEY` verbatim, accepts exactly the `THEMES`
values, has no `import`/`export`, and never calls `setItem` or `removeItem`.

## 3. Motion classifier (`src/lib/state/{triads,caged,notes}-view.ts`)

```ts
export function motionKind(prev: TriadsView | null, next: TriadsView, ctx: MotionContext): MotionKind;
// MotionContext = { instrumentChanged: boolean; presentationChanged: boolean }  (labels/notation/language/fit)
```

Table tests reproduce data-model §7 row by row, including:

- `prev === null` gives `'none'`.
- Root plus quality changed together, coming from a link: `'none'`.
- `instrumentChanged` with root unchanged: `'none'`.
- `presentationChanged` gives `'none'`.

Each tool store attaches the result to `DisplayModel.motion`.

## 4. Reconciliation (`src/lib/fretboard/transition.ts`)

```ts
export type MotionKind = 'slide' | 'by-role' | 'cross-fade' | 'focus' | 'reveal' | 'none';
export interface KeyedMarker {
  readonly key: string;
  readonly mk: DrawnMarker;
  readonly enter: 'instant' | 'fade' | 'reveal';
  readonly exit: 'instant' | 'fade';
  readonly from?: Position;
}
export function reconcileMarkers(
  prev: readonly KeyedMarker[],
  next: readonly DrawnMarker[],
  kind: MotionKind,
  generation: number
): readonly KeyedMarker[];
```

Required cases:

- **Slide, Triads root C → D** (same stacking): on each string the old fret n and the new
  fret n+2 share a key, and no key spans two strings.
- **Slide, with more new markers than old on a string**: the extra new markers get
  `enter: 'fade'`. With fewer, the removed old keys are absent from the output, and the
  renderer fades them out using their last `exit`.
- **Slide, left-handed and seven strings**: same pairing, because keys are by string and fret,
  not screen x.
- **By-role, C major → C minor**: the third's key is unchanged and its fret is −1. The root and
  fifth keep the same key and position.
- **By-role, a role moves to another string**: fresh key, `'fade'`.
- **Comparison on**: each comparison marker has `from` equal to the base marker of the same
  role, and the base keys are unchanged.
- **Cross-fade**: no key is shared between `prev` and the output, and every mode is `'fade'`.
- **Reveal**: new layer markers get `enter: 'reveal'`, and existing ones keep their keys.
- **None**: keys are stable, and no mode is `'fade'` or `'reveal'`.
- **Pulse**: a pulsed marker is keyed by `pulse.id` in every kind.
- **Properties** (fast-check): the output markers equal `next` in order, keys are unique, and
  the function is deterministic.

## 5. Durations (`src/lib/fretboard/motion.ts`, unchanged API)

`tokenDuration(el, token)` returns 0 under reduced motion and for a missing token. New uses:
`'--duration-medium'` for focus dim and scroll. No new tokens, no literals.

## 6. Theme store (`src/lib/state/theme.svelte.ts`)

```ts
export type ThemeChoice = 'device' | Theme;
export const theme: {
  readonly choice: ThemeChoice;
  start(stored: Theme | null): void;
  choose(c: ThemeChoice): void;
  restore(stored: null): void;
};
export function resetThemeForTests(): void;
```

Cases (jsdom): `choose('dark')` sets `html[data-theme=dark]` and remembers `{ theme: 'dark' }`.
`choose('device')` removes the attribute and remembers `{ theme: null }`. When storage is
unavailable, the attribute is still set. `preferences.erase()` leads to `choice === 'device'`
and no attribute. Opening a share link (`opening.start(url)`) leaves `choice` untouched.

## 7. Print store (`src/lib/state/print.svelte.ts`)

```ts
export const print: { readonly active: boolean; start(): void };
```

Cases (jsdom with a stub `matchMedia`): a `change` to matches → `active === true`;
`afterprint` → `false`; `start()` twice registers once; without `window` it is a no-op.
