# Contract: Pure and store APIs (027)

Test-first modules (Principle IV). Types are TypeScript signatures; bodies belong to tasks.

## §1 Preferences codec (`src/lib/prefs/schema.ts`)

```ts
interface Preferences {
  // …existing fields…
  /** 027; absent or invalid in a stored record → true. Stored only when false. */
  readonly shortcuts: boolean;
}
DEFAULT_PREFERENCES.shortcuts === true;
```

| Input record | `parsePreferences(...).shortcuts` |
|---|---|
| no `shortcuts` key | `true` |
| `"shortcuts": false` | `false` |
| `"shortcuts": true` | `true` |
| `"shortcuts": "no"`, `0`, `null` | `true` (field-level fallback; other fields kept) |

| `Preferences` | `serializePreferences` |
|---|---|
| `shortcuts: true` | no `shortcuts` key (byte-identical to 026 output) |
| `shortcuts: false` | `…,"shortcuts":false}` — last key, after `theme` |

`PREFS_VERSION` stays `1`. Never throws (existing totality tests extended).

## §2 Matcher (`src/lib/state/shortcuts.ts`, pure, node-testable)

```ts
export type ShortcutAction = 'listen' | 'next' | 'previous' | 'labels' | 'notation';

/** The shortcut table, in About display order. */
export const SHORTCUTS: readonly { readonly key: 'P' | '.' | ',' | 'L' | 'N'; readonly action: ShortcutAction }[];

export interface ShortcutTarget {
  readonly tagName: string;          // upper-case, e.g. 'INPUT'
  readonly type?: string;            // input type, lower-case
  readonly isContentEditable?: boolean;
}

export interface ShortcutEventLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly repeat: boolean;
  readonly defaultPrevented: boolean;
  readonly isComposing?: boolean;
  getModifierState?(key: string): boolean;
  readonly target: ShortcutTarget | null;
}

/** null when guarded (research R-02) or the key is not in the table. */
export function matchShortcut(e: ShortcutEventLike): ShortcutAction | null;

/** Neighbour of `current` in `list` by `dir`; wraps when `wrap`, else null at the ends. null if current ∉ list. */
export function cycle<T>(list: readonly T[], current: T, dir: 1 | -1, wrap: boolean): T | null;
```

Required table cases (tests): each action key in lower and upper case and with `shiftKey`;
`ArrowUp|ArrowDown|ArrowLeft|ArrowRight|' '|Enter|Escape|Tab|Home|End|PageUp|PageDown|F1…F12|Dead|Unidentified`
→ `null`; each of `ctrlKey|metaKey|altKey|getModifierState('AltGraph')` → `null`; `repeat`,
`defaultPrevented`, `isComposing` → `null`; targets `INPUT[text|search|number|email|url|tel|password]`,
`TEXTAREA`, `SELECT`, contenteditable → `null`; targets `INPUT[checkbox|radio|range|button]`,
`BUTTON`, `DIV`, `svg` group, `null` → action.

## §3 Store and dispatcher (`src/lib/state/shortcuts.svelte.ts`)

```ts
import type { ScreenId } from '$lib/shell/screens';

export const shortcuts: {
  readonly enabled: boolean;
  start(stored: boolean): void;   // from preferences.start(); no write
  choose(on: boolean): void;      // sets, then preferences.remember({ shortcuts: on })
  restore(on: true): void;        // from preferences.erase(); no write
};

/** Runs the action on `screen` through the mirrored control's store method. true iff it ran. */
export function runShortcut(action: ShortcutAction, screen: ScreenId): boolean;

export function resetShortcutsForTests(): void;
```

`runShortcut` table (returns `false` and calls nothing in every "no-op" cell):

| action \ screen | `notes` | `triads` | `caged` | `home`, `about` |
|---|---|---|---|---|
| `listen` | if `notes.display.listen.enabled` → `notes.listen()` | if `triads.display.listen.enabled` → `triads.listen()` | if `caged.display.listen.enabled` → `caged.listen()` | no-op |
| `next` | no-op | if `triads.display.controls.inversion` → `triads.setInversion(cycle(INVERSIONS, state.inversion, 1, true))` | if `caged.display.steps.next` → `caged.step(1)` | no-op |
| `previous` | no-op | same with `-1` | if `caged.display.steps.previous` → `caged.step(-1)` | no-op |
| `labels` | `notes.setLabelType(cycle(NOTES_ORDER, …, 1, true))` | `triads.setLabelType(cycle(['interval','name'], …))` | `caged.setLabelType(cycle(['interval','name'], …))` | no-op |
| `notation` | `notation.choose(effective === 'letters' ? 'solfege' : 'letters')` — every screen |

Invariants (unit-tested with spies on the store methods):

- never calls `listenComparison`, `focus()`, `goto` or any DOM API;
- returns `false` for every no-op cell, so the layout does not `preventDefault`;
- does not check `enabled` itself (the layout does), so tests can drive it directly.

## §4 Preferences store wiring (`src/lib/state/preferences.svelte.ts`)

- `start()`: after `theme.start(p.theme)`, call `shortcuts.start(p.shortcuts)`.
- `erase()`: after `theme.restore(null)`, call `shortcuts.restore(true)`.

## §5 Layout handler (`src/routes/+layout.svelte`)

```svelte
<svelte:window onkeydown={(e) => {
  if (!shortcuts.enabled) return;
  const action = matchShortcut(toShortcutEvent(e));
  if (action && runShortcut(action, screen)) e.preventDefault();
}} />
```

`toShortcutEvent` (in `shortcuts.ts`) adapts a DOM `KeyboardEvent`: reads `target.tagName`,
`(target as HTMLInputElement).type?.toLowerCase()`, `isContentEditable`; non-Element targets →
`null`.
