/**
 * Notation and accidental-policy types (contracts/notation-api.md §1).
 * Pure: no Paraglide, Svelte or DOM.
 */
export type Notation = 'letters' | 'solfege';
export type AccidentalPolicy = 'sharps' | 'flats' | 'both';

export const NOTATIONS: readonly Notation[] = ['letters', 'solfege'];
export const ACCIDENTAL_POLICIES: readonly AccidentalPolicy[] = ['sharps', 'flats', 'both'];

export interface NotationContext {
  readonly notation: Notation;
  readonly accidentals: AccidentalPolicy;
}

export const DEFAULT_NOTATION_CONTEXT: NotationContext = Object.freeze({
  notation: 'letters',
  accidentals: 'sharps'
});
