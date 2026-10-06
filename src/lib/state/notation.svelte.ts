/**
 * Notation and accidental preference (contracts/notation-api.md §4). Installs the notation
 * source read by `$lib/notation/notation`, so every formatter tracks this store reactively.
 * Switching never reloads, navigates, fetches or resets another store.
 */
import { defaultNotation } from '$lib/i18n/languages';
import { overwriteNotationSource, resetNotationSourceForTests } from '$lib/notation/notation';
import type { AccidentalPolicy, Notation } from '$lib/notation/policy';
import { language } from './language.svelte';
import { preferences } from './preferences.svelte';

let chosen = $state<Notation | null>(null);
let accidentals = $state<AccidentalPolicy>('sharps');
let started = false;

const effective = $derived(chosen ?? defaultNotation(language.current));

export const notation = {
  get effective(): Notation {
    return effective;
  },
  get chosen(): Notation | null {
    return chosen;
  },
  get accidentals(): AccidentalPolicy {
    return accidentals;
  },

  /** Called once from `preferences.start()` after `language.start()`. Idempotent. */
  start(stored: { notation: Notation | null; accidentals: AccidentalPolicy }): void {
    if (started) return;
    started = true;
    chosen = stored.notation;
    accidentals = stored.accidentals;
    overwriteNotationSource(() => ({ notation: effective, accidentals }));
  },

  /** Explicit pick: remembered also when it equals the effective value. */
  choose(n: Notation): void {
    chosen = n;
    preferences.remember({ notation: n });
  },

  chooseAccidentals(a: AccidentalPolicy): void {
    accidentals = a;
    preferences.remember({ accidentals: a });
  },

  /** Non-persisting (erase, or applying a loaded record). */
  restore(stored: Notation | null, policy: AccidentalPolicy): void {
    chosen = stored;
    accidentals = policy;
  }
};

/** Test seam: forget start state and restore letters and sharps (Vitest only). */
export function resetNotationForTests(): void {
  started = false;
  chosen = null;
  accidentals = 'sharps';
  resetNotationSourceForTests();
}
