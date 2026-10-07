/**
 * Keyboard shortcut matcher (027, contracts/pure-api.md §2). Pure and DOM-free: it matches the
 * produced character, never a physical key, and refuses every event the browser, a screen reader
 * or a text field may own.
 */
import type { LabelType } from './notes-view';
import type { TriadsLabelType } from './triads-view';
import type { CagedLabelType } from './caged-view';

export type ShortcutAction = 'listen' | 'next' | 'previous' | 'labels' | 'notation';

/** The shortcut table, in About display order. */
export const SHORTCUTS: readonly {
  readonly key: 'P' | '.' | ',' | 'L' | 'N';
  readonly action: ShortcutAction;
}[] = [
  { key: 'P', action: 'listen' },
  { key: '.', action: 'next' },
  { key: ',', action: 'previous' },
  { key: 'L', action: 'labels' },
  { key: 'N', action: 'notation' }
];

/** Cycle orders; pinned to the prefs codec's label lists by a unit test. */
export const NOTES_LABEL_ORDER = ['name', 'octave', 'none'] as const satisfies readonly LabelType[];
export const TRIADS_LABEL_ORDER = [
  'interval',
  'name'
] as const satisfies readonly TriadsLabelType[];
export const CAGED_LABEL_ORDER = ['interval', 'name'] as const satisfies readonly CagedLabelType[];

export interface ShortcutTarget {
  readonly tagName: string;
  readonly type?: string;
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

const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'search',
  'number',
  'email',
  'url',
  'tel',
  'password'
]);

const BY_KEY: ReadonlyMap<string, ShortcutAction> = new Map(
  SHORTCUTS.map((s) => [s.key.toLowerCase(), s.action])
);

function isEditable(t: ShortcutTarget | null): boolean {
  if (t === null) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  // An input with no `type` is a text input.
  return tag === 'INPUT' && (t.type === undefined || TEXT_INPUT_TYPES.has(t.type));
}

/** `null` when guarded or the key is not in the table. */
export function matchShortcut(e: ShortcutEventLike): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.getModifierState?.('AltGraph')) return null;
  if (e.repeat || e.defaultPrevented || e.isComposing) return null;
  if (isEditable(e.target)) return null;
  if (e.key.length !== 1) return null;
  return BY_KEY.get(e.key.toLowerCase()) ?? null;
}

/** Adapts a DOM event; a non-Element target (document, window) becomes `null`. */
export function toShortcutEvent(e: KeyboardEvent): ShortcutEventLike {
  const t = e.target;
  const target: ShortcutTarget | null =
    typeof Element !== 'undefined' && t instanceof Element
      ? {
          tagName: t.tagName,
          type: (t as HTMLInputElement).type?.toLowerCase(),
          isContentEditable: (t as HTMLElement).isContentEditable
        }
      : null;
  return {
    key: e.key,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    repeat: e.repeat,
    defaultPrevented: e.defaultPrevented,
    isComposing: e.isComposing,
    getModifierState: (k) => e.getModifierState(k),
    target
  };
}

/** Neighbour of `current` by `dir`; wraps when `wrap`, else `null` at the ends or when absent. */
export function cycle<T>(list: readonly T[], current: T, dir: 1 | -1, wrap: boolean): T | null {
  const i = list.indexOf(current);
  if (i === -1) return null;
  const j = i + dir;
  if (j >= 0 && j < list.length) return list[j];
  return wrap ? list[(j + list.length) % list.length] : null;
}
