/**
 * Share-link types (specs/022 data-model §1–§2). Pure: no Svelte, DOM, i18n or storage.
 * A snapshot holds only musical state: no language, notation, handedness or other presentation.
 */
import type { StringCount, Tuning } from '$lib/instrument/tunings';
import type { InstrumentConfig } from '$lib/state/instrument-config';
import type { NotesViewState } from '$lib/state/notes-view';
import type { TriadsViewState } from '$lib/state/triads-view';
import type { CagedViewState } from '$lib/state/caged-view';

export type LinkTool = 'notes' | 'triads' | 'caged';

/** `InstrumentConfig` minus handedness and orientation. */
export interface LinkInstrument {
  readonly stringCount: StringCount;
  /** Canonical: a preset id, or custom offsets matching no preset. */
  readonly tuning: Tuning;
  /** Integer 12..24. */
  readonly fretCount: number;
}

export type ShareSnapshot =
  | { readonly tool: 'notes'; readonly view: NotesViewState; readonly instrument: LinkInstrument }
  | { readonly tool: 'triads'; readonly view: TriadsViewState; readonly instrument: LinkInstrument }
  | {
      readonly tool: 'caged';
      readonly view: CagedViewState;
      /** The preferred instrument; `temporary` says the standard counterpart is shown. */
      readonly instrument: LinkInstrument;
      readonly temporary: boolean;
    };

export type DecodeResult =
  | {
      readonly kind: 'ok';
      readonly snapshot: ShareSnapshot;
      /** Param keys that were missing or invalid and took their default. */
      readonly fellBack: readonly string[];
    }
  | { readonly kind: 'not-a-tool' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'unsupported-version'; readonly version: number };

/** Drop presentation (`handedness`, `orientation`); the encoder never sees them. */
export function musicalOf(config: InstrumentConfig): LinkInstrument {
  return {
    stringCount: config.stringCount,
    tuning: config.tuning,
    fretCount: config.fretCount
  };
}
