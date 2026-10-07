import { describe, expect, it } from 'vitest';
import {
  CAGED_LABEL_ORDER,
  NOTES_LABEL_ORDER,
  SHORTCUTS,
  TRIADS_LABEL_ORDER,
  cycle,
  matchShortcut,
  toShortcutEvent,
  type ShortcutEventLike,
  type ShortcutTarget
} from '../../../src/lib/state/shortcuts';
import { CAGED_LABELS, NOTES_LABELS, TRIADS_LABELS } from '../../../src/lib/prefs/schema';

const ev = (over: Partial<ShortcutEventLike> = {}): ShortcutEventLike => ({
  key: 'p',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  defaultPrevented: false,
  target: { tagName: 'DIV' },
  ...over
});

const KEYS = [
  ['p', 'listen'],
  ['.', 'next'],
  [',', 'previous'],
  ['l', 'labels'],
  ['n', 'notation']
] as const;

describe('SHORTCUTS table', () => {
  it('is in About order P . , L N', () => {
    expect(SHORTCUTS.map((s) => s.key)).toEqual(['P', '.', ',', 'L', 'N']);
    expect(SHORTCUTS.map((s) => s.action)).toEqual(KEYS.map((k) => k[1]));
  });
});

describe('matchShortcut: keys', () => {
  it.each(KEYS)('%s → %s in lower case, upper case and with shift', (key, action) => {
    expect(matchShortcut(ev({ key }))).toBe(action);
    expect(matchShortcut(ev({ key: key.toUpperCase() }))).toBe(action);
    expect(matchShortcut(ev({ key: key.toUpperCase(), shiftKey: true }))).toBe(action);
    expect(matchShortcut(ev({ key, shiftKey: true }))).toBe(action);
  });

  it.each([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    ' ',
    'Enter',
    'Escape',
    'Tab',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
    'Dead',
    'Unidentified',
    'x',
    ''
  ])('%j → null', (key) => {
    expect(matchShortcut(ev({ key }))).toBeNull();
  });
});

describe('matchShortcut: guards', () => {
  it.each(['ctrlKey', 'metaKey', 'altKey'] as const)('%s → null', (k) => {
    expect(matchShortcut(ev({ [k]: true }))).toBeNull();
  });
  it('AltGraph → null', () => {
    expect(matchShortcut(ev({ getModifierState: (k) => k === 'AltGraph' }))).toBeNull();
    expect(matchShortcut(ev({ getModifierState: () => false }))).toBe('listen');
  });
  it.each(['repeat', 'defaultPrevented', 'isComposing'] as const)('%s → null', (k) => {
    expect(matchShortcut(ev({ [k]: true }))).toBeNull();
  });

  const editable = ['text', 'search', 'number', 'email', 'url', 'tel', 'password'];
  it.each(editable)('INPUT[%s] → null', (type) => {
    expect(matchShortcut(ev({ target: { tagName: 'INPUT', type } }))).toBeNull();
  });
  it('TEXTAREA, SELECT and contenteditable → null', () => {
    expect(matchShortcut(ev({ target: { tagName: 'TEXTAREA' } }))).toBeNull();
    expect(matchShortcut(ev({ target: { tagName: 'SELECT' } }))).toBeNull();
    expect(matchShortcut(ev({ target: { tagName: 'DIV', isContentEditable: true } }))).toBeNull();
  });
  it.each(['checkbox', 'radio', 'range', 'button'])('INPUT[%s] → action', (type) => {
    expect(matchShortcut(ev({ target: { tagName: 'INPUT', type } }))).toBe('listen');
  });
  it('BUTTON, DIV, svg group and null target → action', () => {
    for (const target of [
      { tagName: 'BUTTON' },
      { tagName: 'DIV' },
      { tagName: 'g' },
      null
    ] as (ShortcutTarget | null)[]) {
      expect(matchShortcut(ev({ target }))).toBe('listen');
    }
  });
});

describe('toShortcutEvent', () => {
  it('reads tag, lower-cased type and contenteditable from an element target', () => {
    const input = document_like({ tagName: 'INPUT', type: 'TEXT', isContentEditable: false });
    const out = toShortcutEvent(kbd(input, 'p'));
    expect(out.target).toEqual({ tagName: 'INPUT', type: 'text', isContentEditable: false });
    expect(matchShortcut(out)).toBeNull();
  });
  it('non-Element target → null', () => {
    expect(toShortcutEvent(kbd({}, 'p')).target).toBeNull();
    expect(toShortcutEvent(kbd(null, 'p')).target).toBeNull();
  });
});

describe('cycle', () => {
  const L = ['a', 'b', 'c'] as const;
  it('moves to the neighbour', () => {
    expect(cycle(L, 'a', 1, false)).toBe('b');
    expect(cycle(L, 'c', -1, false)).toBe('b');
  });
  it('wraps at both ends when asked', () => {
    expect(cycle(L, 'c', 1, true)).toBe('a');
    expect(cycle(L, 'a', -1, true)).toBe('c');
  });
  it('stops at both ends without wrap', () => {
    expect(cycle(L, 'c', 1, false)).toBeNull();
    expect(cycle(L, 'a', -1, false)).toBeNull();
  });
  it('current not in list → null', () => {
    expect(cycle(L, 'z' as never, 1, true)).toBeNull();
  });
});

describe('label orders follow the prefs codec (R-05)', () => {
  it('match', () => {
    expect(NOTES_LABEL_ORDER).toEqual(NOTES_LABELS);
    expect(TRIADS_LABEL_ORDER).toEqual(TRIADS_LABELS);
    expect(CAGED_LABEL_ORDER).toEqual(CAGED_LABELS);
  });
});

class FakeElement {
  readonly tagName = '';
}
// Node environment: fake an Element-like target through the global the adapter checks.
function document_like(o: { tagName: string; type?: string; isContentEditable?: boolean }) {
  return Object.assign(Object.create(FakeElement.prototype), o) as object;
}
(globalThis as { Element?: unknown }).Element ??= FakeElement;
function kbd(target: unknown, key: string): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    isComposing: false,
    getModifierState: () => false,
    target
  } as unknown as KeyboardEvent;
}
