/**
 * CAGED view state (data-model §4, contracts/caged-api §2).
 * Pure: no Svelte, DOM or paraglide. Every function is total; a no-op returns the same object.
 */
import type { PitchClass, Spelling } from '../theory/pitch';
import type { CagedQuality } from '../theory/caged';
import { choiceOf, effectiveRootSpelling, isAlteredRoot } from '../theory/triad';
import type { SpellingOverride } from './triads-view';

export type { SpellingOverride } from './triads-view';

export interface CagedViewState {
  readonly rootPc: PitchClass;
  readonly spellingOverride: SpellingOverride;
  readonly quality: CagedQuality;
}

export const CAGED_QUALITIES: readonly CagedQuality[] = ['major', 'minor'];

/** FR-002: C major, no spelling override. */
export function initialCagedView(): CagedViewState {
  return { rootPc: 0, spellingOverride: 'none', quality: 'major' };
}

export function selectRoot(s: CagedViewState, pc: PitchClass): CagedViewState {
  if (!Number.isInteger(pc) || pc < 0 || pc > 11 || pc === s.rootPc) return s;
  return { ...s, rootPc: pc, spellingOverride: 'none' };
}

/** The override is kept (FR-003). */
export function setQuality(s: CagedViewState, q: CagedQuality): CagedViewState {
  if (!CAGED_QUALITIES.includes(q) || q === s.quality) return s;
  return { ...s, quality: q };
}

/** Toggle between the two spellings of an altered root; no-op on naturals. */
export function switchSpelling(s: CagedViewState): CagedViewState {
  if (!isAlteredRoot(s.rootPc)) return s;
  const current = choiceOf(s.rootPc, cagedRootSpelling(s));
  return { ...s, spellingOverride: current === 'sharp' ? 'flat' : 'sharp' };
}

export function resetCaged(): CagedViewState {
  return initialCagedView();
}

export function equalsCagedView(a: CagedViewState, b: CagedViewState): boolean {
  return (
    a.rootPc === b.rootPc && a.spellingOverride === b.spellingOverride && a.quality === b.quality
  );
}

export function cagedRootSpelling(s: CagedViewState): Spelling {
  return effectiveRootSpelling(s.rootPc, s.spellingOverride, s.quality);
}
