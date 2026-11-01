/**
 * Metronome page keys: Space toggles, Escape resets (031, research R-11), T taps the tempo in
 * plain mode when shortcuts are on (038). Pure and DOM-free.
 */
import type { ShortcutEventLike } from './shortcuts';

export type MetronomeKeyAction = 'toggle' | 'reset' | 'tap';

export type MetronomePhase = 'settings' | 'starting' | 'running' | 'paused';

const TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'search',
  'number',
  'email',
  'url',
  'tel',
  'password'
]);

/** Inputs whose native Space press activates them. */
const ACTIVATING_INPUT_TYPES: ReadonlySet<string> = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'image',
  'file',
  'color'
]);

function isEditable(t: NonNullable<ShortcutEventLike['target']>): boolean {
  if (t.isContentEditable) return true;
  const tag = t.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && (t.type === undefined || TEXT_INPUT_TYPES.has(t.type));
}

function activatesNatively(t: NonNullable<ShortcutEventLike['target']>): boolean {
  const tag = t.tagName.toUpperCase();
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true;
  return tag === 'INPUT' && t.type !== undefined && ACTIVATING_INPUT_TYPES.has(t.type);
}

export function matchMetronomeKey(
  e: ShortcutEventLike & { readonly targetActivates?: boolean },
  ctx: {
    readonly phase: MetronomePhase;
    readonly disclosureOpen: boolean;
    readonly mode: string;
    readonly shortcuts: boolean;
  }
): MetronomeKeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.getModifierState?.('AltGraph')) return null;
  if (e.repeat || e.defaultPrevented || e.isComposing) return null;
  const t = e.target;
  if (t && isEditable(t)) return null;
  if (e.key === ' ') {
    if (e.targetActivates || (t && activatesNatively(t))) return null;
    return 'toggle';
  }
  if (e.key === 'Escape') {
    return ctx.phase !== 'settings' && !ctx.disclosureOpen ? 'reset' : null;
  }
  if (e.key === 't' || e.key === 'T') {
    return ctx.mode === 'plain' && ctx.shortcuts && !ctx.disclosureOpen ? 'tap' : null;
  }
  return null;
}
